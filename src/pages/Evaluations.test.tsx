import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Evaluations from "./Evaluations";

const mockEvaluationStore = {
  isLoading: false,
  isTriggering: false,
  evaluations: [
    {
      id: "eval-1",
      createdAt: "2025-02-12T10:00:00Z",
      status: "sent",
      analysis: {
        overdueDeadlines: [{ id: "d1", title: "File Answer", daysOverdue: 5 }],
        upcomingDeadlines: [{ id: "d2", title: "Discovery", daysUntil: 3 }],
        tomorrowActions: [],
        aiSummary: "You have 1 overdue deadline.",
      },
      notification: {
        title: "Daily Legal Alert",
        body: "You have urgent deadlines.",
        sentAt: "2025-02-12T10:05:00Z",
        pushSent: true,
        smsSent: true,
      },
    },
  ],
  sortedEvaluations: [],
  smsRecipients: [
    { id: "r1", phone: "+15550001111", name: "Alice", active: true },
  ],
  schedulerStatus: {
    enabled: true,
    running: false,
    nextRunTime: "2025-02-13T18:00:00Z",
    timezone: "America/New_York",
    channels: {
      firebase: { configured: true, tokenCount: 1 },
      twilio: { configured: true, recipientCount: 1 },
    },
  },
  loadAll: vi.fn(),
  triggerEvaluation: vi.fn().mockResolvedValue({ pushSent: true, smsSent: true }),
  addSmsRecipient: vi.fn().mockResolvedValue({ id: "r2" }),
  removeSmsRecipient: vi.fn().mockResolvedValue({ success: true }),
};

mockEvaluationStore.sortedEvaluations = mockEvaluationStore.evaluations as any;

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    evaluationStore: mockEvaluationStore,
  })),
}));

vi.mock("../components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

describe("Evaluations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders scheduler status", () => {
    render(<Evaluations />);
    expect(screen.getByText("Daily Evaluations")).toBeInTheDocument();
    expect(screen.getByText("Scheduler Status")).toBeInTheDocument();
    // 'Active' appears multiple times (Scheduler and Recipients)
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText(/America\/New_York/)).toBeInTheDocument();
  });

  it("triggers a manual evaluation", async () => {
    render(<Evaluations />);
    const runButton = screen.getByRole("button", { name: /Run Now/i });
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(mockEvaluationStore.triggerEvaluation).toHaveBeenCalled();
    });
  });

  it("renders evaluation history", () => {
    render(<Evaluations />);
    expect(screen.getByText("File Answer - 5 days overdue")).toBeInTheDocument();
    expect(screen.getByText("Discovery - 3 days")).toBeInTheDocument();
    expect(screen.getByText("You have 1 overdue deadline.")).toBeInTheDocument();
  });

  it("manages SMS recipients", async () => {
    render(<Evaluations />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    
    const phoneInput = screen.getByPlaceholderText("Phone number (+1...)");
    const nameInput = screen.getByPlaceholderText("Name (optional)");
    const addButton = screen.getByRole("button", { name: /Add/i });

    fireEvent.change(phoneInput, { target: { value: "+15559998888" } });
    fireEvent.change(nameInput, { target: { value: "Bob" } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockEvaluationStore.addSmsRecipient).toHaveBeenCalledWith("+15559998888", "Bob");
    });
  });

  it("removes SMS recipient", async () => {
    render(<Evaluations />);
    const removeButton = screen.getByLabelText("Remove recipient");
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockEvaluationStore.removeSmsRecipient).toHaveBeenCalledWith("r1");
    });
  });
});
