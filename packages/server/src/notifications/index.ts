import {
  sendPushNotification,
  isFirebaseConfigured,
  registerDeviceToken,
  getDeviceTokens,
  removeDeviceToken,
} from "./firebase";
import {
  sendSms,
  formatSmsMessage,
  isTwilioConfigured,
  registerSmsRecipient,
  getSmsRecipients,
  removeSmsRecipient,
} from "./twilio";
import { markEvaluationSent, markEvaluationFailed } from "../evaluator";
import type { Evaluation } from "../db";

export {
  registerDeviceToken,
  getDeviceTokens,
  removeDeviceToken,
  isFirebaseConfigured,
  registerSmsRecipient,
  getSmsRecipients,
  removeSmsRecipient,
  isTwilioConfigured,
};

/**
 * Send notification through all configured channels
 */
export async function sendNotification(evaluation: Evaluation): Promise<{
  pushSent: boolean;
  smsSent: boolean;
}> {
  const { notification, analysis } = evaluation;
  let pushSent = false;
  let smsSent = false;

  // Send push notification
  if (isFirebaseConfigured()) {
    try {
      const pushResult = await sendPushNotification({
        title: notification.title,
        body: notification.body,
        data: {
          type: "daily_evaluation",
          evaluationId: evaluation.id,
          overdueCount: String(analysis.overdueDeadlines.length),
          deepLink: `/evaluations/${evaluation.id}`,
        },
      });
      pushSent = pushResult.success && pushResult.sent > 0;
      console.log(
        `[notifications] Push: ${pushResult.sent} sent, ${pushResult.failed} failed`,
      );
    } catch (error) {
      console.error("[notifications] Push notification error:", error);
    }
  } else {
    console.log("[notifications] Firebase not configured, skipping push");
  }

  // Send SMS
  if (isTwilioConfigured()) {
    try {
      const smsMessage = formatSmsMessage({
        title: notification.title,
        body: notification.body,
        aiSummary: analysis.aiSummary,
      });
      const smsResult = await sendSms(smsMessage);
      smsSent = smsResult.success && smsResult.sent > 0;
      console.log(
        `[notifications] SMS: ${smsResult.sent} sent, ${smsResult.failed} failed`,
      );
    } catch (error) {
      console.error("[notifications] SMS error:", error);
    }
  } else {
    console.log("[notifications] Twilio not configured, skipping SMS");
  }

  // Update evaluation status
  if (pushSent || smsSent) {
    markEvaluationSent(evaluation.id, { pushSent, smsSent });
  } else if (!isFirebaseConfigured() && !isTwilioConfigured()) {
    // No channels configured - mark as sent anyway (nothing to send to)
    markEvaluationSent(evaluation.id, { pushSent: false, smsSent: false });
  } else {
    // Channels configured but all failed
    markEvaluationFailed(evaluation.id, "All notification channels failed");
  }

  return { pushSent, smsSent };
}

/**
 * Get notification channels status
 */
export function getChannelsStatus(): {
  firebase: { configured: boolean; tokenCount: number };
  twilio: { configured: boolean; recipientCount: number };
} {
  return {
    firebase: {
      configured: isFirebaseConfigured(),
      tokenCount: getDeviceTokens().filter((t) => t.active).length,
    },
    twilio: {
      configured: isTwilioConfigured(),
      recipientCount: getSmsRecipients().filter((r) => r.active).length,
    },
  };
}
