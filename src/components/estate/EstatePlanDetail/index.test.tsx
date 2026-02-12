import { render, screen, fireEvent } from "../../../test-utils";
import { EstatePlanDetail } from "./index";
import { vi, describe, it, expect } from "vitest";

const mockPlan = {
  id: "plan-1",
  title: "My Estate Plan",
  status: "planning",
  testatorName: "John Doe",
  testatorDateOfBirth: "1980-01-01",
  testatorAddress: "123 Main St",
  executorName: "Jane Doe",
  executorPhone: "555-0101",
  executorEmail: "jane@example.com",
  guardianName: "Bob Smith",
  guardianPhone: "555-0202",
  beneficiaries: [
    {
      id: "b-1",
      name: "Jane Doe",
      relationship: "Spouse",
      phone: "555-0101",
      email: "jane@example.com",
    },
  ],
  assets: [
    {
      id: "a-1",
      name: "Savings Account",
      category: "bank-account",
      estimatedValue: 10000,
      ownershipType: "Sole",
      institution: "Chase",
    },
  ],
  documents: [
    {
      id: "d-1",
      type: "last-will",
      title: "My Will",
      status: "draft",
      reviewDate: "2025-01-01",
      updatedAt: "2024-12-01",
    },
  ],
  notes: "Some notes",
  createdAt: "2024-12-01",
  updatedAt: "2024-12-01",
};

describe("EstatePlanDetail", () => {
  it("renders plan details correctly", () => {
    render(
      <EstatePlanDetail
        plan={mockPlan}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddBeneficiary={vi.fn()}
        onRemoveBeneficiary={vi.fn()}
        onAddAsset={vi.fn()}
        onRemoveAsset={vi.fn()}
        onDraftDocument={vi.fn()}
        onEditDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
        onDocumentStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("My Estate Plan")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Some notes")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    render(
      <EstatePlanDetail
        plan={mockPlan}
        onBack={onBack}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddBeneficiary={vi.fn()}
        onRemoveBeneficiary={vi.fn()}
        onAddAsset={vi.fn()}
        onRemoveAsset={vi.fn()}
        onDraftDocument={vi.fn()}
        onEditDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
        onDocumentStatusChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("calls onEdit when edit button is clicked", () => {
    const onEdit = vi.fn();
    render(
      <EstatePlanDetail
        plan={mockPlan}
        onBack={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onAddBeneficiary={vi.fn()}
        onRemoveBeneficiary={vi.fn()}
        onAddAsset={vi.fn()}
        onRemoveAsset={vi.fn()}
        onDraftDocument={vi.fn()}
        onEditDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
        onDocumentStatusChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("renders sub-lists", () => {
    render(
      <EstatePlanDetail
        plan={mockPlan}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddBeneficiary={vi.fn()}
        onRemoveBeneficiary={vi.fn()}
        onAddAsset={vi.fn()}
        onRemoveAsset={vi.fn()}
        onDraftDocument={vi.fn()}
        onEditDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
        onDocumentStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("Beneficiaries")).toBeInTheDocument();
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Virginia Legal References")).toBeInTheDocument();
  });
});
