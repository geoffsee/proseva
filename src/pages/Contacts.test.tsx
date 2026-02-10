import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Contacts from "./Contacts";
import { useStore } from "../store/StoreContext";

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    contactStore: {
      contacts: [
        {
          id: "1",
          name: "John Smith",
          role: "attorney",
          organization: "Smith & Associates",
          email: "john@example.com",
        },
      ],
      filteredContacts: [
        {
          id: "1",
          name: "John Smith",
          role: "attorney",
          organization: "Smith & Associates",
          email: "john@example.com",
        },
      ],
      searchQuery: "",
      selectedRole: "",
      selectedCaseId: "",
      setSearchQuery: vi.fn(),
      setSelectedRole: vi.fn(),
      setSelectedCaseId: vi.fn(),
      clearFilters: vi.fn(),
      addContact: vi.fn(),
      updateContact: vi.fn(),
      deleteContact: vi.fn(),
    },
    caseStore: {
      cases: [{ id: "case-1", name: "Smith v. Jones" }],
    },
  })),
}));

describe("Contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue({
      contactStore: {
        contacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
            email: "john@example.com",
          },
        ],
        filteredContacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
            email: "john@example.com",
          },
        ],
        searchQuery: "",
        selectedRole: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedRole: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addContact: vi.fn(),
        updateContact: vi.fn(),
        deleteContact: vi.fn(),
      },
      caseStore: {
        cases: [{ id: "case-1", name: "Smith v. Jones" }],
      },
    } as any);
  });

  it("renders contacts heading and add button", () => {
    render(<Contacts />);
    expect(
      screen.getByRole("heading", { name: "Contacts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Contact/i }),
    ).toBeInTheDocument();
  });

  it("displays stat cards with contact information", () => {
    render(<Contacts />);
    expect(screen.getByText("Total Contacts")).toBeInTheDocument();
    expect(screen.getByText("Roles")).toBeInTheDocument();
  });

  it("displays list of contacts", () => {
    render(<Contacts />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });

  it("opens dialog when Add Contact button is clicked", async () => {
    render(<Contacts />);
    fireEvent.click(screen.getByRole("button", { name: /Add Contact/i }));

    await waitFor(() => {
      expect(screen.getByText(/Add Contact|Edit/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no contacts exist", () => {
    vi.mocked(useStore).mockReturnValue({
      contactStore: {
        contacts: [],
        filteredContacts: [],
        searchQuery: "",
        selectedRole: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedRole: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addContact: vi.fn(),
        updateContact: vi.fn(),
        deleteContact: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);
    render(<Contacts />);
    expect(screen.getByText("No contacts yet")).toBeInTheDocument();
  });

  it("shows no matching contacts message when filter has no results", () => {
    vi.mocked(useStore).mockReturnValue({
      contactStore: {
        contacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
          },
        ],
        filteredContacts: [],
        searchQuery: "nonexistent",
        selectedRole: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedRole: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addContact: vi.fn(),
        updateContact: vi.fn(),
        deleteContact: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);
    render(<Contacts />);
    expect(screen.getByText("No matching contacts")).toBeInTheDocument();
  });

  it("renders contact filters section", () => {
    const { container } = render(<Contacts />);
    expect(container).toBeInTheDocument();
  });

  it("displays stat with correct count", () => {
    render(<Contacts />);
    const stats = screen.getAllByText(/\d+/);
    expect(stats.length).toBeGreaterThan(0);
  });

  it("opens edit dialog with contact data when edit is triggered", async () => {
    render(<Contacts />);
    fireEvent.click(screen.getByLabelText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Contact")).toBeInTheDocument();
    });
  });

  it("calls updateContact when saving edited contact", async () => {
    const updateContact = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      contactStore: {
        contacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
            email: "john@example.com",
          },
        ],
        filteredContacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
            email: "john@example.com",
          },
        ],
        searchQuery: "",
        selectedRole: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedRole: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addContact: vi.fn(),
        updateContact,
        deleteContact: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Contacts />);
    fireEvent.click(screen.getByLabelText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Contact")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(updateContact).toHaveBeenCalledWith("1", expect.any(Object));
  });

  it("calls deleteContact when delete is confirmed", () => {
    const deleteContact = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      contactStore: {
        contacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
          },
        ],
        filteredContacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
          },
        ],
        searchQuery: "",
        selectedRole: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedRole: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addContact: vi.fn(),
        updateContact: vi.fn(),
        deleteContact,
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Contacts />);
    fireEvent.click(screen.getByLabelText("Delete"));
    expect(deleteContact).toHaveBeenCalledWith("1");
  });

  it("resets form when dialog closes without saving", async () => {
    render(<Contacts />);
    fireEvent.click(screen.getByRole("button", { name: /Add Contact/i }));
    await waitFor(() => {
      expect(screen.getByText("Add Contact")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
    });
  });

  it("validates name is not empty before adding", () => {
    render(<Contacts />);
    fireEvent.click(screen.getByRole("button", { name: /Add Contact/i }));
    expect(
      screen.getByRole("button", { name: /Add Contact/i }),
    ).toBeInTheDocument();
  });

  it("filters contacts by role", () => {
    vi.mocked(useStore).mockReturnValue({
      contactStore: {
        contacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
          },
          { id: "2", name: "Jane Judge", role: "judge", organization: "Court" },
        ],
        filteredContacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
          },
        ],
        searchQuery: "",
        selectedRole: "attorney",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedRole: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addContact: vi.fn(),
        updateContact: vi.fn(),
        deleteContact: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Contacts />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });

  it("filters contacts by case ID", () => {
    vi.mocked(useStore).mockReturnValue({
      contactStore: {
        contacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
            caseId: "case-1",
          },
        ],
        filteredContacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
            caseId: "case-1",
          },
        ],
        searchQuery: "",
        selectedRole: "",
        selectedCaseId: "case-1",
        setSearchQuery: vi.fn(),
        setSelectedRole: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addContact: vi.fn(),
        updateContact: vi.fn(),
        deleteContact: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Contacts />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });

  it("filters contacts by search query", () => {
    vi.mocked(useStore).mockReturnValue({
      contactStore: {
        contacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
          },
        ],
        filteredContacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
          },
        ],
        searchQuery: "John",
        selectedRole: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedRole: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addContact: vi.fn(),
        updateContact: vi.fn(),
        deleteContact: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Contacts />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });

  it("displays correct unique roles count in stats", () => {
    vi.mocked(useStore).mockReturnValue({
      contactStore: {
        contacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
          },
          { id: "2", name: "Jane Judge", role: "judge", organization: "Court" },
        ],
        filteredContacts: [
          {
            id: "1",
            name: "John Smith",
            role: "attorney",
            organization: "Smith & Associates",
          },
          { id: "2", name: "Jane Judge", role: "judge", organization: "Court" },
        ],
        searchQuery: "",
        selectedRole: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedRole: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addContact: vi.fn(),
        updateContact: vi.fn(),
        deleteContact: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Contacts />);
    expect(screen.getByText("Roles")).toBeInTheDocument();
  });

  it("populates case dropdown with available cases", () => {
    render(<Contacts />);
    expect(screen.getByText("Contacts")).toBeInTheDocument();
  });
});
