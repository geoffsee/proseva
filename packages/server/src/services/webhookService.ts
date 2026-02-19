export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
}

export function createDocumentGeneratedPayload(
  documentId: string,
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return { event: "document.generated", documentId, metadata };
}

export async function triggerWebhookWithRetry(
  config: WebhookConfig,
  payload: Record<string, unknown>,
  maxRetries = 3,
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...config.headers,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return { success: true };
    } catch {
      // retry
    }
  }
  return { success: false, error: "Webhook delivery failed after retries" };
}
