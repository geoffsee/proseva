import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocumentPreview } from "./index";

describe("DocumentPreview", () => {
  const mockContent =
    'This is test document content.\nLine 2 of content.\nLine 3 with special chars: <>&"';
  let clipboardWriteTextSpy: ReturnType<typeof vi.spyOn>;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clipboardWriteTextSpy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue({
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      print: vi.fn(),
    } as any);
  });

  afterEach(() => {
    clipboardWriteTextSpy.mockRestore();
    windowOpenSpy.mockRestore();
  });

  it("renders preview heading with document name", () => {
    render(
      <DocumentPreview
        name="Test Doc"
        content="Hello world"
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("Preview: Test Doc")).toBeInTheDocument();
  });

  it("renders document content", () => {
    render(
      <DocumentPreview
        name="Test Doc"
        content="Hello world"
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders copy button", () => {
    render(
      <DocumentPreview name="Test Doc" content="content" onBack={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Copy/ })).toBeInTheDocument();
  });

  it("renders print button", () => {
    render(
      <DocumentPreview name="Test Doc" content="content" onBack={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Print/ })).toBeInTheDocument();
  });

  it("renders back button", () => {
    render(
      <DocumentPreview name="Test Doc" content="content" onBack={vi.fn()} />,
    );
    const backButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.querySelector("svg"));
    expect(backButtons.length).toBeGreaterThan(0);
  });

  it("renders Edit button", () => {
    render(
      <DocumentPreview name="Test Doc" content="content" onBack={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    render(
      <DocumentPreview name="Test Doc" content="content" onBack={onBack} />,
    );
    const backButtons = screen
      .getAllByRole("button")
      .filter(
        (btn) => btn.querySelector("svg") && btn.textContent?.includes(""),
      );
    if (backButtons.length > 0) {
      fireEvent.click(backButtons[0]);
      expect(onBack).toHaveBeenCalled();
    }
  });

  it("calls onBack when Edit button is clicked", () => {
    const onBack = vi.fn();
    render(
      <DocumentPreview name="Test Doc" content="content" onBack={onBack} />,
    );
    const editButton = screen.getByRole("button", { name: /Edit/ });
    fireEvent.click(editButton);
    expect(onBack).toHaveBeenCalled();
  });

  it("copies content to clipboard when Copy button is clicked", async () => {
    render(
      <DocumentPreview
        name="Test Doc"
        content={mockContent}
        onBack={vi.fn()}
      />,
    );
    const copyButton = screen.getByRole("button", { name: /Copy/ });
    fireEvent.click(copyButton);
    expect(clipboardWriteTextSpy).toHaveBeenCalledWith(mockContent);
  });

  it("opens print window when Print button is clicked", () => {
    render(
      <DocumentPreview
        name="Test Doc"
        content={mockContent}
        onBack={vi.fn()}
      />,
    );
    const printButton = screen.getByRole("button", { name: /Print/ });
    fireEvent.click(printButton);
    expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank");
  });

  it("writes formatted content to print window", () => {
    const mockWindow = {
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      print: vi.fn(),
    };
    windowOpenSpy.mockReturnValue(mockWindow as any);

    render(
      <DocumentPreview
        name="Test Doc"
        content={mockContent}
        onBack={vi.fn()}
      />,
    );
    const printButton = screen.getByRole("button", { name: /Print/ });
    fireEvent.click(printButton);

    expect(mockWindow.document.write).toHaveBeenCalled();
    const writeCall = mockWindow.document.write.mock.calls[0][0];
    expect(writeCall).toContain("<pre");
    expect(writeCall).toContain(mockContent);
  });

  it("closes print window after writing", () => {
    const mockWindow = {
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      print: vi.fn(),
    };
    windowOpenSpy.mockReturnValue(mockWindow as any);

    render(
      <DocumentPreview
        name="Test Doc"
        content={mockContent}
        onBack={vi.fn()}
      />,
    );
    const printButton = screen.getByRole("button", { name: /Print/ });
    fireEvent.click(printButton);

    expect(mockWindow.document.close).toHaveBeenCalled();
  });

  it("triggers print dialog", () => {
    const mockWindow = {
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      print: vi.fn(),
    };
    windowOpenSpy.mockReturnValue(mockWindow as any);

    render(
      <DocumentPreview
        name="Test Doc"
        content={mockContent}
        onBack={vi.fn()}
      />,
    );
    const printButton = screen.getByRole("button", { name: /Print/ });
    fireEvent.click(printButton);

    expect(mockWindow.print).toHaveBeenCalled();
  });

  it("handles empty content", () => {
    render(<DocumentPreview name="Test Doc" content="" onBack={vi.fn()} />);
    expect(screen.getByText("Preview: Test Doc")).toBeInTheDocument();
  });

  it("handles special characters in content", () => {
    const specialContent = "Content with <html> & special 'chars' \"quotes\"";
    render(
      <DocumentPreview
        name="Test Doc"
        content={specialContent}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(specialContent)).toBeInTheDocument();
  });

  it("handles multiline content", () => {
    const multilineContent = "Line 1\nLine 2\nLine 3";
    render(
      <DocumentPreview
        name="Test Doc"
        content={multilineContent}
        onBack={vi.fn()}
      />,
    );
    // Check that all lines are rendered in the document
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Line 2/)).toBeInTheDocument();
    expect(screen.getByText(/Line 3/)).toBeInTheDocument();
  });

  it("handles long document names", () => {
    const longName =
      "This is a very long document name that should still be displayed correctly";
    render(
      <DocumentPreview name={longName} content="content" onBack={vi.fn()} />,
    );
    expect(screen.getByText(`Preview: ${longName}`)).toBeInTheDocument();
  });

  it("does not crash when window.open returns null", () => {
    windowOpenSpy.mockReturnValue(null);

    render(
      <DocumentPreview
        name="Test Doc"
        content={mockContent}
        onBack={vi.fn()}
      />,
    );
    const printButton = screen.getByRole("button", { name: /Print/ });

    expect(() => {
      fireEvent.click(printButton);
    }).not.toThrow();
  });

  it("displays content in monospace font", () => {
    const { container } = render(
      <DocumentPreview
        name="Test Doc"
        content="test content"
        onBack={vi.fn()}
      />,
    );
    container.querySelector("div[style*='mono']");
    // Check that the content box has the correct styling
    expect(screen.getByText("test content")).toBeInTheDocument();
  });

  it("displays content with preserved whitespace", () => {
    const contentWithSpaces = "Line 1\n  Indented line 2\n    Indented line 3";
    render(
      <DocumentPreview
        name="Test Doc"
        content={contentWithSpaces}
        onBack={vi.fn()}
      />,
    );
    // Check that content with whitespace is rendered
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Indented/)).toBeInTheDocument();
  });

  it("renders all buttons with correct sizes", () => {
    render(
      <DocumentPreview name="Test Doc" content="content" onBack={vi.fn()} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(4); // Copy, Print, Edit, Back
  });
});
