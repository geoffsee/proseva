import admin from "firebase-admin";
import { db, type DeviceToken } from "../db";
import { getConfig } from "../config";

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;

  const projectId = getConfig("FIREBASE_PROJECT_ID");
  const privateKey = getConfig("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const clientEmail = getConfig("FIREBASE_CLIENT_EMAIL");

  if (!projectId || !privateKey || !clientEmail) {
    console.warn(
      "[firebase] Missing Firebase credentials. Push notifications disabled.",
    );
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey,
        clientEmail,
      }),
    });
    console.log("[firebase] Initialized successfully");
    return firebaseApp;
  } catch (error) {
    console.error("[firebase] Initialization failed:", error);
    return null;
  }
}

/**
 * Send push notification to all active device tokens
 */
export async function sendPushNotification(payload: {
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ success: boolean; sent: number; failed: number }> {
  const app = initializeFirebase();
  if (!app) {
    return { success: false, sent: 0, failed: 0 };
  }

  const activeTokens = [...db.deviceTokens.values()].filter((t) => t.active);

  if (activeTokens.length === 0) {
    console.log("[firebase] No active device tokens registered");
    return { success: true, sent: 0, failed: 0 };
  }

  const messaging = admin.messaging(app);
  let sent = 0;
  let failed = 0;

  for (const tokenRecord of activeTokens) {
    try {
      const message: admin.messaging.Message = {
        token: tokenRecord.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        // Platform-specific options
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "case-evaluations",
          },
        },
      };

      await messaging.send(message);
      sent++;
      console.log(`[firebase] Sent to ${tokenRecord.platform} device`);
    } catch (error: any) {
      failed++;
      console.error(
        `[firebase] Failed to send to device ${tokenRecord.id}:`,
        error.message,
      );

      // Deactivate invalid tokens
      if (
        error.code === "messaging/registration-token-not-registered" ||
        error.code === "messaging/invalid-registration-token"
      ) {
        tokenRecord.active = false;
        db.persist();
        console.log(`[firebase] Deactivated invalid token ${tokenRecord.id}`);
      }
    }
  }

  return {
    success: sent > 0 || failed === 0,
    sent,
    failed,
  };
}

/**
 * Register a new device token
 */
export function registerDeviceToken(
  token: string,
  platform: "ios" | "android" | "web",
): DeviceToken {
  // Check if token already exists
  const existing = [...db.deviceTokens.values()].find((t) => t.token === token);
  if (existing) {
    existing.active = true;
    db.persist();
    return existing;
  }

  const deviceToken: DeviceToken = {
    id: crypto.randomUUID(),
    token,
    platform,
    createdAt: new Date().toISOString(),
    active: true,
  };

  db.deviceTokens.set(deviceToken.id, deviceToken);
  db.persist();

  return deviceToken;
}

/**
 * Get all registered device tokens
 */
export function getDeviceTokens(): DeviceToken[] {
  return [...db.deviceTokens.values()];
}

/**
 * Remove a device token
 */
export function removeDeviceToken(id: string): boolean {
  const exists = db.deviceTokens.has(id);
  if (exists) {
    db.deviceTokens.delete(id);
    db.persist();
  }
  return exists;
}

/**
 * Check if Firebase is configured
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    getConfig("FIREBASE_PROJECT_ID") &&
    getConfig("FIREBASE_PRIVATE_KEY") &&
    getConfig("FIREBASE_CLIENT_EMAIL"),
  );
}

/**
 * Reinitialize Firebase after config change.
 * Destroys existing app instance and forces reinitialization.
 */
export async function reinitializeFirebase(): Promise<void> {
  if (firebaseApp) {
    try {
      await firebaseApp.delete();
      console.log("[firebase] Deleted existing app instance");
    } catch (error) {
      console.error("[firebase] Error deleting app:", error);
    }
    firebaseApp = null;
  }
  // Next call to initializeFirebase() will create new instance with updated config
  initializeFirebase();
}

/**
 * Test Firebase connection by attempting to send a test message.
 */
export async function testFirebaseConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const app = initializeFirebase();
    if (!app) {
      return { success: false, error: "Firebase not configured" };
    }

    const activeTokens = [...db.deviceTokens.values()].filter((t) => t.active);
    if (activeTokens.length === 0) {
      return {
        success: false,
        error:
          "No active device tokens registered. Please register a device first.",
      };
    }

    // Test with first active token
    const messaging = admin.messaging(app);
    const testToken = activeTokens[0];

    await messaging.send({
      token: testToken.token,
      notification: {
        title: "Test Notification",
        body: "Firebase connection test successful!",
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}
