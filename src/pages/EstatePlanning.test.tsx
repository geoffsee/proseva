import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../test-utils";
import EstatePlanning from "./EstatePlanning";
import { useStore } from "../store/StoreContext";

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(),
}));

const mockPlan = {
  id: "plan-1",
  title: "My Estate Plan",
  status: "planning",
  testatorName: "John Doe",
  testatorDateOfBirth: "1960-01-15",
  testatorAddress: "123 Main St, Richmond, VA",
  executorName: "Jane Doe",
  executorPhone: "555-0100",
  executorEmail: "jane@example.com",
  guardianName: "",
  guardianPhone: "",
  beneficiaries: [
    {
      id: "b-1",
      name: "Alice Doe",
      relationship: "Daughter",
      phone: "555-0101",
      email: "alice@example.com",
      dateOfBirth: "",
      address: "",
      notes: "",
    },
  ],
  assets: [
    {
      id: "a-1",
      name: "Primary Residence",
      category: "real-property",
      estimatedValue: 350000,
      ownershipType: "Sole",
      institution: "",
      accountNumber: "",
      beneficiaryIds: [],
      notes: "",
    },
  ],
  documents: [
    {
      id: "d-1",
      type: "last-will",
      title: "Last Will & Testament",
      status: "draft",
      reviewDate: "",
      signedDate: "",
      content: "",
      fieldValues: {},
      templateId: "",
      notes: "",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    },
  ],
  notes: "",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const defaultStore = {
  estatePlanStore: {
    plans: [mockPlan],
    filteredPlans: [mockPlan],
    sortedPlans: [mockPlan],
    totalEstateValue: 350000,
    documentsNeedingReview: [],
    selectedStatus: "all",
    searchQuery: "",
    getPlan: (id: string) => (id === "plan-1" ? mockPlan : undefined),
    loadPlans: vi.fn(),
    addPlan: vi.fn(),
    updatePlan: vi.fn(),
    deletePlan: vi.fn(),
    addBeneficiary: vi.fn(),
    removeBeneficiary: vi.fn(),
    addAsset: vi.fn(),
    removeAsset: vi.fn(),
    addEstateDocument: vi.fn(),
    updateEstateDocument: vi.fn(),
    removeEstateDocument: vi.fn(),
    setSelectedStatus: vi.fn(),
    setSearchQuery: vi.fn(),
    clearFilters: vi.fn(),
  },
};

describe("EstatePlanning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue(defaultStore as any);
  });

  it("renders the estate planning heading", () => {
    render(<EstatePlanning />, { withRouter: true });
    expect(
      screen.getByRole("heading", { name: "Estate Planning" }),
    ).toBeInTheDocument();
  });

  it("displays stat cards", () => {
    render(<EstatePlanning />, { withRouter: true });
    expect(screen.getByText("Estate Plans")).toBeInTheDocument();
    expect(screen.getByText("Total Estate Value")).toBeInTheDocument();
    expect(screen.getByText("Reviews Due")).toBeInTheDocument();
  });

  it("shows the New Plan button", () => {
    render(<EstatePlanning />, { withRouter: true });
    expect(
      screen.getByRole("button", { name: /New Plan/i }),
    ).toBeInTheDocument();
  });

  it("displays plan list with plan title", () => {
    render(<EstatePlanning />, { withRouter: true });
    expect(screen.getByText("My Estate Plan")).toBeInTheDocument();
  });

  it("shows empty state when no plans", () => {
    vi.mocked(useStore).mockReturnValue({
      estatePlanStore: {
        ...defaultStore.estatePlanStore,
        plans: [],
        filteredPlans: [],
        sortedPlans: [],
        totalEstateValue: 0,
      },
    } as any);
    render(<EstatePlanning />, { withRouter: true });
    expect(screen.getByText("No estate plans yet")).toBeInTheDocument();
  });

  it("shows search input", () => {
    render(<EstatePlanning />, { withRouter: true });
    expect(screen.getByPlaceholderText("Search plans...")).toBeInTheDocument();
  });
});
