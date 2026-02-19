import { render, screen } from "../../../test-utils";
import { describe, it, expect } from "vitest";
import { StatutesList } from "./index";

describe("StatutesList", () => {
  it("renders heading", () => {
    render(<StatutesList />);
    expect(screen.getByText("Key Virginia Statutes")).toBeInTheDocument();
  });
});
