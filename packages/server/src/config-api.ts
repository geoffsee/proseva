import { AutoRouter } from "itty-router";
import { db } from "./db";
import {
  getConfig,
  faxGatewayConfig,
  invalidateConfigCache,
  loadConfigFromDatabase,
} from "./config";
import {
  reinitializeFirebase,
  testFirebaseConnection,
} from "./notifications/firebase";
import {
  reinitializeTwilio,
  testTwilioConnection,
} from "./notifications/twilio";
import { restartScheduler } from "./scheduler";
import { testOpenAIConnection } from "./reports";
import { asIttyRoute, json, openapiFormat } from "./openapi";

/**
 * Build a minimal valid PDF containing a test message.
 */
function buildTestPdf(): Uint8Array {
  const text = `Pro Se VA - Fax Gateway Test - ${new Date().toISOString()}`;
  // Minimal PDF 1.4 with one page and one text line
  const stream = `BT /F1 16 Tf 50 700 Td (${text}) Tj ET`;
  const lines = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj`,
    `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "xref",
    "0 6",
    "trailer<</Size 6/Root 1 0 R>>",
    "startxref",
    "0",
    "%%EOF",
  ];
  return new TextEncoder().encode(lines.join("\n"));
}

const router = AutoRouter({ base: "/api", format: openapiFormat });

function buildOpenAIModelsUrl(endpoint?: string): string {
  const fallback = "https://api.openai.com/v1/models";
  if (!endpoint) return fallback;

  const raw = endpoint.trim();
  if (!raw) return fallback;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  const url = new URL(normalized);
  const path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/v1/models")) return url.toString();

  const segments = path.split("/").filter(Boolean);
  const v1Index = segments.lastIndexOf("v1");
  const basePath =
    v1Index >= 0
      ? `/${segments.slice(0, v1Index + 1).join("/")}`
      : path
        ? `${path}/v1`
        : "/v1";

  url.pathname = `${basePath}/models`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function extractOpenAIModels(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const ids = data
    .map((item) =>
      item && typeof item === "object"
        ? (item as { id?: unknown }).id
        : undefined,
    )
    .filter((id): id is string => typeof id === "string");
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function openAIErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }
  }
  return fallback;
}

/**
 * Mask sensitive values for display.
 * Shows last 4 characters: "••••••key"
 */
function maskSensitiveValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 4) return "••••";
  return "••••••" + value.slice(-4);
}

/**
 * Check if a value is a masked placeholder (should not be saved to DB).
 */
function isMaskedValue(value: unknown): boolean {
  return typeof value === "string" && value.includes("••");
}

/**
 * Strip masked placeholder values from an object so they don't overwrite
 * real secrets in the database.
 */
function stripMaskedValues<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!isMaskedValue(value)) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Get current configuration with masked sensitive values.
 */
