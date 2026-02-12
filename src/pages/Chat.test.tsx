import { render, screen, fireEvent } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Chat from "./Chat";
import { useStore } from "../store/StoreContext";
import type { IRootStore } from "../store/RootStore";

const mockSendMessage = vi.fn();

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(),
}));

describe("Chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue({
      chatStore: {
        messages: [
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
        ],
        isTyping: false,
        sendMessage: mockSendMessage,
      },
    } as unknown as IRootStore);
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
    vi.mocked(useStore).mockReturnValue({
      chatStore: {
        messages: [],
        isTyping: false,
        sendMessage: vi.fn(),
      },
    } as unknown as IRootStore);
    render(<Chat />);
    expect(screen.getByText(/Send a message to start/)).toBeInTheDocument();
  });

  it("displays typing indicator when chatStore.isTyping is true", () => {
    vi.mocked(useStore).mockReturnValue({
      chatStore: {
        messages: [],
        isTyping: true,
        sendMessage: vi.fn(),
      },
    } as unknown as IRootStore);
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
});
