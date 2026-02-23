import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Config from "./Config";
import { api } from "../lib/api";
import { toaster } from "../components/ui/toaster";

// Mock the API
vi.mock("../lib/api", () => ({
  api: {
    security: {
      status: vi.fn(),
      applyRecoveryKey: vi.fn(),
    },
    config: {
      getOpenAIModels: vi.fn(),
    },
    email: {
      status: vi.fn().mockResolvedValue({ configured: false }),
    },
  },
}));

// Mock the store
const mockConfig = {
  firebase: {
    projectId: "test-project",
    privateKey: "test-key",
    clientEmail: "test-email",
    projectIdSource: "database",
  },
  twilio: {
    accountSid: "test-sid",
    authToken: "test-token",
    phoneNumber: "test-phone",
  },
  scheduler: {
    timezone: "America/New_York",
    enabled: true,
  },
  ai: {
    openaiApiKey: "test-ai-key",
    openaiEndpoint: "https://api.openai.com/v1",
    selectedModels: ["gpt-4"],
    vlmModel: "gpt-4o",
  },
  autoIngest: {
    directory: "/test/dir",
  },
  legalResearch: {
    courtListenerApiToken: "test-cl-token",
  },
  prompts: {
    chatSystemPrompt: "test-prompt",
  },
};

const mockConfigStore = {
  config: mockConfig,
  isLoading: false,
  isTesting: false,
  error: null,
  loadConfig: vi.fn(),
  updateConfig: vi.fn().mockResolvedValue({ success: true }),
  resetConfig: vi.fn().mockResolvedValue({ success: true }),
  testFirebase: vi.fn().mockResolvedValue({ success: true }),
  testTwilio: vi.fn().mockResolvedValue({ success: true }),
  testOpenAI: vi.fn().mockResolvedValue({ success: true }),
  reinitializeService: vi.fn().mockResolvedValue({ success: true }),
};

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    configStore: mockConfigStore,
  })),
}));

// Mock toaster
vi.mock("../components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

describe("Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.security.status as any).mockResolvedValue({
      locked: false,
      encryptedAtRest: true,
      keyLoaded: true,
    });
    (api.config.getOpenAIModels as any).mockResolvedValue({
      success: true,
      models: ["gpt-3.5-turbo", "gpt-4", "gpt-4o"],
      endpoint: "https://api.openai.com/v1",
    });
  });

  it("renders configuration sections", async () => {
    render(<Config />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Scheduler")).toBeInTheDocument();
    expect(screen.getByText("AI Features")).toBeInTheDocument();
    expect(screen.getByText("AI Prompts")).toBeInTheDocument();
    expect(screen.getByText("Legal Research APIs")).toBeInTheDocument();
    expect(screen.getByText("Data Encryption")).toBeInTheDocument();
    expect(screen.getByText("Auto-Ingest")).toBeInTheDocument();
  });

  it("loads config on mount", () => {
    render(<Config />);
    expect(mockConfigStore.loadConfig).toHaveBeenCalled();
    expect(api.security.status).toHaveBeenCalled();
  });

  it("displays current configuration values", async () => {
    render(<Config />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("test-project")).toBeInTheDocument();
      expect(screen.getByDisplayValue("test-email")).toBeInTheDocument();
      expect(screen.getByDisplayValue("America/New_York")).toBeInTheDocument();
      expect(screen.getByDisplayValue("gpt-4o")).toBeInTheDocument();
      expect(screen.getByDisplayValue("/test/dir")).toBeInTheDocument();
    });
  });

  it("handles saving changes", async () => {
    render(<Config />);

    // Change a value to enable Save button
    const timezoneInput = screen.getByPlaceholderText("America/New_York");
    fireEvent.change(timezoneInput, { target: { value: "UTC" } });

    const saveButton = screen.getByRole("button", {
      name: /Save All Changes/i,
    });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockConfigStore.updateConfig).toHaveBeenCalled();
      expect(mockConfigStore.reinitializeService).toHaveBeenCalledWith(
        "firebase",
      );
      expect(mockConfigStore.reinitializeService).toHaveBeenCalledWith(
        "twilio",
      );
      expect(mockConfigStore.reinitializeService).toHaveBeenCalledWith(
        "scheduler",
      );
    });
  });

  it("handles resetting configuration", async () => {
    // Mock window.confirm
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirmSpy);

    render(<Config />);

    const resetButton = screen.getByRole("button", { name: /Reset All/i });
    fireEvent.click(resetButton);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockConfigStore.resetConfig).toHaveBeenCalled();
    });
  });

  it("handles Firebase connection test", async () => {
    render(<Config />);

    const testButton = screen.getByRole("button", {
      name: /Test Firebase Connection/i,
    });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockConfigStore.testFirebase).toHaveBeenCalled();
    });
  });

  it("handles Twilio SMS test", async () => {
    render(<Config />);

    // There are two such placeholders, one for Twilio Phone Number and one for Test Phone Number.
    const phoneInputs = screen.getAllByPlaceholderText("+15551234567");
    fireEvent.change(phoneInputs[1], { target: { value: "+1234567890" } });

    const testButton = screen.getByRole("button", { name: /Send Test SMS/i });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockConfigStore.testTwilio).toHaveBeenCalledWith("+1234567890");
    });
  });

  it("handles OpenAI connection test", async () => {
    render(<Config />);

    const testButton = screen.getByRole("button", {
      name: /Test OpenAI Connection/i,
    });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockConfigStore.testOpenAI).toHaveBeenCalled();
    });
  });

  it("handles recovery key generation", async () => {
    render(<Config />);

    const generateButton = screen.getByRole("button", {
      name: /Generate Recovery Key/i,
    });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/Store this key safely/i)).toBeInTheDocument();
    });
  });

  it("handles applying a recovery key", async () => {
    (api.security.applyRecoveryKey as any).mockResolvedValue({
      success: true,
      status: { locked: false, encryptedAtRest: true, keyLoaded: true },
    });

    render(<Config />);

    const keyInput = screen.getByPlaceholderText(
      "Enter existing key or generate a new one",
    );
    fireEvent.change(keyInput, { target: { value: "TEST-KEY-123" } });

    const applyButton = screen.getByRole("button", {
      name: /Apply Recovery Key/i,
    });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(api.security.applyRecoveryKey).toHaveBeenCalledWith(
        "TEST-KEY-123",
      );
    });
  });

  it("handles AI model selection via dropdown", async () => {
    render(<Config />);

    // Wait for models to load and dropdowns to appear
    await waitFor(() => {
      expect(screen.getByText("Visual Model")).toBeInTheDocument();
    });

    // Change the Visual Model dropdown to a different model
    const vlmSelect = screen.getByDisplayValue("gpt-4o");
    fireEvent.change(vlmSelect, { target: { value: "gpt-4" } });

    const saveButton = screen.getByRole("button", {
      name: /Save All Changes/i,
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockConfigStore.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          ai: expect.objectContaining({
            vlmModel: "gpt-4",
          }),
        }),
      );
    });
  });

  it("shows error if Twilio test phone is missing", async () => {
    render(<Config />);

    const testButton = screen.getByRole("button", { name: /Send Test SMS/i });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test phone number required",
          type: "error",
        }),
      );
    });
  });
});
