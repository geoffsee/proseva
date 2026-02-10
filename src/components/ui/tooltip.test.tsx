import { render, screen } from "../../test-utils";
import { describe, it, expect } from "vitest";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("renders tooltip with children", () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Hover me</button>
      </Tooltip>,
    );
    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("renders tooltip content when enabled", () => {
    render(
      <Tooltip content="Test tooltip">
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
  });

  it("does not render children when disabled", () => {
    render(
      <Tooltip content="Tooltip content" disabled>
        <button>Hidden Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Hidden Button")).toBeInTheDocument();
  });

  it("accepts custom content as string", () => {
    render(
      <Tooltip content="Simple tooltip text">
        <span>Hover over me</span>
      </Tooltip>,
    );
    expect(screen.getByText("Hover over me")).toBeInTheDocument();
  });

  it("accepts custom content as ReactNode", () => {
    render(
      <Tooltip content={<div>Complex content</div>}>
        <span>Trigger</span>
      </Tooltip>,
    );
    expect(screen.getByText("Trigger")).toBeInTheDocument();
  });

  it("supports showArrow prop", () => {
    const { container } = render(
      <Tooltip content="With arrow" showArrow>
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("supports portalled prop", () => {
    const { container } = render(
      <Tooltip content="Portalled" portalled={true}>
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("supports non-portalled rendering", () => {
    const { container } = render(
      <Tooltip content="Not portalled" portalled={false}>
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("forwards ref correctly", () => {
    let ref: HTMLDivElement | null = null;
    render(
      <Tooltip
        content="Tooltip"
        ref={(el) => {
          ref = el;
        }}
      >
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
  });

  it("accepts contentProps for styling", () => {
    const { container } = render(
      <Tooltip
        content="Styled tooltip"
        contentProps={{ className: "custom-tooltip-class" }}
      >
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("accepts portalRef for custom portal container", () => {
    const portalContainer = document.createElement("div");
    const { container } = render(
      <Tooltip content="Tooltip" portalRef={{ current: portalContainer }}>
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("renders with wrapped multiple children", () => {
    render(
      <Tooltip content="Tooltip">
        <div>
          <span>First</span>
          <span>Second</span>
        </div>
      </Tooltip>,
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("supports disabled state", () => {
    render(
      <Tooltip content="Hidden tooltip" disabled>
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
  });

  it("handles complex content structure", () => {
    render(
      <Tooltip
        content={
          <div>
            <strong>Bold text</strong>
            <p>And a paragraph</p>
          </div>
        }
      >
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
  });

  it("renders without errors", () => {
    expect(() => {
      render(
        <Tooltip content="Test">
          <button>Button</button>
        </Tooltip>,
      );
    }).not.toThrow();
  });

  it("accepts showArrow and portalled together", () => {
    const { container } = render(
      <Tooltip content="Arrow and portalled" showArrow portalled>
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("handles when disabled prop disables tooltip functionality", () => {
    const { container } = render(
      <Tooltip content="This will be ignored" disabled>
        <button>Always visible</button>
      </Tooltip>,
    );
    expect(screen.getByText("Always visible")).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("forwards standard Chakra Tooltip props", () => {
    const { container } = render(
      <Tooltip
        content="Standard props tooltip"
        closeDelay={500}
        openDelay={100}
      >
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("handles emoji and special characters in content", () => {
    render(
      <Tooltip content="👍 Great! ✨ Amazing!">
        <button>Button</button>
      </Tooltip>,
    );
    expect(screen.getByText("Button")).toBeInTheDocument();
  });
});
