import type {
  FaxProvider,
  FaxSendOptions,
  FaxSendResult,
  FaxStatusResult,
} from "./types";

export interface InternetFaxProviderConfig {
  url: string;
  username?: string;
  password?: string;
}

/**
 * Fax provider that delegates to an internet-fax-machine gateway.
 * Uses the gateway's POST /fax/send (multipart or JSON) endpoint.
 */
export class InternetFaxProvider implements FaxProvider {
  name = "internet-fax-machine";
  private config: InternetFaxProviderConfig;

  constructor(config: InternetFaxProviderConfig) {
    this.config = config;
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.username && this.config.password) {
      headers["Authorization"] =
        "Basic " +
        Buffer.from(`${this.config.username}:${this.config.password}`).toString(
          "base64",
        );
    }
    return headers;
  }

  async sendFax(options: FaxSendOptions): Promise<FaxSendResult> {
    const baseUrl = this.config.url.replace(/\/+$/, "");
    const sendUrl = `${baseUrl}/fax/send`;

    // Build multipart form (matching: curl -F "to=..." -F "file=@...")
    const form = new FormData();
    form.append("to", options.recipientFax);

    if (options.documentPath) {
      const fs = await import("fs");
      const path = await import("path");
      const fileName = path.basename(options.documentPath);
      const fileData = fs.readFileSync(options.documentPath);
      form.append(
        "file",
        new Blob([fileData], { type: "application/pdf" }),
        fileName,
      );
    }

    const sendRes = await fetch(sendUrl, {
      method: "POST",
      headers: this.authHeaders(),
      body: form,
    });

    const sendResult = await sendRes.json();
    if (sendRes.ok && sendResult.ok) {
      return {
        success: true,
        providerJobId: sendResult.requestId || sendResult.fax?.data?.id,
      };
    }
    return {
      success: false,
      error:
        sendResult.error ||
        sendResult.message ||
        `Send failed (${sendRes.status})`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getStatus(_providerJobId: string): Promise<FaxStatusResult> {
    // The internet-fax-machine gateway uses provider webhooks for status,
    // no polling endpoint is available
    return { status: "pending" };
  }

  isConfigured(): boolean {
    return !!this.config.url;
  }
}
