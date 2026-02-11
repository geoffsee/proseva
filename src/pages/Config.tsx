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
  Checkbox,
} from "@chakra-ui/react";
import {
  FiBell,
  FiClock,
  FiCpu,
  FiFolder,
  FiAlertTriangle,
  FiSearch,
} from "react-icons/fi";
import { useStore } from "../store/StoreContext";
import { toaster } from "../components/ui/toaster";
import { MaskedInput } from "../components/config/MaskedInput";
import { ConfigSection } from "../components/config/ConfigSection";

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

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    configStore.loadConfig();
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
      setOpenaiEndpoint(configStore.config.ai?.openaiEndpoint || "");
      setSelectedModels(configStore.config.ai?.selectedModels || []);
      setVlmModel(configStore.config.ai?.vlmModel || "");

      setAutoIngestDir(configStore.config.autoIngest?.directory || "");

      setCourtListenerApiToken(
        configStore.config.legalResearch?.courtListenerApiToken || "",
      );
      setLegiscanApiKey(
        configStore.config.legalResearch?.legiscanApiKey || "",
      );
      setGovInfoApiKey(configStore.config.legalResearch?.govInfoApiKey || "");
      setSerpapiBase(configStore.config.legalResearch?.serpapiBase || "");
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
      });

      // Reinitialize services
      await configStore.reinitializeService("firebase");
      await configStore.reinitializeService("twilio");
      await configStore.reinitializeService("scheduler");

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
            <VStack gap={2} align="stretch">
              <Checkbox
                checked={selectedModels.includes("claude-opus-4-6")}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedModels([...selectedModels, "claude-opus-4-6"]);
                  } else {
                    setSelectedModels(
                      selectedModels.filter((m) => m !== "claude-opus-4-6")
                    );
                  }
                  setHasChanges(true);
                }}
              >
                Claude Opus 4.6 (claude-opus-4-6)
              </Checkbox>
              <Checkbox
                checked={selectedModels.includes("claude-sonnet-4-5-20250929")}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedModels([
                      ...selectedModels,
                      "claude-sonnet-4-5-20250929",
                    ]);
                  } else {
                    setSelectedModels(
                      selectedModels.filter(
                        (m) => m !== "claude-sonnet-4-5-20250929"
                      )
                    );
                  }
                  setHasChanges(true);
                }}
              >
                Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
              </Checkbox>
              <Checkbox
                checked={selectedModels.includes("claude-haiku-4-5-20251001")}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedModels([
                      ...selectedModels,
                      "claude-haiku-4-5-20251001",
                    ]);
                  } else {
                    setSelectedModels(
                      selectedModels.filter(
                        (m) => m !== "claude-haiku-4-5-20251001"
                      )
                    );
                  }
                  setHasChanges(true);
                }}
              >
                Claude Haiku 4.5 (claude-haiku-4-5-20251001)
              </Checkbox>
            </VStack>
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
              Changes to auto-ingest directory require a restart to take
              effect
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
