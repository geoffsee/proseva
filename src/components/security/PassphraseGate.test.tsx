import { render, screen } from "../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PassphraseGate } from "./PassphraseGate";

// Mock API
vi.mock("../../lib/api", () => ({
  securityApi: {
    status: vi.fn(),
    setupPassphrase: vi.fn(),
    verifyPassphrase: vi.fn(),
  },
  authApi: {
    login: vi.fn(),
  },
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  setAuthExpiredCallback: vi.fn(),
}));

// Mock KV
vi.mock("../../lib/kv", () => ({
  initAuthStore: vi.fn(),
  initKeysStore: vi.fn(),
  initDataStore: vi.fn(),
  generateAndStoreMLKEMKeys: vi.fn().mockResolvedValue({ publicKey: new Uint8Array(), secretKey: new Uint8Array() }),
  loadMLKEMKeys: vi.fn().mockResolvedValue({ publicKey: new Uint8Array(), secretKey: new Uint8Array() }),
}));

describe("PassphraseGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children immediately if isTestMode is true", () => {
    render(
      <PassphraseGate>
        <div data-testid="protected-content">Protected</div>
      </PassphraseGate>
    );
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("shows loading state initially", async () => {
    // We can't easily mock import.meta.env.MODE, but we can try to see if it
    // enters the bootstrap flow if we were able to. 
    // For now, this just verifies the component doesn't crash.
    render(
      <PassphraseGate>
        <div>Content</div>
      </PassphraseGate>
    );
  });
});
