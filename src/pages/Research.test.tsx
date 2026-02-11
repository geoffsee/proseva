import { render, screen, fireEvent } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Research from "./Research";
import { useStore } from "../store/StoreContext";

const mockSendMessage = vi.fn();
const mockClearMessages = vi.fn();
const mockToggleSidebar = vi.fn();

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    researchStore: {
      messages: [],
      isTyping: false,
      sidebarResults: [],
      sidebarOpen: true,
      resultsByType: {},
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      toggleSidebar: mockToggleSidebar,
    },
  })),
}));

describe("Research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue({
      researchStore: {
        messages: [],
        isTyping: false,
        sidebarResults: [],
        sidebarOpen: true,
        resultsByType: {},
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        toggleSidebar: mockToggleSidebar,
      },
    } as unknown as ReturnType<typeof useStore>);
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
    vi.mocked(useStore).mockReturnValue({
      researchStore: {
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
        isTyping: false,
        sidebarResults: [],
        sidebarOpen: true,
        resultsByType: {},
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        toggleSidebar: mockToggleSidebar,
      },
    } as unknown as ReturnType<typeof useStore>);
    render(<Research />);
    expect(screen.getByText("Search for patent cases")).toBeInTheDocument();
    expect(
      screen.getByText(/I found several patent cases/),
    ).toBeInTheDocument();
  });

  it("displays typing indicator when isTyping is true", () => {
    vi.mocked(useStore).mockReturnValue({
      researchStore: {
        messages: [],
        isTyping: true,
        sidebarResults: [],
        sidebarOpen: true,
        resultsByType: {},
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
        toggleSidebar: mockToggleSidebar,
      },
    } as unknown as ReturnType<typeof useStore>);
    render(<Research />);
    expect(screen.getByText("Researching...")).toBeInTheDocument();
  });

  it("renders toggle sidebar button", () => {
    render(<Research />);
    expect(
      screen.getByTestId("toggle-sidebar"),
    ).toBeInTheDocument();
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
});
