import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EstatePlanning from "./EstatePlanning";

const mockEstatePlanStore = {
  plans: [
    {
      id: "plan-1",
      title: "Family Estate Plan",
      status: "planning",
      testatorName: "John Doe",
      testatorDateOfBirth: "1970-01-01",
      testatorAddress: "123 Main St",
      executorName: "Jane Doe",
      executorPhone: "555-1234",
      executorEmail: "jane@example.com",
      guardianName: "Bob Smith",
      guardianPhone: "555-5678",
      notes: "Some notes",
      beneficiaries: [],
      assets: [],
      documents: [],
    },
  ],
  totalEstateValue: 1000000,
  documentsNeedingReview: [],
  isLoading: false,
  searchQuery: "",
  selectedStatus: "all",
  filteredPlans: [],
  getPlan: vi.fn(),
  setSearchQuery: vi.fn(),
  setSelectedStatus: vi.fn(),
  addPlan: vi.fn().mockResolvedValue({ id: "plan-2" }),
  updatePlan: vi.fn().mockResolvedValue({ success: true }),
  deletePlan: vi.fn().mockResolvedValue({ success: true }),
  addBeneficiary: vi.fn().mockResolvedValue({ success: true }),
  removeBeneficiary: vi.fn().mockResolvedValue({ success: true }),
  addAsset: vi.fn().mockResolvedValue({ success: true }),
  removeAsset: vi.fn().mockResolvedValue({ success: true }),
  addEstateDocument: vi.fn().mockResolvedValue({ success: true }),
  updateEstateDocument: vi.fn().mockResolvedValue({ success: true }),
  removeEstateDocument: vi.fn().mockResolvedValue({ success: true }),
};

// Update filteredPlans to include the mock plan
mockEstatePlanStore.filteredPlans = mockEstatePlanStore.plans as any;
mockEstatePlanStore.getPlan.mockImplementation((id: string) =>
  mockEstatePlanStore.plans.find((p) => p.id === id),
);

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    estatePlanStore: mockEstatePlanStore,
  })),
}));

describe("EstatePlanning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders overview with stats", () => {
    render(<EstatePlanning />);
    expect(screen.getByText("Estate Planning")).toBeInTheDocument();
    expect(screen.getByText("Estate Plans")).toBeInTheDocument();
    expect(screen.getByText("$1,000,000.00")).toBeInTheDocument();
  });

  it("lists existing plans", () => {
    render(<EstatePlanning />);
    expect(screen.getByText("Family Estate Plan")).toBeInTheDocument();
    // In the list view, it's rendered as "Testator: John Doe"
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
  });

  it("opens new plan dialog", async () => {
    render(<EstatePlanning />);
    const newPlanButton = screen.getByRole("button", { name: /New Plan/i });
    fireEvent.click(newPlanButton);

    // Check for dialog title
    await waitFor(() => {
      expect(screen.getByText("New Estate Plan")).toBeInTheDocument();
    });
  });

  it("navigates to plan detail when a plan is clicked", async () => {
    render(<EstatePlanning />);
    const planItem = screen.getByText("Family Estate Plan");
    fireEvent.click(planItem);

    await waitFor(() => {
      // In detail view, we see "Plan Information"
      expect(screen.getByText("Plan Information")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument(); // Executor
    });
  });

  it("handles plan deletion", async () => {
    render(<EstatePlanning />);
    fireEvent.click(screen.getByText("Family Estate Plan"));

    // In detail view
    const deleteButton = screen.getByRole("button", { name: /Delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockEstatePlanStore.deletePlan).toHaveBeenCalledWith("plan-1");
    });
  });

  it("handles adding a beneficiary", async () => {
    render(<EstatePlanning />);
    fireEvent.click(screen.getByText("Family Estate Plan"));

    // Click Add Beneficiary button (it's the first "Add" button in the lists)
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    fireEvent.click(addButtons[0]);

    // Fill the dialog
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Add Beneficiary" }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Full legal name"), {
      target: { value: "Child Name" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("e.g. Spouse, Child, Sibling"),
      {
        target: { value: "Son" },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Beneficiary" }));

    await waitFor(() => {
      expect(mockEstatePlanStore.addBeneficiary).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({ name: "Child Name", relationship: "Son" }),
      );
    });
  });

  it("handles adding an asset", async () => {
    render(<EstatePlanning />);
    fireEvent.click(screen.getByText("Family Estate Plan"));

    // The second "Add" button is for Assets
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    fireEvent.click(addButtons[1]);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Add Asset" }),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText("e.g. Primary Residence, Savings Account"),
      {
        target: { value: "House" },
      },
    );
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "500000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Asset" }));

    await waitFor(() => {
      expect(mockEstatePlanStore.addAsset).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({ name: "House", estimatedValue: 500000 }),
      );
    });
  });
});
