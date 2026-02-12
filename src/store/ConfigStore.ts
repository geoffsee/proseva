import { types, flow, type SnapshotIn } from "mobx-state-tree";
import { api, type ServerConfig } from "../lib/api";

const FirebaseConfigModel = types.model("FirebaseConfig", {
  projectId: types.maybeNull(types.string),
  privateKey: types.maybeNull(types.string),
  clientEmail: types.maybeNull(types.string),
  projectIdSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  privateKeySource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  clientEmailSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
});

const TwilioConfigModel = types.model("TwilioConfig", {
  accountSid: types.maybeNull(types.string),
  authToken: types.maybeNull(types.string),
  phoneNumber: types.maybeNull(types.string),
  accountSidSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  authTokenSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  phoneNumberSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
});

const SchedulerConfigModel = types.model("SchedulerConfig", {
  timezone: types.maybeNull(types.string),
  enabled: types.maybeNull(types.boolean),
  timezoneSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  enabledSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
});

const AIConfigModel = types.model("AIConfig", {
  openaiApiKey: types.maybeNull(types.string),
  openaiEndpoint: types.maybeNull(types.string),
  selectedModels: types.optional(types.array(types.string), []),
  vlmModel: types.maybeNull(types.string),
  openaiApiKeySource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  openaiEndpointSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  vlmModelSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  selectedModelsSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
});

const AutoIngestConfigModel = types.model("AutoIngestConfig", {
  directory: types.maybeNull(types.string),
  directorySource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
});

const LegalResearchConfigModel = types.model("LegalResearchConfig", {
  courtListenerApiToken: types.maybeNull(types.string),
  legiscanApiKey: types.maybeNull(types.string),
  govInfoApiKey: types.maybeNull(types.string),
  serpapiBase: types.maybeNull(types.string),
  courtListenerApiTokenSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  legiscanApiKeySource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  govInfoApiKeySource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
  serpapiBaseSource: types.maybeNull(
    types.enumeration(["database", "environment"]),
  ),
});

const PromptsConfigModel = types.model("PromptsConfig", {
  chatSystemPrompt: types.maybeNull(types.string),
  caseSummaryPrompt: types.maybeNull(types.string),
  evaluatorPrompt: types.maybeNull(types.string),
  chatSystemPromptSource: types.maybeNull(
    types.enumeration(["database", "default"]),
  ),
  caseSummaryPromptSource: types.maybeNull(
    types.enumeration(["database", "default"]),
  ),
  evaluatorPromptSource: types.maybeNull(
    types.enumeration(["database", "default"]),
  ),
});

const ServerConfigModel = types.model("ServerConfigModel", {
  firebase: types.maybeNull(FirebaseConfigModel),
  twilio: types.maybeNull(TwilioConfigModel),
  scheduler: types.maybeNull(SchedulerConfigModel),
  ai: types.maybeNull(AIConfigModel),
  autoIngest: types.maybeNull(AutoIngestConfigModel),
  legalResearch: types.maybeNull(LegalResearchConfigModel),
  prompts: types.maybeNull(PromptsConfigModel),
});

export const ConfigStore = types
  .model("ConfigStore", {
    config: types.maybeNull(ServerConfigModel),
    isLoading: false,
    isTesting: false,
    error: types.maybeNull(types.string),
  })
  .actions((self) => ({
    loadConfig: flow(function* () {
      self.isLoading = true;
      self.error = null;
      try {
        const config: SnapshotIn<typeof ServerConfigModel> = yield api.config.get();
        self.config = ServerConfigModel.create(config);
      } catch (error) {
        self.error = String(error);
        console.error("Failed to load config:", error);
      } finally {
        self.isLoading = false;
      }
    }),

    updateConfig: flow(function* (updates: Partial<ServerConfig>) {
      self.isLoading = true;
      self.error = null;
      try {
        yield api.config.update(updates);
        // Reload to get updated values
        yield self.loadConfig();
      } catch (error) {
        self.error = String(error);
        console.error("Failed to update config:", error);
      } finally {
        self.isLoading = false;
      }
    }),

    resetConfig: flow(function* () {
      self.isLoading = true;
      self.error = null;
      try {
        yield api.config.reset();
        // Reload to get environment values
        yield self.loadConfig();
      } catch (error) {
        self.error = String(error);
        console.error("Failed to reset config:", error);
      } finally {
        self.isLoading = false;
      }
    }),

    deleteConfigKey: flow(function* (group: string, key: string) {
      self.isLoading = true;
      self.error = null;
      try {
        yield api.config.deleteKey(group, key);
        // Reload to get updated values
        yield self.loadConfig();
      } catch (error) {
        self.error = String(error);
        console.error("Failed to delete config key:", error);
      } finally {
        self.isLoading = false;
      }
    }),

    testFirebase: flow(function* () {
      self.isTesting = true;
      self.error = null;
      try {
        const result: { success: boolean; error?: string } =
          yield api.config.testFirebase();
        if (!result.success) {
          self.error = result.error || "Test failed";
        }
        return result;
      } catch (error) {
        self.error = String(error);
        console.error("Failed to test Firebase:", error);
        return { success: false, error: String(error) };
      } finally {
        self.isTesting = false;
      }
    }),

    testTwilio: flow(function* (testPhone: string) {
      self.isTesting = true;
      self.error = null;
      try {
        const result: { success: boolean; error?: string } =
          yield api.config.testTwilio(testPhone);
        if (!result.success) {
          self.error = result.error || "Test failed";
        }
        return result;
      } catch (error) {
        self.error = String(error);
        console.error("Failed to test Twilio:", error);
        return { success: false, error: String(error) };
      } finally {
        self.isTesting = false;
      }
    }),

    testOpenAI: flow(function* () {
      self.isTesting = true;
      self.error = null;
      try {
        const result: { success: boolean; error?: string } =
          yield api.config.testOpenAI();
        if (!result.success) {
          self.error = result.error || "Test failed";
        }
        return result;
      } catch (error) {
        self.error = String(error);
        console.error("Failed to test OpenAI:", error);
        return { success: false, error: String(error) };
      } finally {
        self.isTesting = false;
      }
    }),

    reinitializeService: flow(function* (service: string) {
      self.isLoading = true;
      self.error = null;
      try {
        yield api.config.reinitialize(service);
      } catch (error) {
        self.error = String(error);
        console.error(`Failed to reinitialize ${service}:`, error);
      } finally {
        self.isLoading = false;
      }
    }),
  }));
