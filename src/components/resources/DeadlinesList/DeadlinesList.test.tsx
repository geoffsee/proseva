import { render, screen } from "../../../test-utils";
import { describe, it, expect } from "vitest";
import { DeadlinesList } from "./index";

describe("DeadlinesList", () => {
  it("renders heading", () => {
    render(<DeadlinesList />);
    expect(screen.getByText("Common Filing Deadlines")).toBeInTheDocument();
  });
});
