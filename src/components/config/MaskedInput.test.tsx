import { render, screen, fireEvent, waitFor } from "../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MaskedInput } from "./MaskedInput";
import { toaster } from "../ui/toaster";

vi.mock("../ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

describe("MaskedInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders with password type by default", () => {
    render(<MaskedInput value="secret" onChange={() => {}} label="Masked Field" />);
    const input = screen.getByLabelText("Masked Field");
    expect(input).toHaveAttribute("type", "password");
  });

  it("toggles visibility when eye icon is clicked", () => {
    render(<MaskedInput value="secret" onChange={() => {}} label="Masked Field" />);
    const input = screen.getByLabelText("Masked Field");
    const toggleButton = screen.getByLabelText("Show value");

    fireEvent.click(toggleButton);
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Hide value")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Hide value"));
    expect(input).toHaveAttribute("type", "password");
  });

  it("calls onChange when text is entered", () => {
    const handleChange = vi.fn();
    render(<MaskedInput value="" onChange={handleChange} label="Masked Field" />);
    const input = screen.getByLabelText("Masked Field");

    fireEvent.change(input, { target: { value: "new-value" } });
    expect(handleChange).toHaveBeenCalledWith("new-value");
  });

  it("copies value to clipboard when copy icon is clicked", async () => {
    render(<MaskedInput value="secret-to-copy" onChange={() => {}} label="Masked Field" />);
    const copyButton = screen.getByLabelText("Copy value");

    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("secret-to-copy");
    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({
        title: "Copied to clipboard",
        type: "success",
      }));
    });
  });

  it("disables copy button when value is empty", () => {
    render(<MaskedInput value="" onChange={() => {}} label="Masked Field" />);
    const copyButton = screen.getByLabelText("Copy value");
    expect(copyButton).toBeDisabled();
  });
});
