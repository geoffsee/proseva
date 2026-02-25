import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Research from "./Research";
import { useStore } from "../store/StoreContext";

const mockSendMessage = vi.fn();
const mockClearMessages = vi.fn();
const mockToggleSidebar = vi.fn();
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

function mockStore(overrides?: {
  messages?: Array<{ id: string; role: "user" | "assistant"; text: string; createdAt: string; toolResults: unknown[] }>;
  isTyping?: boolean;
}) {
  vi.mocked(useStore).mockReturnValue({
    researchStore: {
      messages: overrides?.messages ?? [],
      isTyping: overrides?.isTyping ?? false,
      sidebarResults: [],
      sidebarOpen: true,
      resultsByType: {},
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      toggleSidebar: mockToggleSidebar,
    },
    noteStore: {
      addNote: mockAddNote,
    },
    caseStore: {
      cases: [{ id: "case-1", name: "Smith v. Jones" }],
    },
  } as unknown as ReturnType<typeof useStore>);
}

describe("Research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore();
  });

  it("renders Case Research heading", () => {
    render(<Research />);
    expect(
      screen.getByRole("heading", { name: "Case Research" }),
    ).toBeInTheDocument();
  });

  it("renders message input field", () => {
    render(<Research />);
    expect(
      screen.getByPlaceholderText(/Ask a research question/),
    ).toBeInTheDocument();
  });

  it("renders send button", () => {
    render(<Research />);
    expect(screen.getByLabelText("Send")).toBeInTheDocument();
  });

  it("shows empty state with quick actions when no messages", () => {
    render(<Research />);
    expect(
      screen.getByText(/Ask a legal research question/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Search Opinions").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Search Statutes").length).toBeGreaterThan(0);
  });

  it("sends message when send button is clicked", () => {
    render(<Research />);
    const input = screen.getByPlaceholderText(/Ask a research question/);
    fireEvent.change(input, { target: { value: "Find patent cases" } });
    fireEvent.click(screen.getByLabelText("Send"));
    expect(mockSendMessage).toHaveBeenCalledWith("Find patent cases");
  });

  it("sends message when Enter key is pressed", () => {
    render(<Research />);
    const input = screen.getByPlaceholderText(/Ask a research question/);
    fireEvent.change(input, {
      target: { value: "Search for data privacy statutes" },
    });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockSendMessage).toHaveBeenCalledWith(
      "Search for data privacy statutes",
    );
  });

  it("clears input after sending message", () => {
    render(<Research />);
    const input = screen.getByPlaceholderText(
      /Ask a research question/,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Test query" } });
    fireEvent.click(screen.getByLabelText("Send"));
    expect(input.value).toBe("");
  });

  it("does not send empty message", () => {
    render(<Research />);
    fireEvent.click(screen.getByLabelText("Send"));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("does not send message with only whitespace", () => {
    render(<Research />);
    const input = screen.getByPlaceholderText(/Ask a research question/);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByLabelText("Send"));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("displays chat messages", () => {
    mockStore({
      messages: [
        {
          id: "1",
          role: "user" as const,
          text: "Search for patent cases",
          createdAt: new Date().toISOString(),
          toolResults: [],
        },
        {
          id: "2",
          role: "assistant" as const,
          text: "I found several patent cases...",
          createdAt: new Date().toISOString(),
          toolResults: [],
        },
      ],
    });
    render(<Research />);
    expect(screen.getByText("Search for patent cases")).toBeInTheDocument();
    expect(
      screen.getByText(/I found several patent cases/),
    ).toBeInTheDocument();
  });

  it("displays typing indicator when isTyping is true", () => {
    mockStore({ isTyping: true });
    render(<Research />);
    expect(screen.getByText("Researching...")).toBeInTheDocument();
  });

  it("renders toggle sidebar button", () => {
    render(<Research />);
    expect(screen.getByTestId("toggle-sidebar")).toBeInTheDocument();
  });

  it("renders clear chat button", () => {
    render(<Research />);
    expect(screen.getByLabelText("Clear chat")).toBeInTheDocument();
  });

  it("calls clearMessages when clear button clicked", () => {
    render(<Research />);
    fireEvent.click(screen.getByLabelText("Clear chat"));
    expect(mockClearMessages).toHaveBeenCalled();
  });

  it("pre-fills input when quick action is clicked", () => {
    render(<Research />);
    const searchOpinionsButtons = screen.getAllByText("Search Opinions");
    fireEvent.click(searchOpinionsButtons[0]);
    const input = screen.getByPlaceholderText(
      /Ask a research question/,
    ) as HTMLInputElement;
    expect(input.value).toBe("Search for court opinions about ");
  });

  describe("save as note", () => {
    const messagesWithAssistant = [
      {
        id: "1",
        role: "user" as const,
        text: "Search for patent cases",
        createdAt: new Date().toISOString(),
        toolResults: [],
      },
      {
        id: "2",
        role: "assistant" as const,
        text: "I found several patent cases...",
        createdAt: new Date().toISOString(),
        toolResults: [],
      },
    ];

    it("shows save-as-note button on assistant messages only", () => {
      mockStore({ messages: messagesWithAssistant });
      render(<Research />);
      const saveButtons = screen.getAllByLabelText("Save as note");
      expect(saveButtons).toHaveLength(1);
    });

    it("does not show save-as-note button when there are no assistant messages", () => {
      mockStore({
        messages: [
          {
            id: "1",
            role: "user" as const,
            text: "Hello",
            createdAt: new Date().toISOString(),
            toolResults: [],
          },
        ],
      });
      render(<Research />);
      expect(screen.queryByLabelText("Save as note")).not.toBeInTheDocument();
    });

    it("opens dialog with pre-filled content when save button is clicked", async () => {
      mockStore({ messages: messagesWithAssistant });
      render(<Research />);
      fireEvent.click(screen.getByLabelText("Save as note"));

      await waitFor(() => {
        expect(screen.getByTestId("add-edit-note-dialog")).toBeInTheDocument();
      });
      expect(screen.getByTestId("note-title")).toHaveValue(
        "Research — I found several patent cases...",
      );
    });

    it("pre-fills title with first 50 chars of message text", async () => {
      const longText = "B".repeat(100);
      mockStore({
        messages: [
          { id: "1", role: "assistant" as const, text: longText, createdAt: new Date().toISOString(), toolResults: [] },
        ],
      });
      render(<Research />);
      fireEvent.click(screen.getByLabelText("Save as note"));

      await waitFor(() => {
        expect(screen.getByTestId("note-title")).toHaveValue(
          "Research — " + "B".repeat(50),
        );
      });
    });

    it("calls noteStore.addNote when save is confirmed", async () => {
      mockStore({ messages: messagesWithAssistant });
      render(<Research />);
      fireEvent.click(screen.getByLabelText("Save as note"));

      await waitFor(() => {
        expect(screen.getByTestId("add-edit-note-dialog")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(mockAddNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Research — I found several patent cases...",
          content: "I found several patent cases...",
          category: "research",
          tags: ["research"],
        }),
      );
    });
  });
});
