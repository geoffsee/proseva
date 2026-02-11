import { useEffect, useState } from "react";
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
import { api, type DbSecurityStatus } from "../../lib/api";

const RECOVERY_KEY_STORAGE_KEY = "proseva.dbRecoveryKey";

function loadStoredRecoveryKey(): string | null {
  const raw = localStorage.getItem(RECOVERY_KEY_STORAGE_KEY);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function saveStoredRecoveryKey(recoveryKey: string): void {
  localStorage.setItem(RECOVERY_KEY_STORAGE_KEY, recoveryKey);
}

export function DbRecoveryGate() {
  const isTestMode = import.meta.env.MODE === "test";
  const [status, setStatus] = useState<DbSecurityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isTestMode) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const tryApplyRecoveryKey = async (
      key: string,
      silent: boolean,
    ): Promise<boolean> => {
      try {
        const result = await api.security.applyRecoveryKey(key);
        if (!cancelled && result.success) {
          saveStoredRecoveryKey(key);
          setStatus(result.status ?? null);
          setRecoveryKey("");
          setError(null);
          // Refresh app state so initial data fetches rerun against unlocked DB.
          window.location.reload();
          return true;
        }
        if (!cancelled && !silent) {
          setError(result.error || "Invalid recovery key.");
        }
      } catch (err) {
        if (!cancelled && !silent) {
          setError(String(err));
        }
      }
      return false;
    };

    const bootstrap = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const nextStatus = await api.security.status();
        if (cancelled) return;

        setStatus(nextStatus);
        if (nextStatus.locked) {
          const storedKey = loadStoredRecoveryKey();
          if (storedKey) {
            const unlocked = await tryApplyRecoveryKey(storedKey, true);
            if (cancelled) return;
            if (!unlocked) {
              setStatus(await api.security.status());
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Failed to load encryption status: ${String(err)}`);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isTestMode]);

  const handleUnlock = async () => {
    const trimmed = recoveryKey.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.security.applyRecoveryKey(trimmed);
      if (result.success) {
        saveStoredRecoveryKey(trimmed);
        setStatus(result.status ?? null);
        setRecoveryKey("");
        // Refresh app state so initial data fetches rerun against unlocked DB.
        window.location.reload();
      } else {
        setError(result.error || "Invalid recovery key.");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isTestMode) return null;

  if (!isLoading && !status?.locked) {
    return null;
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
        {isLoading ? (
          <VStack gap={4}>
            <Spinner size="lg" />
            <Text>Checking database encryption status...</Text>
          </VStack>
        ) : (
          <VStack align="stretch" gap={4}>
            <Heading size="md">Recovery Key Required</Heading>
            <Text fontSize="sm" color="fg.muted">
              This database is encrypted. Enter your recovery key to unlock and
              continue.
            </Text>
            {status?.lockReason === "invalid_key" && (
              <Alert.Root status="warning">
                <Alert.Indicator />
                <Alert.Description>
                  The stored key did not match this database.
                </Alert.Description>
              </Alert.Root>
            )}
            {error && (
              <Alert.Root status="error">
                <Alert.Indicator />
                <Alert.Description>{error}</Alert.Description>
              </Alert.Root>
            )}
            <Input
              type="password"
              placeholder="Enter recovery key"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleUnlock();
              }}
            />
            <Button
              colorPalette="blue"
              onClick={handleUnlock}
              loading={isSubmitting}
              disabled={!recoveryKey.trim()}
            >
              Unlock Database
            </Button>
          </VStack>
        )}
      </Box>
    </Box>
  );
}
