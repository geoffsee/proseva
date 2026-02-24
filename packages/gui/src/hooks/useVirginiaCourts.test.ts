import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockCourts = [
  {
    name: "Accomack GD",
    locality: "Accomack",
    type: "General District" as const,
    district: "2A Judicial District",
    clerk: "Test Clerk",
    phone: "757/787-0923",
    phones: undefined,
    fax: "757-787-5619",
    email: null,
    address: "P. O. Box 276, Accomac, VA 23301",
    city: "Accomac",
    state: "VA",
    zip: "23301",
    hours: "8:30AM - 4:30PM",
    website: "https://www.vacourts.gov/courts/gd/accomack/home",
    judges: ["Hon. Patrick A. Robbins"],
  },
];

const mockList = vi.fn().mockResolvedValue(mockCourts);

vi.mock("../lib/api", () => ({
  virginiaCourtsApi: {
    list: (...args: unknown[]) => mockList(...args),
  },
}));

describe("useVirginiaCourts", () => {
  beforeEach(async () => {
    mockList.mockClear();
    // Reset module-level cache by re-importing fresh
    vi.resetModules();
  });

  it("returns courts after loading", async () => {
    const { useVirginiaCourts } = await import("./useVirginiaCourts");
    const { result } = renderHook(() => useVirginiaCourts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.courts).toEqual(mockCourts);
  });

  it("starts with loading true before data arrives", async () => {
    // Use a delayed mock to ensure we can observe loading state
    let resolvePromise: (v: typeof mockCourts) => void;
    mockList.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolvePromise = r;
        }),
    );

    const { useVirginiaCourts } = await import("./useVirginiaCourts");
    const { result } = renderHook(() => useVirginiaCourts());

    expect(result.current.loading).toBe(true);
    expect(result.current.courts).toEqual([]);

    // Resolve and verify transition
    resolvePromise!(mockCourts);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.courts).toEqual(mockCourts);
  });

  it("returns courts with expected fields", async () => {
    const { useVirginiaCourts } = await import("./useVirginiaCourts");
    const { result } = renderHook(() => useVirginiaCourts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(Array.isArray(result.current.courts)).toBe(true);
    expect(result.current.courts.length).toBeGreaterThan(0);

    const court = result.current.courts[0];
    expect(court.name).toBe("Accomack GD");
    expect(court.type).toBe("General District");
    expect(court.fax).toBe("757-787-5619");
    expect(Array.isArray(court.judges)).toBe(true);
  });
});