router.get(
  "/config",
  asIttyRoute("get", "/config", () => {
  const config = loadConfigFromDatabase();
  const envConfig = {
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },
    scheduler: {
      timezone: process.env.EVALUATION_TIMEZONE || "America/New_York",
      enabled: process.env.EVALUATION_ENABLED !== "false",
    },
    ai: {
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiEndpoint: process.env.OPENAI_ENDPOINT,
    },
    autoIngest: {
      directory: process.env.AUTO_INGEST_DIR,
    },
    legalResearch: {
      courtListenerApiToken: process.env.COURTLISTENER_API_TOKEN,
      legiscanApiKey: process.env.LEGISCAN_API_KEY,
      govInfoApiKey: process.env.GOVINFO_API_KEY,
      serpapiBase: process.env.SERPAPI_BASE,
      serpapiApiKey: process.env.SERPAPI_API_KEY,
    },
    faxGateway: {
      url: process.env.FAX_GATEWAY_URL,
      username: process.env.FAX_GATEWAY_USERNAME,
      password: process.env.FAX_GATEWAY_PASSWORD,
    },
    documentScanner: {
      enabled: process.env.SCANNER_ENABLED === "true",
      endpoints: process.env.SCANNER_ENDPOINTS,
      outputDirectory: process.env.SCANNER_OUTPUT_DIR,
    },
  };

  // Merge config with environment fallbacks and mask sensitive fields
  const response = {
    firebase: {
      projectId: config?.firebase?.projectId || envConfig.firebase.projectId,
      privateKey: maskSensitiveValue(
        config?.firebase?.privateKey || envConfig.firebase.privateKey,
      ),
      clientEmail:
        config?.firebase?.clientEmail || envConfig.firebase.clientEmail,
      // Indicate source
      projectIdSource: config?.firebase?.projectId ? "database" : "environment",
      privateKeySource: config?.firebase?.privateKey
        ? "database"
        : "environment",
      clientEmailSource: config?.firebase?.clientEmail
        ? "database"
        : "environment",
    },
    twilio: {
      accountSid: maskSensitiveValue(
        config?.twilio?.accountSid || envConfig.twilio.accountSid,
      ),
      authToken: maskSensitiveValue(
        config?.twilio?.authToken || envConfig.twilio.authToken,
      ),
      phoneNumber: config?.twilio?.phoneNumber || envConfig.twilio.phoneNumber,
      accountSidSource: config?.twilio?.accountSid ? "database" : "environment",
      authTokenSource: config?.twilio?.authToken ? "database" : "environment",
      phoneNumberSource: config?.twilio?.phoneNumber
        ? "database"
        : "environment",
    },
    scheduler: {
      timezone: config?.scheduler?.timezone || envConfig.scheduler.timezone,
      enabled: config?.scheduler?.enabled ?? envConfig.scheduler.enabled,
      timezoneSource: config?.scheduler?.timezone ? "database" : "environment",
      enabledSource:
        config?.scheduler?.enabled !== undefined ? "database" : "environment",
    },
    ai: {
      openaiApiKey: maskSensitiveValue(
        config?.ai?.openaiApiKey || envConfig.ai.openaiApiKey,
      ),
      openaiEndpoint: config?.ai?.openaiEndpoint || envConfig.ai.openaiEndpoint,
      openaiApiKeySource: config?.ai?.openaiApiKey ? "database" : "environment",
      openaiEndpointSource: config?.ai?.openaiEndpoint
        ? "database"
        : "environment",
    },
    autoIngest: {
      directory:
        config?.autoIngest?.directory || envConfig.autoIngest.directory,
      directorySource: config?.autoIngest?.directory
        ? "database"
        : "environment",
    },
    legalResearch: {
      courtListenerApiToken: maskSensitiveValue(
        config?.legalResearch?.courtListenerApiToken ||
          envConfig.legalResearch.courtListenerApiToken,
      ),
      legiscanApiKey: maskSensitiveValue(
        config?.legalResearch?.legiscanApiKey ||
          envConfig.legalResearch.legiscanApiKey,
      ),
      govInfoApiKey: maskSensitiveValue(
        config?.legalResearch?.govInfoApiKey ||
          envConfig.legalResearch.govInfoApiKey,
      ),
      serpapiBase:
        config?.legalResearch?.serpapiBase ||
        envConfig.legalResearch.serpapiBase,
      serpapiApiKey: maskSensitiveValue(
        config?.legalResearch?.serpapiApiKey ||
          envConfig.legalResearch.serpapiApiKey,
      ),
      courtListenerApiTokenSource: config?.legalResearch?.courtListenerApiToken
        ? "database"
        : "environment",
      legiscanApiKeySource: config?.legalResearch?.legiscanApiKey
        ? "database"
        : "environment",
      govInfoApiKeySource: config?.legalResearch?.govInfoApiKey
        ? "database"
        : "environment",
      serpapiBaseSource: config?.legalResearch?.serpapiBase
        ? "database"
        : "environment",
      serpapiApiKeySource: config?.legalResearch?.serpapiApiKey
        ? "database"
        : "environment",
    },
    prompts: {
      chatSystemPrompt: config?.prompts?.chatSystemPrompt,
      caseSummaryPrompt: config?.prompts?.caseSummaryPrompt,
      evaluatorPrompt: config?.prompts?.evaluatorPrompt,
      chatSystemPromptSource: config?.prompts?.chatSystemPrompt
        ? "database"
        : "default",
      caseSummaryPromptSource: config?.prompts?.caseSummaryPrompt
        ? "database"
        : "default",
      evaluatorPromptSource: config?.prompts?.evaluatorPrompt
        ? "database"
        : "default",
    },
    faxGateway: {
      url: config?.faxGateway?.url || envConfig.faxGateway.url,
      username: config?.faxGateway?.username || envConfig.faxGateway.username,
      password: maskSensitiveValue(
        config?.faxGateway?.password || envConfig.faxGateway.password,
      ),
      urlSource: config?.faxGateway?.url ? "database" : "environment",
      usernameSource: config?.faxGateway?.username
        ? "database"
        : "environment",
      passwordSource: config?.faxGateway?.password
        ? "database"
        : "environment",
    },
    documentScanner: {
      enabled:
        config?.documentScanner?.enabled ?? envConfig.documentScanner.enabled,
      endpoints:
        config?.documentScanner?.endpoints ||
        envConfig.documentScanner.endpoints,
      outputDirectory:
        config?.documentScanner?.outputDirectory ||
        envConfig.documentScanner.outputDirectory,
      enabledSource:
        config?.documentScanner?.enabled !== undefined
          ? "database"
          : "environment",
      endpointsSource: config?.documentScanner?.endpoints
        ? "database"
        : "environment",
      outputDirectorySource: config?.documentScanner?.outputDirectory
        ? "database"
        : "environment",
    },
  };

  return response;
}),
);

