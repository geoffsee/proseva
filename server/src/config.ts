import { db } from "./db";
import type { ServerConfig } from "./db";

// In-memory cache for configuration
let configCache: ServerConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5000; // 5 seconds

/**
 * Load configuration from database.
 * Returns the singleton config record or null if not set.
 */
export function loadConfigFromDatabase(): ServerConfig | null {
  // During module startup, getConfig() can be called before initDb() has set
  // the exported db instance. In that case, treat DB config as unavailable and
  // fall back to environment variables.
  const serverConfig = (db as any)?.serverConfig as
    | Map<string, ServerConfig>
    | undefined;
  if (!serverConfig) return null;

  const config = serverConfig.get("singleton");
  if (config) {
    configCache = config;
    cacheTimestamp = Date.now();
  }
  return config ?? null;
}

/**
 * Get a configuration value with database override priority.
 * Priority: Database config > Environment variable
 */
export function getConfig(key: string): string | undefined {
  // Refresh cache if expired
  const now = Date.now();
  if (!configCache || now - cacheTimestamp > CACHE_TTL) {
    loadConfigFromDatabase();
  }

  // Check database config first
  if (configCache) {
    // Firebase keys
    if (key === "FIREBASE_PROJECT_ID" && configCache.firebase?.projectId) {
      return configCache.firebase.projectId;
    }
    if (key === "FIREBASE_PRIVATE_KEY" && configCache.firebase?.privateKey) {
      return configCache.firebase.privateKey;
    }
    if (key === "FIREBASE_CLIENT_EMAIL" && configCache.firebase?.clientEmail) {
      return configCache.firebase.clientEmail;
    }

    // Twilio keys
    if (key === "TWILIO_ACCOUNT_SID" && configCache.twilio?.accountSid) {
      return configCache.twilio.accountSid;
    }
    if (key === "TWILIO_AUTH_TOKEN" && configCache.twilio?.authToken) {
      return configCache.twilio.authToken;
    }
    if (key === "TWILIO_PHONE_NUMBER" && configCache.twilio?.phoneNumber) {
      return configCache.twilio.phoneNumber;
    }

    // Scheduler keys
    if (key === "EVALUATION_TIMEZONE" && configCache.scheduler?.timezone) {
      return configCache.scheduler.timezone;
    }
    if (
      key === "EVALUATION_ENABLED" &&
      configCache.scheduler?.enabled !== undefined
    ) {
      return configCache.scheduler.enabled.toString();
    }

    // AI keys
    if (key === "OPENAI_API_KEY" && configCache.ai?.openaiApiKey) {
      return configCache.ai.openaiApiKey;
    }
    if (key === "OPENAI_ENDPOINT" && configCache.ai?.openaiEndpoint) {
      return configCache.ai.openaiEndpoint;
    }
    if (key === "VLM_MODEL" && configCache.ai?.vlmModel) {
      return configCache.ai.vlmModel;
    }

    // Auto-ingest keys
    if (key === "AUTO_INGEST_DIR" && configCache.autoIngest?.directory) {
      return configCache.autoIngest.directory;
    }

    // Legal research keys
    if (
      key === "COURTLISTENER_API_TOKEN" &&
      configCache.legalResearch?.courtListenerApiToken
    ) {
      return configCache.legalResearch.courtListenerApiToken;
    }
    if (
      key === "LEGISCAN_API_KEY" &&
      configCache.legalResearch?.legiscanApiKey
    ) {
      return configCache.legalResearch.legiscanApiKey;
    }
    if (key === "GOVINFO_API_KEY" && configCache.legalResearch?.govInfoApiKey) {
      return configCache.legalResearch.govInfoApiKey;
    }
    if (key === "SERPAPI_BASE" && configCache.legalResearch?.serpapiBase) {
      return configCache.legalResearch.serpapiBase;
    }
  }

  // Fallback to environment variable
  return process.env[key];
}

/**
 * Clear the configuration cache.
 * Call this after updating database config to force reload.
 */
export function invalidateConfigCache(): void {
  configCache = null;
  cacheTimestamp = 0;
}

/**
 * Get Firebase configuration.
 */
export function firebaseConfig() {
  return {
    projectId: getConfig("FIREBASE_PROJECT_ID"),
    privateKey: getConfig("FIREBASE_PRIVATE_KEY"),
    clientEmail: getConfig("FIREBASE_CLIENT_EMAIL"),
  };
}

/**
 * Get Twilio configuration.
 */
export function twilioConfig() {
  return {
    accountSid: getConfig("TWILIO_ACCOUNT_SID"),
    authToken: getConfig("TWILIO_AUTH_TOKEN"),
    phoneNumber: getConfig("TWILIO_PHONE_NUMBER"),
  };
}

/**
 * Get scheduler configuration.
 */
export function schedulerConfig() {
  const timezone = getConfig("EVALUATION_TIMEZONE") || "America/New_York";
  const enabled = getConfig("EVALUATION_ENABLED") !== "false"; // Default true
  return { timezone, enabled };
}

/**
 * Get AI configuration.
 */
export function aiConfig() {
  return {
    apiKey: getConfig("OPENAI_API_KEY"),
    endpoint: getConfig("OPENAI_ENDPOINT"),
    selectedModels: getConfig("SELECTED_MODELS")?.split(",") || [],
  };
}

/**
 * Get auto-ingest configuration.
 */
export function autoIngestConfig() {
  return {
    directory: getConfig("AUTO_INGEST_DIR"),
  };
}

/**
 * Get legal research API configuration.
 */
export function legalResearchConfig() {
  return {
    courtListenerApiToken: getConfig("COURTLISTENER_API_TOKEN"),
    legiscanApiKey: getConfig("LEGISCAN_API_KEY"),
    govInfoApiKey: getConfig("GOVINFO_API_KEY"),
    serpapiBase: getConfig("SERPAPI_BASE"),
  };
}
