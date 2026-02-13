import type {
  FaxProvider,
  FaxSendOptions,
  FaxSendResult,
  FaxStatusResult,
} from "./types";

export class StubFaxProvider implements FaxProvider {
  name = "stub";

  async sendFax(options: FaxSendOptions): Promise<FaxSendResult> {
    console.log(
      `[stub-fax] Sending fax to ${options.recipientFax} (${options.recipientName})`,
    );
    // Simulate a short delay
    await new Promise((resolve) => setTimeout(resolve, 200));
    const providerJobId = `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[stub-fax] Fax sent successfully: ${providerJobId}`);
    return { success: true, providerJobId };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getStatus(_providerJobId: string): Promise<FaxStatusResult> {
    return { status: "sent" };
  }

  isConfigured(): boolean {
    return true;
  }
}
