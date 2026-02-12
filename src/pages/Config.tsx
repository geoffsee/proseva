import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Button,
  Spinner,
  Alert,
  Textarea,
} from "@chakra-ui/react";
import {
  FiBell,
  FiClock,
  FiCpu,
  FiFolder,
  FiAlertTriangle,
  FiKey,
  FiSearch,
  FiMessageSquare,
} from "react-icons/fi";
import { useStore } from "../store/StoreContext";
import { toaster } from "../components/ui/toaster";
import { MaskedInput } from "../components/config/MaskedInput";
import { ConfigSection } from "../components/config/ConfigSection";
import { api, type DbSecurityStatus } from "../lib/api";

const RECOVERY_KEY_STORAGE_KEY = "proseva.dbRecoveryKey";

function generateRecoveryKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(30);
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  const chunks = [
    chars.slice(0, 6).join(""),
    chars.slice(6, 12).join(""),
    chars.slice(12, 18).join(""),
    chars.slice(18, 24).join(""),
    chars.slice(24, 30).join(""),
  ];
  return chunks.join("-");
}

const Config = observer(() => {
  const { configStore } = useStore();

  // Local state for form values
  const [firebaseProjectId, setFirebaseProjectId] = useState("");
  const [firebasePrivateKey, setFirebasePrivateKey] = useState("");
  const [firebaseClientEmail, setFirebaseClientEmail] = useState("");

  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [twilioTestPhone, setTwilioTestPhone] = useState("");

  const [schedulerTimezone, setSchedulerTimezone] = useState("");
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);

  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiEndpoint, setOpenaiEndpoint] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [vlmModel, setVlmModel] = useState("");

  const [autoIngestDir, setAutoIngestDir] = useState("");

  const [courtListenerApiToken, setCourtListenerApiToken] = useState("");
  const [legiscanApiKey, setLegiscanApiKey] = useState("");
  const [govInfoApiKey, setGovInfoApiKey] = useState("");
  const [serpapiBase, setSerpapiBase] = useState("");

  const [chatSystemPrompt, setChatSystemPrompt] = useState("");
  const [caseSummaryPrompt, setCaseSummaryPrompt] = useState("");
  const [evaluatorPrompt, setEvaluatorPrompt] = useState("");

  const [hasChanges, setHasChanges] = useState(false);
  const [dbSecurityStatus, setDbSecurityStatus] =
    useState<DbSecurityStatus | null>(null);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState("");
  const [isApplyingRecoveryKey, setIsApplyingRecoveryKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsEndpoint, setModelsEndpoint] = useState<string | null>(null);

  const loadOpenAIModels = async (endpointOverride?: string) => {
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const response = await api.config.getOpenAIModels(endpointOverride);
      if (!response.success) {
        setModelsError(response.error || "Failed to load models.");
        return;
      }
      setAvailableModels(response.models);
      setModelsEndpoint(response.endpoint ?? null);
    } catch (error) {
      setModelsError(String(error));
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    configStore.loadConfig();
    void api.security
      .status()
      .then((status) => setDbSecurityStatus(status))
      .catch((error) => {
        console.error("Failed to load DB security status:", error);
      });
  }, [configStore]);

  useEffect(() => {
    if (configStore.config) {
      setFirebaseProjectId(configStore.config.firebase?.projectId || "");
      setFirebasePrivateKey(configStore.config.firebase?.privateKey || "");
      setFirebaseClientEmail(configStore.config.firebase?.clientEmail || "");

      setTwilioAccountSid(configStore.config.twilio?.accountSid || "");
      setTwilioAuthToken(configStore.config.twilio?.authToken || "");
      setTwilioPhoneNumber(configStore.config.twilio?.phoneNumber || "");

      setSchedulerTimezone(
        configStore.config.scheduler?.timezone || "America/New_York",
      );
      setSchedulerEnabled(configStore.config.scheduler?.enabled ?? true);

      setOpenaiApiKey(configStore.config.ai?.openaiApiKey || "");
      const configuredEndpoint = configStore.config.ai?.openaiEndpoint || "";
      setOpenaiEndpoint(configuredEndpoint);
      setSelectedModels(configStore.config.ai?.selectedModels || []);
      setVlmModel(configStore.config.ai?.vlmModel || "");
      void loadOpenAIModels(configuredEndpoint);

      setAutoIngestDir(configStore.config.autoIngest?.directory || "");

      setCourtListenerApiToken(
        configStore.config.legalResearch?.courtListenerApiToken || "",
      );
      setLegiscanApiKey(configStore.config.legalResearch?.legiscanApiKey || "");
      setGovInfoApiKey(configStore.config.legalResearch?.govInfoApiKey || "");
      setSerpapiBase(configStore.config.legalResearch?.serpapiBase || "");

      setChatSystemPrompt(configStore.config.prompts?.chatSystemPrompt || "");
      setCaseSummaryPrompt(
        configStore.config.prompts?.caseSummaryPrompt || "",
      );
      setEvaluatorPrompt(configStore.config.prompts?.evaluatorPrompt || "");
    }
  }, [configStore.config]);

  const handleSave = async () => {
    try {
      await configStore.updateConfig({
        firebase: {
          projectId: firebaseProjectId || undefined,
          privateKey: firebasePrivateKey || undefined,
          clientEmail: firebaseClientEmail || undefined,
        },
        twilio: {
          accountSid: twilioAccountSid || undefined,
          authToken: twilioAuthToken || undefined,
          phoneNumber: twilioPhoneNumber || undefined,
        },
        scheduler: {
          timezone: schedulerTimezone || undefined,
          enabled: schedulerEnabled,
        },
        ai: {
          openaiApiKey: openaiApiKey || undefined,
          openaiEndpoint: openaiEndpoint || undefined,
          selectedModels: selectedModels,
          vlmModel: vlmModel || undefined,
        },
        autoIngest: {
          directory: autoIngestDir || undefined,
        },
        legalResearch: {
          courtListenerApiToken: courtListenerApiToken || undefined,
          legiscanApiKey: legiscanApiKey || undefined,
          govInfoApiKey: govInfoApiKey || undefined,
          serpapiBase: serpapiBase || undefined,
        },
        prompts: {
          chatSystemPrompt: chatSystemPrompt || undefined,
          caseSummaryPrompt: caseSummaryPrompt || undefined,
          evaluatorPrompt: evaluatorPrompt || undefined,
        },
      });

      // Reinitialize services
      await configStore.reinitializeService("firebase");
      await configStore.reinitializeService("twilio");
      await configStore.reinitializeService("scheduler");
      await loadOpenAIModels(openaiEndpoint);

      setHasChanges(false);
      toaster.create({ title: "Configuration saved", type: "success" });
    } catch (error) {
      toaster.create({
        title: "Failed to save configuration",
        description: String(error),
        type: "error",
      });
    }
  };

  const handleResetAll = async () => {
    if (
      confirm(
        "Reset all configuration to environment variables? This will remove all database overrides.",
      )
    ) {
      try {
        await configStore.resetConfig();
        setHasChanges(false);
        toaster.create({ title: "Configuration reset", type: "success" });
      } catch (error) {
        toaster.create({
          title: "Failed to reset configuration",
          description: String(error),
          type: "error",
        });
      }
    }
  };

  const handleTestFirebase = async () => {
    const result = await configStore.testFirebase();
    if (result.success) {
      toaster.create({
        title: "Firebase connection successful",
        type: "success",
      });
    } else {
      toaster.create({
        title: "Firebase connection failed",
        description: result.error,
        type: "error",
      });
    }
  };

  const handleTestTwilio = async () => {
    if (!twilioTestPhone.trim()) {
      toaster.create({
        title: "Test phone number required",
        description: "Please enter a phone number to receive the test SMS",
        type: "error",
      });
      return;
    }

    const result = await configStore.testTwilio(twilioTestPhone);
    if (result.success) {
      toaster.create({
        title: "Twilio SMS sent successfully",
        type: "success",
      });
    } else {
      toaster.create({
        title: "Twilio connection failed",
        description: result.error,
        type: "error",
      });
    }
  };

  const handleTestOpenAI = async () => {
    const result = await configStore.testOpenAI();
    if (result.success) {
      toaster.create({
        title: "OpenAI connection successful",
        type: "success",
      });
    } else {
      toaster.create({
        title: "OpenAI connection failed",
        description: result.error,
        type: "error",
      });
    }
  };

  const handleApplyRecoveryKey = async () => {
    const trimmed = recoveryKey.trim();
    if (!trimmed) {
      toaster.create({
        title: "Recovery key required",
        description: "Enter a recovery key first.",
        type: "error",
      });
      return;
    }

    setIsApplyingRecoveryKey(true);
    try {
      const result = await api.security.applyRecoveryKey(trimmed);
      if (!result.success) {
        toaster.create({
          title: "Failed to apply recovery key",
          description: result.error || "Invalid recovery key.",
          type: "error",
        });
        return;
      }

      localStorage.setItem(RECOVERY_KEY_STORAGE_KEY, trimmed);
      setDbSecurityStatus(result.status ?? null);
      setGeneratedRecoveryKey(trimmed);
      toaster.create({
        title: "Recovery key applied",
        description: "Encryption key is now active for this database.",
        type: "success",
      });
    } catch (error) {
      toaster.create({
        title: "Failed to apply recovery key",
        description: String(error),
        type: "error",
      });
    } finally {
      setIsApplyingRecoveryKey(false);
    }
  };

  const handleGenerateRecoveryKey = () => {
    const key = generateRecoveryKey();
    setGeneratedRecoveryKey(key);
    setRecoveryKey(key);
    toaster.create({
      title: "Recovery key generated",
      description: "Save this key somewhere safe before applying it.",
      type: "success",
    });
  };

  const handleCopyRecoveryKey = async () => {
    if (!generatedRecoveryKey) return;
    try {
      await navigator.clipboard.writeText(generatedRecoveryKey);
      toaster.create({ title: "Recovery key copied", type: "success" });
    } catch (error) {
      toaster.create({
        title: "Copy failed",
        description: String(error),
        type: "error",
      });
    }
  };

  const toggleModel = (model: string, checked: boolean) => {
    if (checked) {
      setSelectedModels(Array.from(new Set([...selectedModels, model])));
    } else {
      setSelectedModels(selectedModels.filter((m) => m !== model));
    }
    setHasChanges(true);
  };

  if (configStore.isLoading && !configStore.config) {
    return (
      <Box p={8}>
        <VStack>
          <Spinner size="xl" />
          <Text>Loading configuration...</Text>
        </VStack>
      </Box>
    );
  }

  const notificationStatus =
    configStore.config?.firebase?.projectIdSource === "database" ||
    configStore.config?.twilio?.accountSidSource === "database"
      ? "database"
      : "environment";

  const schedulerStatus =
    configStore.config?.scheduler?.timezoneSource === "database"
      ? "database"
      : "environment";

  const aiStatus =
    configStore.config?.ai?.openaiApiKeySource === "database"
      ? "database"
      : "environment";

  const autoIngestStatus =
    configStore.config?.autoIngest?.directorySource === "database"
      ? "database"
      : "environment";

  const legalResearchStatus =
    configStore.config?.legalResearch?.courtListenerApiTokenSource ===
      "database" ||
    configStore.config?.legalResearch?.legiscanApiKeySource === "database" ||
    configStore.config?.legalResearch?.govInfoApiKeySource === "database" ||
    configStore.config?.legalResearch?.serpapiBaseSource === "database"
      ? "database"
      : "environment";

  const encryptionStatus = dbSecurityStatus?.encryptedAtRest
    ? "database"
    : "environment";

  const promptsStatus =
    configStore.config?.prompts?.chatSystemPromptSource === "database" ||
    configStore.config?.prompts?.caseSummaryPromptSource === "database" ||
    configStore.config?.prompts?.evaluatorPromptSource === "database"
      ? "database"
      : "environment";

  const modelOptions = Array.from(
    new Set([...availableModels, ...selectedModels]),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <Box p={8}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading size="xl" mb={2}>
            Settings
          </Heading>
          <Text color="gray.600">
            Configure server settings that override environment variables
          </Text>
        </Box>

        {configStore.error && (
          <Alert.Root status="error">
            <Alert.Indicator />
            <Alert.Title>Error</Alert.Title>
            <Alert.Description>{configStore.error}</Alert.Description>
          </Alert.Root>
        )}

        {/* Notifications Section */}
        <ConfigSection
          title="Notifications"
          icon={<FiBell />}
          status={notificationStatus}
          isTesting={configStore.isTesting}
        >
          <Box>
            <Heading size="sm" mb={3}>
              Firebase Push Notifications
            </Heading>
            <VStack gap={3} align="stretch">
              <Box>
                <Text fontSize="sm" mb={1} fontWeight="medium">
                  Project ID
                </Text>
                <Input
                  value={firebaseProjectId}
                  onChange={(e) => {
                    setFirebaseProjectId(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="your-project-id"
                />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1} fontWeight="medium">
                  Private Key
                </Text>
                <MaskedInput
                  value={firebasePrivateKey}
                  onChange={(value) => {
                    setFirebasePrivateKey(value);
                    setHasChanges(true);
                  }}
                  placeholder="-----BEGIN PRIVATE KEY-----..."
                  label="Firebase Private Key"
                />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1} fontWeight="medium">
                  Client Email
                </Text>
                <Input
                  value={firebaseClientEmail}
                  onChange={(e) => {
                    setFirebaseClientEmail(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="firebase-adminsdk@your-project.iam.gserviceaccount.com"
                />
              </Box>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestFirebase}
                loading={configStore.isTesting}
              >
                Test Firebase Connection
              </Button>
            </VStack>
          </Box>

          <Box>
            <Heading size="sm" mb={3}>
              Twilio SMS Notifications
            </Heading>
            <VStack gap={3} align="stretch">
              <Box>
                <Text fontSize="sm" mb={1} fontWeight="medium">
                  Account SID
                </Text>
                <MaskedInput
                  value={twilioAccountSid}
                  onChange={(value) => {
                    setTwilioAccountSid(value);
                    setHasChanges(true);
                  }}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  label="Twilio Account SID"
                />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1} fontWeight="medium">
                  Auth Token
                </Text>
                <MaskedInput
                  value={twilioAuthToken}
                  onChange={(value) => {
                    setTwilioAuthToken(value);
                    setHasChanges(true);
                  }}
                  placeholder="your-auth-token"
                  label="Twilio Auth Token"
                />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1} fontWeight="medium">
                  Phone Number
                </Text>
                <Input
                  value={twilioPhoneNumber}
                  onChange={(e) => {
                    setTwilioPhoneNumber(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="+15551234567"
                />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1} fontWeight="medium">
                  Test Phone Number
                </Text>
                <Input
                  value={twilioTestPhone}
                  onChange={(e) => setTwilioTestPhone(e.target.value)}
                  placeholder="+15551234567"
                />
              </Box>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestTwilio}
                loading={configStore.isTesting}
              >
                Send Test SMS
              </Button>
            </VStack>
          </Box>
        </ConfigSection>

        {/* Scheduler Section */}
        <ConfigSection
          title="Scheduler"
          icon={<FiClock />}
          status={schedulerStatus}
        >
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              Timezone
            </Text>
            <Input
              value={schedulerTimezone}
              onChange={(e) => {
                setSchedulerTimezone(e.target.value);
                setHasChanges(true);
              }}
              placeholder="America/New_York"
            />
          </Box>
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              Enabled
            </Text>
            <HStack>
              <input
                type="checkbox"
                checked={schedulerEnabled}
                onChange={(e) => {
                  setSchedulerEnabled(e.target.checked);
                  setHasChanges(true);
                }}
                style={{ width: "20px", height: "20px", cursor: "pointer" }}
              />
              <Text>{schedulerEnabled ? "Enabled" : "Disabled"}</Text>
            </HStack>
          </Box>
          <Text fontSize="sm" color="gray.600">
            Daily evaluations run at 6 PM in the configured timezone
          </Text>
        </ConfigSection>

        {/* AI Features Section */}
        <ConfigSection
          title="AI Features"
          icon={<FiCpu />}
          status={aiStatus}
          isTesting={configStore.isTesting}
        >
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              OpenAI API Key
            </Text>
            <MaskedInput
              value={openaiApiKey}
              onChange={(value) => {
                setOpenaiApiKey(value);
                setHasChanges(true);
              }}
              placeholder="sk-..."
              label="OpenAI API Key"
            />
          </Box>
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              OpenAI Endpoint (optional)
            </Text>
            <Input
              value={openaiEndpoint}
              onChange={(e) => {
                setOpenaiEndpoint(e.target.value);
                setHasChanges(true);
              }}
              placeholder="https://api.openai.com/v1"
            />
          </Box>
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              VLM Model (vision/document processing)
            </Text>
            <Input
              value={vlmModel}
              onChange={(e) => {
                setVlmModel(e.target.value);
                setHasChanges(true);
              }}
              placeholder="gpt-4o-mini"
            />
          </Box>
          <Box>
            <Text fontSize="sm" mb={3} fontWeight="medium">
              Available Models
            </Text>
            <HStack mb={2}>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  void loadOpenAIModels(openaiEndpoint);
                }}
                loading={isLoadingModels}
              >
                Refresh Model List
              </Button>
              {modelsEndpoint && (
                <Text fontSize="xs" color="gray.600">
                  {modelsEndpoint}
                </Text>
              )}
            </HStack>
            {modelsError && (
              <Alert.Root status="warning" mb={2}>
                <Alert.Indicator />
                <Alert.Description>{modelsError}</Alert.Description>
              </Alert.Root>
            )}
            {modelOptions.length === 0 ? (
              <Text fontSize="sm" color="gray.600">
                No models available. Check endpoint/API key and refresh.
              </Text>
            ) : (
              <VStack gap={2} align="stretch">
                {modelOptions.map((model) => (
                  <label
                    key={model}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model)}
                      onChange={(e) => toggleModel(model, e.target.checked)}
                      style={{
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                      }}
                    />
                    <Text fontSize="sm">{model}</Text>
                  </label>
                ))}
              </VStack>
            )}
          </Box>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestOpenAI}
            loading={configStore.isTesting}
          >
            Test OpenAI Connection
          </Button>
          <Text fontSize="sm" color="gray.600">
            Used for AI-powered case summaries, reports, and chat
          </Text>
        </ConfigSection>

        {/* AI Prompts Section */}
        <ConfigSection
          title="AI Prompts"
          icon={<FiMessageSquare />}
          status={promptsStatus}
        >
          <Text fontSize="sm" color="gray.600" mb={3}>
            Customize the system prompts used by AI features. Leave blank to use
            defaults. Changes take effect immediately.
          </Text>

          <Box>
            <HStack justify="space-between" mb={1}>
              <Text fontSize="sm" fontWeight="medium">
                Chat System Prompt
              </Text>
              {configStore.config?.prompts?.chatSystemPromptSource && (
                <Text fontSize="xs" color="gray.500">
                  Source: {configStore.config.prompts.chatSystemPromptSource}
                </Text>
              )}
            </HStack>
            <Textarea
              value={chatSystemPrompt}
              onChange={(e) => {
                setChatSystemPrompt(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Default: Knowledgeable legal assistant for pro se litigants in Virginia, writing in the style of Alan Dershowitz..."
              rows={6}
              fontFamily="monospace"
              fontSize="sm"
            />
            <Text fontSize="xs" color="gray.500" mt={1}>
              Used by the AI chat assistant when responding to user queries
            </Text>
          </Box>

          <Box>
            <HStack justify="space-between" mb={1}>
              <Text fontSize="sm" fontWeight="medium">
                Case Summary Prompt
              </Text>
              {configStore.config?.prompts?.caseSummaryPromptSource && (
                <Text fontSize="xs" color="gray.500">
                  Source: {configStore.config.prompts.caseSummaryPromptSource}
                </Text>
              )}
            </HStack>
            <Textarea
              value={caseSummaryPrompt}
              onChange={(e) => {
                setCaseSummaryPrompt(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Default: Provide concise strategic summary with case assessment, key deadlines, and evidence gaps..."
              rows={6}
              fontFamily="monospace"
              fontSize="sm"
            />
            <Text fontSize="xs" color="gray.500" mt={1}>
              Template for case summaries. Supports placeholders: {"{caseName}"}
              , {"{caseType}"}, {"{status}"}, {"{totalDeadlines}"}
            </Text>
          </Box>

          <Box>
            <HStack justify="space-between" mb={1}>
              <Text fontSize="sm" fontWeight="medium">
                Evaluator Prompt
              </Text>
              {configStore.config?.prompts?.evaluatorPromptSource && (
                <Text fontSize="xs" color="gray.500">
                  Source: {configStore.config.prompts.evaluatorPromptSource}
                </Text>
              )}
            </HStack>
            <Textarea
              value={evaluatorPrompt}
              onChange={(e) => {
                setEvaluatorPrompt(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Default: Provide brief, actionable summary of deadline status focusing on critical items..."
              rows={6}
              fontFamily="monospace"
              fontSize="sm"
            />
            <Text fontSize="xs" color="gray.500" mt={1}>
              Template for deadline evaluations. Supports placeholders:{" "}
              {"{overdueText}"}, {"{upcomingText}"}
            </Text>
          </Box>

          <Alert.Root status="info">
            <Alert.Indicator />
            <Alert.Description>
              See{" "}
              <Text as="span" fontWeight="bold">
                docs/hot-swap-prompts.md
              </Text>{" "}
              for detailed information about prompt customization, placeholders,
              and best practices.
            </Alert.Description>
          </Alert.Root>
        </ConfigSection>

        {/* Legal Research APIs Section */}
        <ConfigSection
          title="Legal Research APIs"
          icon={<FiSearch />}
          status={legalResearchStatus}
        >
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              CourtListener API Token
            </Text>
            <MaskedInput
              value={courtListenerApiToken}
              onChange={(value) => {
                setCourtListenerApiToken(value);
                setHasChanges(true);
              }}
              placeholder="your-courtlistener-api-token"
              label="CourtListener API Token"
            />
          </Box>
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              LegiScan API Key
            </Text>
            <MaskedInput
              value={legiscanApiKey}
              onChange={(value) => {
                setLegiscanApiKey(value);
                setHasChanges(true);
              }}
              placeholder="your-legiscan-api-key"
              label="LegiScan API Key"
            />
          </Box>
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              GovInfo API Key
            </Text>
            <MaskedInput
              value={govInfoApiKey}
              onChange={(value) => {
                setGovInfoApiKey(value);
                setHasChanges(true);
              }}
              placeholder="your-govinfo-api-key"
              label="GovInfo API Key"
            />
          </Box>
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              SerpAPI Base URL
            </Text>
            <Input
              value={serpapiBase}
              onChange={(e) => {
                setSerpapiBase(e.target.value);
                setHasChanges(true);
              }}
              placeholder="https://serpapi.com"
            />
          </Box>
          <Text fontSize="sm" color="gray.600">
            API keys and endpoints for legal research services (case law,
            legislation, and government publications)
          </Text>
        </ConfigSection>

        {/* Data Encryption Section */}
        <ConfigSection
          title="Data Encryption"
          icon={<FiKey />}
          status={encryptionStatus}
        >
          <Text fontSize="sm" color="gray.600">
            Generate or provide a recovery key to encrypt data at rest and
            unlock encrypted databases on new devices.
          </Text>

          {dbSecurityStatus?.locked && (
            <Alert.Root status="warning">
              <Alert.Indicator />
              <Alert.Title>Database locked</Alert.Title>
              <Alert.Description>
                Enter your recovery key to unlock this database.
              </Alert.Description>
            </Alert.Root>
          )}

          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              Recovery Key
            </Text>
            <Input
              type="password"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="Enter existing key or generate a new one"
            />
          </Box>

          <HStack>
            <Button
              size="sm"
              colorPalette="blue"
              onClick={handleApplyRecoveryKey}
              loading={isApplyingRecoveryKey}
            >
              Apply Recovery Key
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateRecoveryKey}
            >
              Generate Recovery Key
            </Button>
          </HStack>

          {generatedRecoveryKey && (
            <Alert.Root status="warning">
              <Alert.Indicator />
              <Alert.Title>Store this key safely</Alert.Title>
              <Alert.Description>{generatedRecoveryKey}</Alert.Description>
              <Button
                size="xs"
                variant="outline"
                onClick={handleCopyRecoveryKey}
              >
                Copy
              </Button>
            </Alert.Root>
          )}
        </ConfigSection>

        {/* Auto-Ingest Section */}
        <ConfigSection
          title="Auto-Ingest"
          icon={<FiFolder />}
          status={autoIngestStatus}
        >
          <Box>
            <Text fontSize="sm" mb={1} fontWeight="medium">
              Directory
            </Text>
            <Input
              value={autoIngestDir}
              onChange={(e) => {
                setAutoIngestDir(e.target.value);
                setHasChanges(true);
              }}
              placeholder="/path/to/documents"
            />
          </Box>
          <Alert.Root status="warning">
            <Alert.Indicator>
              <FiAlertTriangle />
            </Alert.Indicator>
            <Alert.Title>Requires restart</Alert.Title>
            <Alert.Description>
              Changes to auto-ingest directory require a restart to take effect
            </Alert.Description>
          </Alert.Root>
          <Text fontSize="sm" color="gray.600">
            Automatically ingest PDF files from the specified directory
          </Text>
        </ConfigSection>

        {/* Action Buttons */}
        <HStack justify="flex-end">
          <Button variant="outline" onClick={handleResetAll}>
            Reset All
          </Button>
          <Button
            colorPalette="blue"
            onClick={handleSave}
            loading={configStore.isLoading}
            disabled={!hasChanges}
          >
            Save All Changes
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
});

export default Config;
