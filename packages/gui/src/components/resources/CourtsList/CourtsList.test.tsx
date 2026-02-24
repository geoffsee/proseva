import { render, screen, waitFor } from "../../../test-utils";
import { describe, it, expect } from "vitest";
import { CourtsList } from "./index";

describe("CourtsList", () => {
  it("renders heading", async () => {
    render(<CourtsList />);
    await waitFor(() => {
      expect(screen.getByText("Virginia Courts")).toBeInTheDocument();
    });
  });
});
