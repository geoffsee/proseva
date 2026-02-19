import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "../components/ui/provider";
import Search from "./Search";
import { searchApi } from "../lib/api";

vi.mock("../lib/api", () => ({
  searchApi: {
    search: vi.fn(),
  },
}));

const mockSearchApi = vi.mocked(searchApi);

function renderSearch() {
  return render(
    <MemoryRouter>
      <Provider>
        <Search />
      </Provider>
    </MemoryRouter>,
  );
}

describe("Search Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search page with input", () => {
    renderSearch();
    expect(
      screen.getByRole("heading", { name: /search/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search across all data/i),
    ).toBeInTheDocument();
  });

  it("shows empty state before searching", () => {
    renderSearch();
    expect(screen.getByText(/search your data/i)).toBeInTheDocument();
  });

  it("displays type filters", () => {
    renderSearch();
    expect(screen.getByText("Cases")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("Deadlines")).toBeInTheDocument();
    expect(screen.getByText("Evidence")).toBeInTheDocument();
  });

  it("performs search on Enter key", async () => {
    mockSearchApi.search.mockResolvedValueOnce({
      query: "test",
      totalResults: 0,
      results: {
        cases: { total: 0, hasMore: false, items: [] },
        contacts: { total: 0, hasMore: false, items: [] },
        deadlines: { total: 0, hasMore: false, items: [] },
        finances: { total: 0, hasMore: false, items: [] },
        evidences: { total: 0, hasMore: false, items: [] },
        filings: { total: 0, hasMore: false, items: [] },
        notes: { total: 0, hasMore: false, items: [] },
        documents: { total: 0, hasMore: false, items: [] },
      },
      timing: { searchMs: 5 },
    });

    renderSearch();

    const input = screen.getByPlaceholderText(/search across all data/i);
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockSearchApi.search).toHaveBeenCalledWith(
        "test",
        expect.any(Object),
      );
    });
  });

  it("displays search results", async () => {
    mockSearchApi.search.mockResolvedValueOnce({
      query: "motion",
      totalResults: 1,
      results: {
        cases: { total: 0, hasMore: false, items: [] },
        contacts: { total: 0, hasMore: false, items: [] },
        deadlines: { total: 0, hasMore: false, items: [] },
        finances: { total: 0, hasMore: false, items: [] },
        evidences: { total: 0, hasMore: false, items: [] },
        filings: {
          total: 1,
          hasMore: false,
          items: [
            {
              id: "filing-1",
              type: "filings",
              score: 85,
              matchedFields: ["title"],
              highlights: [
                { field: "title", snippet: "Emergency <mark>Motion</mark>" },
              ],
              data: {
                id: "filing-1",
                title: "Emergency Motion",
                date: "2025-01-01",
              },
            },
          ],
        },
        notes: { total: 0, hasMore: false, items: [] },
        documents: { total: 0, hasMore: false, items: [] },
      },
      timing: { searchMs: 10 },
    });

    renderSearch();

    const input = screen.getByPlaceholderText(/search across all data/i);
    fireEvent.change(input, { target: { value: "motion" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Emergency Motion")).toBeInTheDocument();
    });

    expect(screen.getByText(/found 1 result/i)).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("shows no results message when search returns empty", async () => {
    mockSearchApi.search.mockResolvedValueOnce({
      query: "nonexistent",
      totalResults: 0,
      results: {
        cases: { total: 0, hasMore: false, items: [] },
        contacts: { total: 0, hasMore: false, items: [] },
        deadlines: { total: 0, hasMore: false, items: [] },
        finances: { total: 0, hasMore: false, items: [] },
        evidences: { total: 0, hasMore: false, items: [] },
        filings: { total: 0, hasMore: false, items: [] },
        notes: { total: 0, hasMore: false, items: [] },
        documents: { total: 0, hasMore: false, items: [] },
      },
      timing: { searchMs: 3 },
    });

    renderSearch();

    const input = screen.getByPlaceholderText(/search across all data/i);
    fireEvent.change(input, { target: { value: "nonexistent" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  it("handles API errors gracefully", async () => {
    mockSearchApi.search.mockRejectedValueOnce(new Error("Network error"));

    renderSearch();

    const input = screen.getByPlaceholderText(/search across all data/i);
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/failed to perform search/i)).toBeInTheDocument();
    });
  });
});
