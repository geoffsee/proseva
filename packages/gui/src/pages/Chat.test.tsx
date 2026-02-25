import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Chat from "./Chat";
import { useStore } from "../store/StoreContext";
import type { IRootStore } from "../store/RootStore";

const mockSendMessage = vi.fn();
const mockClearMessages = vi.fn();
const mockArchiveConversation = vi.fn();
const mockLoadConversation = vi.fn();
const mockAddNote = vi.fn();

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(),
}));

vi.mock("../components/notes/AddEditNoteDialog", () => ({
  AddEditNoteDialog: ({ open, form, onSave }: { open: boolean; form: { title: string; content: string }; onSave: () => void }) =>
    open ? (
      <div data-testid="add-edit-note-dialog">
        <input data-testid="note-title" value={form.title} readOnly />
        <button onClick={onSave}>Save</button>
      </div>
    ) : null,
}));

const defaultMessages = [
  {
    id: "1",
    role: "user" as const,
    text: "What is discovery?",
    timestamp: Date.now(),
  },
  {
    id: "2",
    role: "assistant" as const,
    text: "Discovery is the process...",
    timestamp: Date.now(),
  },
];

function mockStore(overrides?: {
  messages?: typeof defaultMessages;
  isTyping?: boolean;
  historySorted?: Array<{ id: string; title: string; updatedAt: string }>;
  selectedHistoryId?: string | null;
}) {
  vi.mocked(useStore).mockReturnValue({
    chatStore: {
      messages: overrides?.messages ?? defaultMessages,
      historySorted: overrides?.historySorted ?? [],
      selectedHistoryId: overrides?.selectedHistoryId ?? null,
      isTyping: overrides?.isTyping ?? false,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      archiveConversation: mockArchiveConversation,
      loadConversation: mockLoadConversation,
    },
    noteStore: {
      addNote: mockAddNote,
    },
    caseStore: {
      cases: [{ id: "case-1", name: "Smith v. Jones" }],
    },
  } as unknown as IRootStore);
}

describe("Chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore();
  });

  it("renders AI Assistant heading", () => {
    render(<Chat />);
    expect(
      screen.getByRole("heading", { name: "AI Assistant" }),
    ).toBeInTheDocument();
  });

  it("displays chat messages", () => {
    render(<Chat />);
    expect(screen.getByText("What is discovery?")).toBeInTheDocument();
    expect(screen.getByText(/Discovery is the process/)).toBeInTheDocument();
  });

  it("renders message input field", () => {
    render(<Chat />);
    expect(
      screen.getByPlaceholderText(/Ask about your case/),
    ).toBeInTheDocument();
  });

  it("renders send button", () => {
    render(<Chat />);
    expect(screen.getByLabelText("Send")).toBeInTheDocument();
  });

  it("renders archive conversation button", () => {
    render(<Chat />);
    expect(screen.getByLabelText("Archive conversation")).toBeInTheDocument();
  });

  it("archives conversation when archive button is clicked", () => {
    render(<Chat />);
    fireEvent.click(screen.getByLabelText("Archive conversation"));
    expect(mockArchiveConversation).toHaveBeenCalledTimes(1);
  });

  it("opens history dropdown and loads a selected conversation", () => {
    mockStore({
      historySorted: [
        {
          id: "hist-1",
          title: "Custody strategy discussion",
          updatedAt: "2026-02-25T20:00:00.000Z",
        },
      ],
    });
    render(<Chat />);
    fireEvent.click(screen.getByLabelText("Conversation history"));
    fireEvent.click(
      screen.getByLabelText("Open conversation Custody strategy discussion"),
    );
    expect(mockLoadConversation).toHaveBeenCalledWith("hist-1");
  });

  it("shows active marker for the selected conversation", () => {
    mockStore({
      selectedHistoryId: "hist-1",
      historySorted: [
        {
          id: "hist-1",
          title: "Custody strategy discussion",
          updatedAt: "2026-02-25T20:00:00.000Z",
        },
      ],
    });
    render(<Chat />);
    fireEvent.click(screen.getByLabelText("Conversation history"));
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("sends message when send button is clicked", () => {
    render(<Chat />);
    const input = screen.getByPlaceholderText(/Ask about your case/);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByLabelText("Send"));

    expect(mockSendMessage).toHaveBeenCalledWith("Hello");
  });

  it("sends message when Enter key is pressed", () => {
    render(<Chat />);
    const input = screen.getByPlaceholderText(/Ask about your case/);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).toHaveBeenCalledWith("Hello");
  });

  it("clears input after sending message", () => {
    render(<Chat />);
    const input = screen.getByPlaceholderText(
      /Ask about your case/,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.click(screen.getByLabelText("Send"));

    expect(input.value).toBe("");
  });

  it("shows empty state when no messages", () => {
    mockStore({ messages: [] });
    render(<Chat />);
    expect(screen.getByText(/Send a message to start/)).toBeInTheDocument();
  });

  it("displays typing indicator when chatStore.isTyping is true", () => {
    mockStore({ messages: [], isTyping: true });
    render(<Chat />);
    expect(screen.getByText("Typing...")).toBeInTheDocument();
  });

  it("does not send empty message", () => {
    render(<Chat />);
    fireEvent.click(screen.getByLabelText("Send"));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("does not send message with only whitespace", () => {
    render(<Chat />);
    const input = screen.getByPlaceholderText(/Ask about your case/);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByLabelText("Send"));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("renders message content", () => {
    render(<Chat />);
    const { container } = render(<Chat />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  describe("save as note", () => {
    it("shows save-as-note button on assistant messages only", () => {
      render(<Chat />);
      const saveButtons = screen.getAllByLabelText("Save as note");
      // Only assistant messages get the button (1 assistant message in default mock)
      expect(saveButtons).toHaveLength(1);
    });

    it("does not show save-as-note button when there are no assistant messages", () => {
      mockStore({
        messages: [
          { id: "1", role: "user" as const, text: "Hello", timestamp: Date.now() },
        ],
      });
      render(<Chat />);
      expect(screen.queryByLabelText("Save as note")).not.toBeInTheDocument();
    });

    it("opens dialog with pre-filled content when save button is clicked", async () => {
      render(<Chat />);
      fireEvent.click(screen.getByLabelText("Save as note"));

      await waitFor(() => {
        expect(screen.getByTestId("add-edit-note-dialog")).toBeInTheDocument();
      });
      expect(screen.getByTestId("note-title")).toHaveValue(
        "Chat — Discovery is the process...",
      );
    });

    it("pre-fills title with first 50 chars of message text", async () => {
      const longText = "A".repeat(100);
      mockStore({
        messages: [
          { id: "1", role: "assistant" as const, text: longText, timestamp: Date.now() },
        ],
      });
      render(<Chat />);
      fireEvent.click(screen.getByLabelText("Save as note"));

      await waitFor(() => {
        expect(screen.getByTestId("note-title")).toHaveValue(
          "Chat — " + "A".repeat(50),
        );
      });
    });

    it("calls noteStore.addNote when save is confirmed", async () => {
      render(<Chat />);
      fireEvent.click(screen.getByLabelText("Save as note"));

      await waitFor(() => {
        expect(screen.getByTestId("add-edit-note-dialog")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(mockAddNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Chat — Discovery is the process...",
          content: "Discovery is the process...",
          category: "general",
          tags: ["chat"],
        }),
      );
    });
  });
});
