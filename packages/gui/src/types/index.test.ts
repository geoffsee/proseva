import { describe, it, expect } from "vitest";
import type {
  Party,
  Filing,
  Case,
  Deadline,
  FinancialEntry,
  Contact,
  DocumentTemplate,
  TemplateField,
  Note,
  Evidence,
  ChainOfCustodyEntry,
  ReportConfig,
  ReportSection,
  GeneratedReport,
} from "./index";

describe("Type definitions", () => {
  describe("Party type", () => {
    it("creates valid Party objects", () => {
      const party: Party = {
        id: "party-1",
        name: "John Doe",
        role: "Plaintiff",
        contact: "john@example.com",
      };
      expect(party.id).toBe("party-1");
      expect(party.name).toBe("John Doe");
      expect(party.role).toBe("Plaintiff");
      expect(party.contact).toBe("john@example.com");
    });

    it("makes contact optional", () => {
      const party: Party = {
        id: "party-1",
        name: "Jane Doe",
        role: "Defendant",
      };
      expect(party.contact).toBeUndefined();
    });
  });

  describe("Filing type", () => {
    it("creates valid Filing objects", () => {
      const filing: Filing = {
        id: "filing-1",
        title: "Motion to Dismiss",
        date: "2025-01-31",
        type: "Motion",
        notes: "Preliminary objections",
        caseId: "case-1",
      };
      expect(filing.id).toBe("filing-1");
      expect(filing.title).toBe("Motion to Dismiss");
      expect(filing.date).toBe("2025-01-31");
    });

    it("makes notes and caseId optional", () => {
      const filing: Filing = {
        id: "filing-1",
        title: "Order",
        date: "2025-01-31",
        type: "Order",
      };
      expect(filing.notes).toBeUndefined();
      expect(filing.caseId).toBeUndefined();
    });
  });

  describe("Case type", () => {
    it("creates valid Case objects", () => {
      const caseObj: Case = {
        id: "case-1",
        name: "Smith v. Jones",
        caseNumber: "2025-CV-001",
        court: "Virginia Circuit Court",
        caseType: "Civil",
        status: "active",
        parties: [],
        filings: [],
        notes: "Initial filing",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(caseObj.id).toBe("case-1");
      expect(caseObj.name).toBe("Smith v. Jones");
      expect(caseObj.status).toBe("active");
    });

    it("supports all status values", () => {
      const statuses: Case["status"][] = ["active", "closed", "pending"];
      statuses.forEach((status) => {
        const caseObj: Case = {
          id: "case",
          name: "Test",
          caseNumber: "001",
          court: "Court",
          caseType: "Civil",
          status,
          parties: [],
          filings: [],
          notes: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        expect(caseObj.status).toBe(status);
      });
    });
  });

  describe("Deadline type", () => {
    it("creates valid Deadline objects", () => {
      const deadline: Deadline = {
        id: "deadline-1",
        caseId: "case-1",
        title: "File Response",
        date: "2025-02-15",
        type: "filing",
        completed: false,
        description: "Response to motion",
        priority: "high",
        urgency: "urgent",
        daysUntil: 15,
      };
      expect(deadline.id).toBe("deadline-1");
      expect(deadline.type).toBe("filing");
      expect(deadline.completed).toBe(false);
    });

    it("makes optional fields optional", () => {
      const deadline: Deadline = {
        id: "deadline-1",
        title: "Hearing",
        date: "2025-02-15",
        type: "hearing",
        completed: false,
      };
      expect(deadline.caseId).toBeUndefined();
      expect(deadline.description).toBeUndefined();
    });

    it("supports all deadline types", () => {
      const types: Deadline["type"][] = [
        "filing",
        "hearing",
        "discovery",
        "other",
      ];
      types.forEach((type) => {
        const deadline: Deadline = {
          id: "d",
          title: "Test",
          date: "2025-01-31",
          type,
          completed: false,
        };
        expect(deadline.type).toBe(type);
      });
    });
  });

  describe("FinancialEntry type", () => {
    it("creates valid FinancialEntry objects", () => {
      const entry: FinancialEntry = {
        id: "entry-1",
        category: "expense",
        subcategory: "Legal Fees",
        amount: 5000,
        frequency: "monthly",
        date: "2025-01-31",
        description: "Attorney retainer",
      };
      expect(entry.id).toBe("entry-1");
      expect(entry.category).toBe("expense");
      expect(entry.amount).toBe(5000);
    });

    it("supports income and expense categories", () => {
      const incomeEntry: FinancialEntry = {
        id: "i1",
        category: "income",
        subcategory: "Salary",
        amount: 50000,
        frequency: "annually",
        date: "2025-01-31",
      };
      expect(incomeEntry.category).toBe("income");

      const expenseEntry: FinancialEntry = {
        id: "e1",
        category: "expense",
        subcategory: "Filing Fees",
        amount: 500,
        frequency: "one-time",
        date: "2025-01-31",
      };
      expect(expenseEntry.category).toBe("expense");
    });
  });

  describe("Contact type", () => {
    it("creates valid Contact objects", () => {
      const contact: Contact = {
        id: "contact-1",
        name: "Judge Smith",
        role: "judge",
        organization: "Virginia Circuit Court",
        phone: "555-0123",
        email: "judge@court.va.gov",
        address: "123 Court St",
        notes: "Chief Judge",
        caseId: "case-1",
      };
      expect(contact.id).toBe("contact-1");
      expect(contact.role).toBe("judge");
    });

    it("supports all contact roles", () => {
      const roles: Contact["role"][] = [
        "attorney",
        "judge",
        "clerk",
        "witness",
        "expert",
        "opposing_party",
        "other",
      ];
      roles.forEach((role) => {
        const contact: Contact = {
          id: "c",
          name: "Test",
          role,
        };
        expect(contact.role).toBe(role);
      });
    });
  });

  describe("DocumentTemplate type", () => {
    it("creates valid DocumentTemplate objects", () => {
      const template: DocumentTemplate = {
        id: "template-1",
        name: "Motion Template",
        category: "Motions",
        fields: [
          { name: "court", label: "Court Name", type: "text", required: true },
          {
            name: "caseNumber",
            label: "Case Number",
            type: "text",
            required: true,
          },
        ],
        outputFormat: "Court: {{court}}\nCase: {{caseNumber}}",
      };
      expect(template.id).toBe("template-1");
      expect(template.fields.length).toBe(2);
    });
  });

  describe("TemplateField type", () => {
    it("creates valid TemplateField objects", () => {
      const field: TemplateField = {
        name: "filed_date",
        label: "Date Filed",
        type: "date",
        required: true,
      };
      expect(field.name).toBe("filed_date");
      expect(field.type).toBe("date");
    });

    it("makes options optional for select fields", () => {
      const selectField: TemplateField = {
        name: "court_type",
        label: "Court Type",
        type: "select",
        required: true,
        options: ["Circuit", "General District", "Supreme"],
      };
      expect(selectField.options?.length).toBe(3);
    });
  });

  describe("Note type", () => {
    it("creates valid Note objects", () => {
      const note: Note = {
        id: "note-1",
        title: "Discovery Notes",
        content: "# Key Points\n- Testimony analysis",
        category: "case-notes",
        tags: ["discovery", "important"],
        caseId: "case-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPinned: true,
      };
      expect(note.id).toBe("note-1");
      expect(note.category).toBe("case-notes");
      expect(note.isPinned).toBe(true);
    });

    it("supports all note categories", () => {
      const categories: Note["category"][] = [
        "case-notes",
        "research",
        "todo",
        "general",
        "other",
      ];
      categories.forEach((category) => {
        const note: Note = {
          id: "n",
          title: "Test",
          content: "Content",
          category,
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        expect(note.category).toBe(category);
      });
    });
  });

  describe("Evidence type", () => {
    it("creates valid Evidence objects", () => {
      const evidence: Evidence = {
        id: "evidence-1",
        caseId: "case-1",
        exhibitNumber: "Exhibit A",
        title: "Email correspondence",
        description: "Key email exchange",
        type: "document",
        fileUrl: "https://example.com/file.pdf",
        dateCollected: "2025-01-15",
        location: "Email server backup",
        tags: ["communications", "important"],
        relevance: "high",
        admissible: true,
        chain: [],
        notes: "Original preserved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(evidence.id).toBe("evidence-1");
      expect(evidence.relevance).toBe("high");
      expect(evidence.admissible).toBe(true);
    });

    it("supports all evidence types", () => {
      const types: Evidence["type"][] = [
        "document",
        "photo",
        "video",
        "audio",
        "physical",
        "testimony",
        "digital",
        "other",
      ];
      types.forEach((type) => {
        const evidence: Evidence = {
          id: "e",
          title: "Test",
          type,
          tags: [],
          relevance: "medium",
          chain: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        expect(evidence.type).toBe(type);
      });
    });
  });

  describe("ChainOfCustodyEntry type", () => {
    it("creates valid ChainOfCustodyEntry objects", () => {
      const entry: ChainOfCustodyEntry = {
        id: "entry-1",
        date: "2025-01-31",
        transferredFrom: "Detective Smith",
        transferredTo: "Evidence Technician",
        purpose: "Analysis",
        notes: "Sealed and labeled",
      };
      expect(entry.id).toBe("entry-1");
      expect(entry.transferredTo).toBe("Evidence Technician");
    });
  });

  describe("ReportConfig type", () => {
    it("creates valid ReportConfig objects for case-summary", () => {
      const config: ReportConfig = {
        type: "case-summary",
        caseId: "case-1",
        options: { includeAI: true },
      };
      expect(config.type).toBe("case-summary");
      expect(config.caseId).toBe("case-1");
    });

    it("creates valid ReportConfig objects with date ranges", () => {
      const config: ReportConfig = {
        type: "financial",
        dateRange: { from: "2025-01-01", to: "2025-12-31" },
        options: { includeAI: false },
      };
      expect(config.dateRange?.from).toBe("2025-01-01");
      expect(config.dateRange?.to).toBe("2025-12-31");
    });

    it("supports all report types", () => {
      const types: ReportConfig["type"][] = [
        "case-summary",
        "evidence-analysis",
        "financial",
        "chronology",
      ];
      types.forEach((type) => {
        const config: ReportConfig = { type, options: { includeAI: false } };
        expect(config.type).toBe(type);
      });
    });
  });

  describe("ReportSection type", () => {
    it("creates valid ReportSection objects", () => {
      const section: ReportSection = {
        heading: "Case Summary",
        content: "Detailed case information",
        type: "narrative",
      };
      expect(section.heading).toBe("Case Summary");
      expect(section.type).toBe("narrative");
    });

    it("supports all section types", () => {
      const types: ReportSection["type"][] = ["narrative", "table", "list"];
      types.forEach((type) => {
        const section: ReportSection = {
          heading: "Test",
          content: "Content",
          type,
        };
        expect(section.type).toBe(type);
      });
    });
  });

  describe("GeneratedReport type", () => {
    it("creates valid GeneratedReport objects", () => {
      const report: GeneratedReport = {
        title: "Case Summary Report",
        sections: [
          { heading: "Overview", content: "Case overview", type: "narrative" },
          { heading: "Timeline", content: "Case timeline", type: "table" },
        ],
        metadata: {
          generatedAt: new Date().toISOString(),
          caseName: "Smith v. Jones",
          dateRange: "2025-01-01 to 2025-12-31",
        },
      };
      expect(report.title).toBe("Case Summary Report");
      expect(report.sections.length).toBe(2);
      expect(report.metadata.caseName).toBe("Smith v. Jones");
    });

    it("makes metadata fields optional", () => {
      const report: GeneratedReport = {
        title: "Report",
        sections: [],
        metadata: {
          generatedAt: new Date().toISOString(),
        },
      };
      expect(report.metadata.caseName).toBeUndefined();
      expect(report.metadata.dateRange).toBeUndefined();
    });
  });
});
