import { render, screen } from "../../../test-utils";
import { describe, it, expect } from "vitest";
import { GlossaryList } from "./index";

describe("GlossaryList", () => {
  it("renders heading", () => {
    render(<GlossaryList />);
    expect(screen.getByText("Legal Glossary")).toBeInTheDocument();
  });
});
