import { describe, it, expect } from "vitest";
import { StubFaxProvider } from "./stub-provider";

describe("StubFaxProvider", () => {
  const provider = new StubFaxProvider();

  it("has name 'stub'", () => {
    expect(provider.name).toBe("stub");
  });

  it("isConfigured returns true", () => {
    expect(provider.isConfigured()).toBe(true);
  });

  it("sendFax returns success with a providerJobId", async () => {
    const result = await provider.sendFax({
      recipientFax: "555-1234",
      recipientName: "Test Court",
      callerReference: "job-1",
    });
    expect(result.success).toBe(true);
    expect(result.providerJobId).toBeDefined();
    expect(result.providerJobId).toMatch(/^stub-/);
  });

  it("getStatus returns 'sent'", async () => {
    const result = await provider.getStatus!("stub-123");
    expect(result.status).toBe("sent");
  });
});
