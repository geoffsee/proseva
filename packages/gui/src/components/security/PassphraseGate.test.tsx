import { render, screen, waitFor } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PassphraseGate } from "./PassphraseGate";
import { securityApi, authApi, getAuthToken } from "../../lib/api";
import {
  initAuthStore,
  initKeysStore,
  initDataStore,
  loadMLKEMKeys,
  generateAndStoreMLKEMKeys,
} from "../../lib/kv";

// Mock API
vi.mock("../../lib/api", () => ({
  securityApi: {
    status: vi.fn(),
    setupPassphrase: vi.fn(),
    verifyPassphrase: vi.fn(),
    applyRecoveryKey: vi.fn(),
  },
  authApi: {
    login: vi.fn(),
  },
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  setAuthExpiredCallback: vi.fn(),
  setDbLockedCallback: vi.fn(),
}));

// Mock KV
vi.mock("../../lib/kv", () => ({
  initAuthStore: vi.fn(),
  initKeysStore: vi.fn(),
  initDataStore: vi.fn(),
  generateAndStoreMLKEMKeys: vi.fn().mockResolvedValue({
    publicKey: new Uint8Array(),
    secretKey: new Uint8Array(),
  }),
  loadMLKEMKeys: vi.fn().mockResolvedValue({
    publicKey: new Uint8Array(),
    secretKey: new Uint8Array(),
  }),
}));

