import { render, screen } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { TemplateSelector } from "./index";

describe("TemplateSelector", () => {
  it("renders heading", () => {
    render(<TemplateSelector onSelect={vi.fn()} />);
    expect(screen.getByText("Document Generator")).toBeInTheDocument();
  });

  it("renders template description", () => {
    render(<TemplateSelector onSelect={vi.fn()} />);
    expect(screen.getAllByText(/Select a template/)[0]).toBeInTheDocument();
  });
});