/**
 * Update configuration (partial updates supported).
 */
router.patch(
  "/config",
  asIttyRoute("patch", "/config", async (req) => {
    try {
      const updates = await req.json();

    // Get existing config or create new one
    let config = db.serverConfig.get("singleton");
    if (!config) {
      config = {
        id: "singleton",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      config = { ...config, updatedAt: new Date().toISOString() };
    }

    // Merge updates (strip masked placeholder values so they don't
    // overwrite real secrets stored in the database)
    if (updates.firebase) {
      config.firebase = {
        ...config.firebase,
        ...stripMaskedValues(updates.firebase),
      };
    }
    if (updates.twilio) {
      config.twilio = {
        ...config.twilio,
        ...stripMaskedValues(updates.twilio),
      };
    }
    if (updates.scheduler) {
      config.scheduler = { ...config.scheduler, ...updates.scheduler };
    }
    if (updates.ai) {
      config.ai = { ...config.ai, ...stripMaskedValues(updates.ai) };
    }
    if (updates.autoIngest) {
      config.autoIngest = { ...config.autoIngest, ...updates.autoIngest };
    }
    if (updates.legalResearch) {
      config.legalResearch = {
        ...config.legalResearch,
        ...stripMaskedValues(updates.legalResearch),
      };
    }
    if (updates.prompts) {
      config.prompts = { ...config.prompts, ...updates.prompts };
    }
    if (updates.faxGateway) {
      config.faxGateway = {
        ...config.faxGateway,
        ...stripMaskedValues(updates.faxGateway),
      };
    }
    if (updates.documentScanner) {
      config.documentScanner = {
        ...config.documentScanner,
        ...updates.documentScanner,
      };
    }

    // Save to database
    db.serverConfig.set("singleton", config);
    db.persist();

    // Invalidate cache
    invalidateConfigCache();

      return { success: true, config };
    } catch (error) {
      return json(400, { success: false, error: String(error) });
    }
  }),
);

/**
 * Reset all configuration (clear database overrides).
 */
router.post(
  "/config/reset",
  asIttyRoute("post", "/config/reset", () => {
    db.serverConfig.delete("singleton");
    db.persist();
    invalidateConfigCache();
    return { success: true };
  }),
);

/**
 * Delete specific configuration override.
 */
router.delete(
  "/config/:group/:key",
  asIttyRoute("delete", "/config/:group/:key", (req) => {
    const { group, key } = req.params;
    const config = db.serverConfig.get("singleton");

    if (!config) {
      return json(404, { success: false, error: "No configuration found" });
    }

    // Remove specific key
    if (group === "firebase" && config.firebase) {
      const firebase = config.firebase as Record<string, unknown>;
      delete firebase[key];
    } else if (group === "twilio" && config.twilio) {
      const twilio = config.twilio as Record<string, unknown>;
      delete twilio[key];
    } else if (group === "scheduler" && config.scheduler) {
      const scheduler = config.scheduler as Record<string, unknown>;
      delete scheduler[key];
    } else if (group === "ai" && config.ai) {
      const ai = config.ai as Record<string, unknown>;
      delete ai[key];
    } else if (group === "autoIngest" && config.autoIngest) {
      const autoIngest = config.autoIngest as Record<string, unknown>;
      delete autoIngest[key];
    } else if (group === "legalResearch" && config.legalResearch) {
      const legalResearch = config.legalResearch as Record<string, unknown>;
      delete legalResearch[key];
    } else if (group === "faxGateway" && config.faxGateway) {
      const faxGateway = config.faxGateway as Record<string, unknown>;
      delete faxGateway[key];
    } else if (group === "documentScanner" && config.documentScanner) {
      const documentScanner = config.documentScanner as Record<string, unknown>;
      delete documentScanner[key];
    }

    config.updatedAt = new Date().toISOString();
    db.serverConfig.set("singleton", config);
    db.persist();
    invalidateConfigCache();

    return { success: true };
  }),
);

/**
 * Test Firebase connection.
 */
router.post(
  "/config/test-firebase",
  asIttyRoute("post", "/config/test-firebase", async () => {
    try {
      const result = await testFirebaseConnection();
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }),
);

/**
 * Test Twilio connection.
 */
router.post(
  "/config/test-twilio",
  asIttyRoute("post", "/config/test-twilio", async (req) => {
    try {
      const body = await req.json();
      const testPhone = body.testPhone;

      if (!testPhone) {
        return json(400, {
          success: false,
          error: "testPhone required in request body",
        });
      }

      const result = await testTwilioConnection(testPhone);
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }),
);

/**
 * Test OpenAI connection.
 */
router.post(
  "/config/test-openai",
  asIttyRoute("post", "/config/test-openai", async () => {
    try {
      const result = await testOpenAIConnection();
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }),
);

/**
 * List available OpenAI-compatible models from /v1/models.
 */
router.get(
  "/config/openai-models",
  asIttyRoute("get", "/config/openai-models", async (req) => {
    const apiKey = getConfig("OPENAI_API_KEY");
    if (!apiKey) {
      return json(400, {
        success: false,
        models: [],
        error: "OpenAI API key not configured",
      });
    }

    const endpointOverride = new URL(req.url).searchParams.get("endpoint");

    let modelsUrl: string;
    try {
      modelsUrl = buildOpenAIModelsUrl(
        endpointOverride || getConfig("OPENAI_ENDPOINT"),
      );
    } catch {
      return json(400, {
        success: false,
        models: [],
        error: "Invalid OpenAI endpoint URL",
      });
    }

    try {
      const response = await fetch(modelsUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      const rawText = await response.text();
      let payload: unknown = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        return json(502, {
          success: false,
          models: [],
          error: openAIErrorMessage(
            payload,
            `Model listing failed: HTTP ${response.status}`,
          ),
          status: response.status,
        });
      }

      return {
        success: true,
        models: extractOpenAIModels(payload),
        endpoint: modelsUrl,
      };
    } catch (error) {
      return json(502, {
        success: false,
        models: [],
        error: `Failed to fetch models: ${String(error)}`,
      });
    }
  }),
);

/**
 * Test fax gateway connection by sending a test fax.
 */
router.post(
  "/config/test-fax",
  asIttyRoute("post", "/config/test-fax", async (req) => {
    try {
      const body = await req.json();
      const recipientNumber: string | undefined = body.recipientNumber;

      if (!recipientNumber) {
        return json(400, {
          success: false,
          error: "recipientNumber required in request body",
        });
      }

      const cfg = faxGatewayConfig();
      if (!cfg.url) {
        return json(400, {
          success: false,
          error: "Fax gateway URL not configured",
        });
      }

      // Build basic auth header
      const headers: Record<string, string> = {};
      if (cfg.username && cfg.password) {
        headers["Authorization"] =
          "Basic " +
          Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
      }

      // Generate a minimal test PDF
      const testPdf = buildTestPdf();

      // Send as multipart form data (matching: curl -F "to=..." -F "file=@...")
      const form = new FormData();
      form.append("to", recipientNumber);
      form.append(
        "file",
        new Blob([testPdf as unknown as BlobPart], { type: "application/pdf" }),
        "test-fax.pdf",
      );

      const gatewayUrl = cfg.url.replace(/\/+$/, "") + "/fax/send";
      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers,
        body: form,
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        return { success: true, result };
      }

      return {
        success: false,
        error:
          result.error ||
          result.message ||
          `Gateway returned HTTP ${response.status}`,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }),
);

/**
 * Test document scanner connection.
 */
router.post(
  "/config/test-scanner",
  asIttyRoute("post", "/config/test-scanner", async () => {
    try {
      const { testScannerConnection } = await import("./scanner");
      const result = await testScannerConnection();
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }),
);

/**
 * Reinitialize a service after config change.
 */
router.post(
  "/config/reinitialize/:service",
  asIttyRoute("post", "/config/reinitialize/:service", async (req) => {
    const { service } = req.params;

    try {
      invalidateConfigCache();

      if (service === "firebase") {
        await reinitializeFirebase();
      } else if (service === "twilio") {
        await reinitializeTwilio();
      } else if (service === "scheduler") {
        await restartScheduler();
      } else if (service === "scanner") {
        const { restartScanner } = await import("./scanner");
        restartScanner();
      } else {
        return json(400, { success: false, error: `Unknown service: ${service}` });
      }

      return { success: true };
    } catch (error) {
      return json(500, { success: false, error: String(error) });
    }
  }),
);

export { router as configRouter };