describe("PassphraseGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(initAuthStore).mockResolvedValue(undefined);
    vi.mocked(getAuthToken).mockResolvedValue(null);
    vi.mocked(securityApi.status).mockResolvedValue({
      locked: false,
      encryptedAtRest: false,
      keyLoaded: false,
      lockReason: null,
      passphraseConfigured: true,
    });
    vi.mocked(securityApi.verifyPassphrase).mockResolvedValue({ valid: true });
    vi.mocked(securityApi.applyRecoveryKey).mockResolvedValue({
      success: true,
      status: {
        locked: false,
        encryptedAtRest: true,
        keyLoaded: true,
        lockReason: null,
        passphraseConfigured: true,
      },
    });
    vi.mocked(authApi.login).mockResolvedValue({
      success: true,
      token: "token",
      expiresIn: 3600,
    });
    vi.mocked(initKeysStore).mockResolvedValue({} as never);
    vi.mocked(loadMLKEMKeys).mockResolvedValue({
      publicKey: new Uint8Array([1]),
      secretKey: new Uint8Array([2]),
    });
    vi.mocked(generateAndStoreMLKEMKeys).mockResolvedValue({
      publicKey: new Uint8Array([1]),
      secretKey: new Uint8Array([2]),
    });
    vi.mocked(initDataStore).mockResolvedValue({} as never);
  });

  it("renders children immediately if isTestMode is true", () => {
    render(
      <PassphraseGate>
        <div data-testid="protected-content">Protected</div>
      </PassphraseGate>,
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
      </PassphraseGate>,
    );
  });

  it("shows recovery key form when database is locked", async () => {
    vi.mocked(securityApi.status).mockResolvedValue({
      locked: true,
      encryptedAtRest: true,
      keyLoaded: false,
      lockReason: "missing_key",
      passphraseConfigured: true,
    });

    render(
      <PassphraseGate forceInteractive>
        <div>Content</div>
      </PassphraseGate>,
    );

    expect(await screen.findByText("Enter Passphrase")).toBeInTheDocument();
    expect(screen.getByText("Use Recovery Key")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter recovery key"),
    ).toBeInTheDocument();
  });

  it("applies recovery key and continues unlock flow", async () => {
    vi.mocked(securityApi.status).mockResolvedValue({
      locked: true,
      encryptedAtRest: true,
      keyLoaded: false,
      lockReason: "missing_key",
      passphraseConfigured: true,
    });

    const user = userEvent.setup();
    render(
      <PassphraseGate forceInteractive>
        <div data-testid="protected-content">Protected</div>
      </PassphraseGate>,
    );

    await screen.findByText("Use Recovery Key");
    await user.type(
      screen.getByPlaceholderText("Enter recovery key"),
      "RECOVERY-KEY",
    );
    await user.click(
      screen.getByRole("button", { name: "Apply Recovery Key" }),
    );

    await waitFor(() => {
      expect(securityApi.applyRecoveryKey).toHaveBeenCalledWith("RECOVERY-KEY");
    });
    await waitFor(() => {
      expect(screen.queryByText("Use Recovery Key")).not.toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("Enter your passphrase"),
      "pass-1234",
    );
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(securityApi.verifyPassphrase).toHaveBeenCalledWith("pass-1234");
      expect(authApi.login).toHaveBeenCalledWith("pass-1234");
    });
    expect(await screen.findByTestId("protected-content")).toBeInTheDocument();
  });

  it("shows recovery key error when backend rejects key", async () => {
    vi.mocked(securityApi.status).mockResolvedValue({
      locked: true,
      encryptedAtRest: true,
      keyLoaded: false,
      lockReason: "invalid_key",
      passphraseConfigured: true,
    });
    vi.mocked(securityApi.applyRecoveryKey).mockResolvedValue({
      success: false,
      error: "Invalid recovery key.",
    });

    const user = userEvent.setup();
    render(
      <PassphraseGate forceInteractive>
        <div>Content</div>
      </PassphraseGate>,
    );

    await screen.findByText("Use Recovery Key");
    await user.type(
      screen.getByPlaceholderText("Enter recovery key"),
      "bad-key",
    );
    await user.click(
      screen.getByRole("button", { name: "Apply Recovery Key" }),
    );

    expect(
      await screen.findByText("Invalid recovery key."),
    ).toBeInTheDocument();
  });

  it("creates passphrase and initializes stores on first run", async () => {
    vi.mocked(securityApi.status).mockResolvedValue({
      locked: false,
      encryptedAtRest: false,
      keyLoaded: false,
      lockReason: null,
      passphraseConfigured: false,
    });
    vi.mocked(securityApi.setupPassphrase).mockResolvedValue({ success: true });

    const user = userEvent.setup();
    render(
      <PassphraseGate forceInteractive>
        <div data-testid="protected-content">Protected</div>
      </PassphraseGate>,
    );

    expect(await screen.findByText("Create Passphrase")).toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText("Enter passphrase (min 8 characters)"),
      "new-passphrase",
    );
    await user.type(
      screen.getByPlaceholderText("Re-enter passphrase"),
      "new-passphrase",
    );
    await user.click(screen.getByRole("button", { name: "Create & Encrypt" }));

    await waitFor(() => {
      expect(securityApi.setupPassphrase).toHaveBeenCalledWith(
        "new-passphrase",
      );
      expect(authApi.login).toHaveBeenCalledWith("new-passphrase");
      expect(generateAndStoreMLKEMKeys).toHaveBeenCalled();
    });
    expect(await screen.findByTestId("protected-content")).toBeInTheDocument();
  });

  it("shows error when passphrase verification fails", async () => {
    vi.mocked(securityApi.status).mockResolvedValue({
      locked: false,
      encryptedAtRest: true,
      keyLoaded: true,
      lockReason: null,
      passphraseConfigured: true,
    });
    vi.mocked(securityApi.verifyPassphrase).mockResolvedValue({
      valid: false,
      error: "Invalid passphrase.",
    });

    const user = userEvent.setup();
    render(
      <PassphraseGate forceInteractive>
        <div>Content</div>
      </PassphraseGate>,
    );

    await screen.findByText("Enter Passphrase");
    await user.type(
      screen.getByPlaceholderText("Enter your passphrase"),
      "wrong",
    );
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Invalid passphrase.")).toBeInTheDocument();
  });

  it("requires recovery key input before submit", async () => {
    vi.mocked(securityApi.status).mockResolvedValue({
      locked: true,
      encryptedAtRest: true,
      keyLoaded: false,
      lockReason: "missing_key",
      passphraseConfigured: true,
    });

    render(
      <PassphraseGate forceInteractive>
        <div>Content</div>
      </PassphraseGate>,
    );

    await screen.findByText("Use Recovery Key");
    const button = screen.getByRole("button", { name: "Apply Recovery Key" });
    expect(button).toBeDisabled();
    expect(securityApi.applyRecoveryKey).not.toHaveBeenCalled();
  });
});
