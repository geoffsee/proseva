import { Router } from "itty-router";
import { db } from "./db";
import type { ServerConfig } from "./db";
import { invalidateConfigCache, loadConfigFromDatabase } from "./config";
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

const router = Router({ base: "/api/config" });

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
 * Get current configuration with masked sensitive values.
 */
router.get("/", () => {
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
  };

  return Response.json(response);
});

/**
 * Update configuration (partial updates supported).
 */
router.patch("/", async (req) => {
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

    // Merge updates
    if (updates.firebase) {
      config.firebase = { ...config.firebase, ...updates.firebase };
    }
    if (updates.twilio) {
      config.twilio = { ...config.twilio, ...updates.twilio };
    }
    if (updates.scheduler) {
      config.scheduler = { ...config.scheduler, ...updates.scheduler };
    }
    if (updates.ai) {
      config.ai = { ...config.ai, ...updates.ai };
    }
    if (updates.autoIngest) {
      config.autoIngest = { ...config.autoIngest, ...updates.autoIngest };
    }

    // Save to database
    db.serverConfig.set("singleton", config);
    db.persist();

    // Invalidate cache
    invalidateConfigCache();

    return Response.json({ success: true, config });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 400 },
    );
  }
});

/**
 * Reset all configuration (clear database overrides).
 */
router.post("/reset", () => {
  db.serverConfig.delete("singleton");
  db.persist();
  invalidateConfigCache();
  return Response.json({ success: true });
});

/**
 * Delete specific configuration override.
 */
router.delete("/:group/:key", (req) => {
  const { group, key } = req.params;
  const config = db.serverConfig.get("singleton");

  if (!config) {
    return Response.json(
      { success: false, error: "No configuration found" },
      { status: 404 },
    );
  }

  // Remove specific key
  if (group === "firebase" && config.firebase) {
    delete (config.firebase as any)[key];
  } else if (group === "twilio" && config.twilio) {
    delete (config.twilio as any)[key];
  } else if (group === "scheduler" && config.scheduler) {
    delete (config.scheduler as any)[key];
  } else if (group === "ai" && config.ai) {
    delete (config.ai as any)[key];
  } else if (group === "autoIngest" && config.autoIngest) {
    delete (config.autoIngest as any)[key];
  }

  config.updatedAt = new Date().toISOString();
  db.serverConfig.set("singleton", config);
  db.persist();
  invalidateConfigCache();

  return Response.json({ success: true });
});

/**
 * Test Firebase connection.
 */
router.post("/test-firebase", async () => {
  try {
    const result = await testFirebaseConnection();
    return Response.json(result);
  } catch (error) {
    return Response.json({ success: false, error: String(error) });
  }
});

/**
 * Test Twilio connection.
 */
router.post("/test-twilio", async (req) => {
  try {
    const body = await req.json();
    const testPhone = body.testPhone;

    if (!testPhone) {
      return Response.json(
        { success: false, error: "testPhone required in request body" },
        { status: 400 },
      );
    }

    const result = await testTwilioConnection(testPhone);
    return Response.json(result);
  } catch (error) {
    return Response.json({ success: false, error: String(error) });
  }
});

/**
 * Test OpenAI connection.
 */
router.post("/test-openai", async () => {
  try {
    const result = await testOpenAIConnection();
    return Response.json(result);
  } catch (error) {
    return Response.json({ success: false, error: String(error) });
  }
});

/**
 * Reinitialize a service after config change.
 */
router.post("/reinitialize/:service", async (req) => {
  const { service } = req.params;

  try {
    invalidateConfigCache();

    if (service === "firebase") {
      await reinitializeFirebase();
    } else if (service === "twilio") {
      await reinitializeTwilio();
    } else if (service === "scheduler") {
      await restartScheduler();
    } else {
      return Response.json(
        { success: false, error: `Unknown service: ${service}` },
        { status: 400 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: String(error) });
  }
});

export { router as configRouter };
