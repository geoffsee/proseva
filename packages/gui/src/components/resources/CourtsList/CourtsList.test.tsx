import { render, screen } from "../../../test-utils";
import { describe, it, expect } from "vitest";
import { CourtsList } from "./index";

describe("CourtsList", () => {
  it("renders heading", () => {
    render(<CourtsList />);
    expect(screen.getByText("Virginia Courts")).toBeInTheDocument();
  });
});
