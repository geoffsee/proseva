import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Heading,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  securityApi,
  authApi,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  setAuthExpiredCallback,
} from "../../lib/api";
import {
  initAuthStore,
  initKeysStore,
  initDataStore,
  generateAndStoreMLKEMKeys,
  loadMLKEMKeys,
} from "../../lib/kv";

type GateState =
  | "loading"
  | "create-passphrase"
  | "enter-passphrase"
  | "initializing"
  | "ready";

export function PassphraseGate({ children }: { children: ReactNode }) {
  const isTestMode = import.meta.env.MODE === "test";
  const [state, setState] = useState<GateState>("loading");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isTestMode) {
      setState("ready");
      return;
    }

    let cancelled = false;
    const bootstrap = async () => {
      try {
        // Initialize auth store first (doesn't require passphrase)
        await initAuthStore();

        // Check if we have a valid token from a previous session
        const existingToken = await getAuthToken();
        if (existingToken) {
          // Try to use the existing token to initialize stores
          // This will fail if the token is expired, which is fine
          try {
            setState("initializing");
            await initializeWithExistingToken(existingToken);
            if (!cancelled) {
              setState("ready");
            }
            return;
          } catch (err) {
            // Token invalid or expired, clear it and continue to passphrase prompt
            await clearAuthToken();
            console.log("Existing token invalid, requiring new login:", err);
          }
        }

        const status = await securityApi.status();
        if (cancelled) return;

        if (status.passphraseConfigured) {
          setState("enter-passphrase");
        } else {
          setState("create-passphrase");
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Failed to check security status: ${String(err)}`);
          setState("create-passphrase");
        }
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isTestMode, initializeWithExistingToken]);

  const initializeWithExistingToken = useCallback(
    async (token: string) => {
      // Try to verify the token is still valid by making a test API call
      // This will throw if the token is expired/invalid
      await securityApi.status(token);

      // Token is valid, but we still need the passphrase to decrypt the keys store
      // So we can't fully initialize here. Just set the token and return.
      // The user will still need to enter their passphrase.
      throw new Error("Token exists but passphrase still required for encryption keys");
    },
    [],
  );

  const initializeStores = useCallback(
    async (pwd: string, isFirstRun: boolean) => {
      setState("initializing");
      setError(null);

      try {
        // 1. Get authentication token from backend
        const authResult = await authApi.login(pwd);
        if (!authResult.success || !authResult.token) {
          throw new Error(authResult.error || "Failed to get authentication token");
        }
        await setAuthToken(authResult.token);

        // Set up auth expiration handler AFTER successful login
        setAuthExpiredCallback(() => {
          void clearAuthToken();
          setError("Your session has expired. Please log in again.");
          setPassphrase("");
          setState("enter-passphrase");
        });

        // 2. Open the keys store with the passphrase
        await initKeysStore(pwd);

        let publicKey: Uint8Array;
        let secretKey: Uint8Array;

        if (isFirstRun) {
          // 3a. First run: generate ML-KEM keypair and store in keys KV
          const keys = await generateAndStoreMLKEMKeys();
          publicKey = keys.publicKey;
          secretKey = keys.secretKey;
        } else {
          // 3b. Subsequent: load ML-KEM keys from keys KV
          const keys = await loadMLKEMKeys();
          if (!keys) {
            // Recovery path: if passphrase is valid but keys are missing
            // (e.g. first-run setup was interrupted), regenerate keys.
            const regenerated = await generateAndStoreMLKEMKeys();
            publicKey = regenerated.publicKey;
            secretKey = regenerated.secretKey;
          } else {
            publicKey = keys.publicKey;
            secretKey = keys.secretKey;
          }
        }

        // 4. Open the data store with ML-KEM keys
        await initDataStore(publicKey, secretKey);

        setState("ready");
      } catch (err) {
        await clearAuthToken();
        setError(`Failed to initialize encryption: ${String(err)}`);
        setState(isFirstRun ? "create-passphrase" : "enter-passphrase");
      }
    },
    [],
  );

  const handleCreatePassphrase = async () => {
    const pwd = passphrase.trim();
    const confirm = confirmPassphrase.trim();

    if (!pwd || !confirm) return;

    if (pwd !== confirm) {
      setError("Passphrases do not match.");
      return;
    }

    if (pwd.length < 8) {
      setError("Passphrase must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Store hash on the server
      const result = await securityApi.setupPassphrase(pwd);
      if (!result.success) {
        setError(result.error || "Failed to set passphrase.");
        setIsSubmitting(false);
        return;
      }

      await initializeStores(pwd, true);
    } catch (err) {
      setError(String(err));
      setState("create-passphrase");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnterPassphrase = async () => {
    const pwd = passphrase.trim();
    if (!pwd) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Verify with backend
      const result = await securityApi.verifyPassphrase(pwd);
      if (!result.valid) {
        setError(result.error || "Invalid passphrase.");
        setIsSubmitting(false);
        return;
      }

      await initializeStores(pwd, false);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isTestMode || state === "ready") {
    return <>{children}</>;
  }

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex={2000}
      bg="blackAlpha.700"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={6}
    >
      <Box bg="bg.panel" borderRadius="lg" p={6} w="full" maxW="520px">
        {(state === "loading" || state === "initializing") && (
          <VStack gap={4}>
            <Spinner size="lg" />
            <Text>
              {state === "loading"
                ? "Checking security status..."
                : "Initializing encrypted storage..."}
            </Text>
          </VStack>
        )}

        {state === "create-passphrase" && (
          <VStack align="stretch" gap={4}>
            <Heading size="md">Create Passphrase</Heading>
            <Text fontSize="sm" color="fg.muted">
              Choose a strong passphrase to protect your data. All case data
              will be encrypted with post-quantum ML-KEM-1024 encryption. If you
              lose this passphrase, your data cannot be recovered.
            </Text>

            {error && (
              <Alert.Root status="error">
                <Alert.Indicator />
                <Alert.Description>{error}</Alert.Description>
              </Alert.Root>
            )}

            <Box>
              <Text fontSize="sm" mb={1} fontWeight="medium">
                Passphrase
              </Text>
              <Input
                type="password"
                placeholder="Enter passphrase (min 8 characters)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </Box>

            <Box>
              <Text fontSize="sm" mb={1} fontWeight="medium">
                Confirm Passphrase
              </Text>
              <Input
                type="password"
                placeholder="Re-enter passphrase"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreatePassphrase();
                }}
              />
            </Box>

            <Button
              colorPalette="blue"
              onClick={handleCreatePassphrase}
              loading={isSubmitting}
              disabled={!passphrase.trim() || !confirmPassphrase.trim()}
            >
              Create &amp; Encrypt
            </Button>
          </VStack>
        )}

        {state === "enter-passphrase" && (
          <VStack align="stretch" gap={4}>
            <Heading size="md">Enter Passphrase</Heading>
            <Text fontSize="sm" color="fg.muted">
              Enter your passphrase to decrypt and access your data.
            </Text>

            {error && (
              <Alert.Root status="error">
                <Alert.Indicator />
                <Alert.Description>{error}</Alert.Description>
              </Alert.Root>
            )}

            <Input
              type="password"
              placeholder="Enter your passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleEnterPassphrase();
              }}
            />

            <Button
              colorPalette="blue"
              onClick={handleEnterPassphrase}
              loading={isSubmitting}
              disabled={!passphrase.trim()}
            >
              Unlock
            </Button>
          </VStack>
        )}
      </Box>
    </Box>
  );
}
