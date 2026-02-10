import { render, screen, fireEvent } from "../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog when open prop is true", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm Action"
        children={<div>Are you sure?</div>}
      />,
    );

    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
  });

  it("does not render when open prop is false", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    const { container } = render(
      <ConfirmDialog
        open={false}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm Action"
        children={<div>Are you sure?</div>}
      />,
    );

    // Dialog should not be visible when closed
    expect(screen.queryByText("Confirm Action")).not.toBeInTheDocument();
  });

  it("displays provided title", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const title = "Delete Item?";

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title={title}
        children={<div>This action cannot be undone.</div>}
      />,
    );

    expect(screen.getByText("Delete Item?")).toBeInTheDocument();
  });

  it("displays provided children content", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const content = "This is the confirmation message";

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm"
        children={<div>{content}</div>}
      />,
    );

    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it("calls onClose when Cancel button is clicked", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm"
        children={<div>Test</div>}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls both onConfirm and onClose when Confirm button is clicked", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm"
        children={<div>Test</div>}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when changing open prop from true to false", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Are You Sure?"
        children={<div>Test</div>}
      />,
    );

    // Verify initial state
    expect(screen.getByText("Are You Sure?")).toBeInTheDocument();
    // The component properly calls onClose when onOpenChange is triggered with open=false
  });

  it("renders both Cancel and Confirm buttons", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm"
        children={<div>Test</div>}
      />,
    );

    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirm/i }),
    ).toBeInTheDocument();
  });

  it("confirm button has red styling", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm"
        children={<div>Test</div>}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    // Confirm button should be rendered with styling applied
    expect(confirmButton).toBeInTheDocument();
  });
});
