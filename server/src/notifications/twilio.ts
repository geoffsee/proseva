import Twilio from "twilio";
import { db, type SmsRecipient } from "../db";
import { getConfig } from "../config";

let twilioClient: Twilio.Twilio | null = null;

/**
 * Initialize Twilio client
 */
function initializeTwilio(): Twilio.Twilio | null {
  if (twilioClient) return twilioClient;

  const accountSid = getConfig("TWILIO_ACCOUNT_SID");
  const authToken = getConfig("TWILIO_AUTH_TOKEN");
  const phoneNumber = getConfig("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !phoneNumber) {
    console.warn(
      "[twilio] Missing Twilio credentials. SMS notifications disabled.",
    );
    return null;
  }

  try {
    twilioClient = Twilio(accountSid, authToken);
    console.log("[twilio] Initialized successfully");
    return twilioClient;
  } catch (error) {
    console.error("[twilio] Initialization failed:", error);
    return null;
  }
}

interface TwilioError {
  code?: number;
  message?: string;
}

/**
 * Send SMS to all active recipients
 */
export async function sendSms(message: string): Promise<{
  success: boolean;
  sent: number;
  failed: number;
}> {
  const client = initializeTwilio();
  const fromNumber = getConfig("TWILIO_PHONE_NUMBER");

  if (!client || !fromNumber) {
    return { success: false, sent: 0, failed: 0 };
  }

  const activeRecipients = [...db.smsRecipients.values()].filter(
    (r) => r.active,
  );

  if (activeRecipients.length === 0) {
    console.log("[twilio] No active SMS recipients registered");
    return { success: true, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const recipient of activeRecipients) {
    try {
      await client.messages.create({
        body: message,
        from: fromNumber,
        to: recipient.phone,
      });
      sent++;
      console.log(`[twilio] Sent SMS to ${recipient.name || recipient.phone}`);
    } catch (error: unknown) {
      failed++;
      const twError = error as TwilioError;
      console.error(
        `[twilio] Failed to send to ${recipient.phone}:`,
        twError.message || String(error),
      );

      // Deactivate invalid numbers
      if (twError.code === 21211 || twError.code === 21614) {
        // Invalid phone number or unsubscribed
        recipient.active = false;
        db.persist();
        console.log(`[twilio] Deactivated invalid recipient ${recipient.id}`);
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
 * Format notification for SMS (shorter than push)
 */
export function formatSmsMessage(notification: {
  title: string;
  body: string;
  aiSummary?: string;
}): string {
  // SMS has 160 character limit for single message
  // Keep it concise but informative
  const parts: string[] = [];

  parts.push(notification.title);

  if (notification.body) {
    parts.push(notification.body);
  }

  let message = parts.join("\n");

  // Truncate if too long
  if (message.length > 300) {
    message = message.substring(0, 297) + "...";
  }

  return message;
}

/**
 * Register a new SMS recipient
 */
export function registerSmsRecipient(
  phone: string,
  name?: string,
): SmsRecipient {
  // Normalize phone number to E.164 format
  const normalizedPhone = normalizePhoneNumber(phone);

  // Check if phone already exists
  const existing = [...db.smsRecipients.values()].find(
    (r) => r.phone === normalizedPhone,
  );
  if (existing) {
    existing.active = true;
    if (name) existing.name = name;
    db.persist();
    return existing;
  }

  const recipient: SmsRecipient = {
    id: crypto.randomUUID(),
    phone: normalizedPhone,
    name,
    createdAt: new Date().toISOString(),
    active: true,
  };

  db.smsRecipients.set(recipient.id, recipient);
  db.persist();

  return recipient;
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If no country code, assume US (+1)
  if (!cleaned.startsWith("+")) {
    if (cleaned.length === 10) {
      cleaned = "+1" + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      cleaned = "+" + cleaned;
    }
  }

  return cleaned;
}

/**
 * Get all registered SMS recipients
 */
export function getSmsRecipients(): SmsRecipient[] {
  return [...db.smsRecipients.values()];
}

/**
 * Remove an SMS recipient
 */
export function removeSmsRecipient(id: string): boolean {
  const exists = db.smsRecipients.has(id);
  if (exists) {
    db.smsRecipients.delete(id);
    db.persist();
  }
  return exists;
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  return Boolean(
    getConfig("TWILIO_ACCOUNT_SID") &&
    getConfig("TWILIO_AUTH_TOKEN") &&
    getConfig("TWILIO_PHONE_NUMBER"),
  );
}

/**
 * Reinitialize Twilio after config change.
 * Destroys existing client instance and forces reinitialization.
 */
export async function reinitializeTwilio(): Promise<void> {
  twilioClient = null;
  // Next call to initializeTwilio() will create new instance with updated config
  initializeTwilio();
}

/**
 * Test Twilio connection by sending a test SMS.
 */
export async function testTwilioConnection(
  testPhone: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = initializeTwilio();
    const fromNumber = getConfig("TWILIO_PHONE_NUMBER");

    if (!client || !fromNumber) {
      return { success: false, error: "Twilio not configured" };
    }

    // Normalize and validate test phone number
    const normalizedPhone = normalizePhoneNumber(testPhone);

    await client.messages.create({
      body: "Test SMS from Pro Se VA: Twilio connection successful!",
      from: fromNumber,
      to: normalizedPhone,
    });

    return { success: true };
  } catch (error: unknown) {
    const twError = error as TwilioError;
    return { success: false, error: twError.message || String(error) };
  }
}
