import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  executeTool,
  truncateText,
  snapshotExistingData,
  autoPopulateFromDocument,
} from "./ingestion-agent";
import { db, resetDb, type DocumentRecord } from "./db";
import { InMemoryAdapter } from "./persistence";

function freshDb() {
  resetDb(new InMemoryAdapter());
}

function seedCase(
  overrides: Partial<
    typeof db extends { cases: Map<string, infer C> } ? C : never
  > = {},
) {
  const c = {
    id: "case-1",
    name: "Smith v. Jones",
    caseNumber: "CL-2024-001",
    court: "Circuit Court",
    caseType: "civil",
    status: "active" as const,
    parties: [],
    filings: [],
    notes: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
  db.cases.set(c.id, c);
  return c;
}

describe("truncateText", () => {
  it("returns short text unchanged", () => {
    expect(truncateText("hello")).toBe("hello");
  });

  it("truncates text exceeding 6000 chars", () => {
    const long = "a".repeat(7000);
    const result = truncateText(long);
    expect(result).toContain("...[truncated]");
    expect(result.length).toBeLessThan(long.length);
  });

  it("returns exactly 6000 chars unchanged", () => {
    const exact = "b".repeat(6000);
    expect(truncateText(exact)).toBe(exact);
  });
});

describe("snapshotExistingData", () => {
  beforeEach(freshDb);

  it("returns empty arrays when db is empty", () => {
    const snap = snapshotExistingData();
    expect(snap.cases).toEqual([]);
    expect(snap.deadlines).toEqual([]);
    expect(snap.contacts).toEqual([]);
  });

  it("includes case data in snapshot", () => {
    seedCase();
    const snap = snapshotExistingData();
    expect(snap.cases).toHaveLength(1);
    expect(snap.cases[0].id).toBe("case-1");
    expect(snap.cases[0].name).toBe("Smith v. Jones");
  });
});

import OpenAI from "openai";

describe("executeTool", () => {
  let state: { selectedCaseId?: string };

  beforeEach(() => {
    freshDb();
    state = {};
  });

  describe("use_existing_case", () => {
    it("links to an existing case", () => {
      seedCase();
      const result = executeTool(
        "use_existing_case",
        { caseId: "case-1" },
        state,
      );
      expect(result.selectedCaseId).toBe("case-1");
      expect(state.selectedCaseId).toBe("case-1");
      expect(result.message).toContain("Linked");
    });

    it("returns error when case not found", () => {
      const result = executeTool(
        "use_existing_case",
        { caseId: "nonexistent" },
        state,
      );
      expect(result.selectedCaseId).toBeUndefined();
      expect(result.message).toContain("not found");
    });
  });

  describe("create_case", () => {
    it("creates a new case and sets selectedCaseId", () => {
      const result = executeTool(
        "create_case",
        { name: "New Case", caseNumber: "CL-2024-999" },
        state,
      );
      expect(result.selectedCaseId).toBeDefined();
      expect(state.selectedCaseId).toBe(result.selectedCaseId);
      expect(db.cases.size).toBe(1);
      const created = db.cases.get(result.selectedCaseId!)!;
      expect(created.name).toBe("New Case");
      expect(created.caseNumber).toBe("CL-2024-999");
    });

    it("reuses existing case when caseNumber matches", () => {
      seedCase({ id: "existing-1", caseNumber: "CL-2024-001" });
      const result = executeTool(
        "create_case",
        { name: "Duplicate", caseNumber: "CL-2024-001" },
        state,
      );
      expect(result.selectedCaseId).toBe("existing-1");
      expect(result.message).toContain("Reused");
      expect(db.cases.size).toBe(1);
    });

    it("does not match when caseNumber is empty", () => {
      seedCase({ caseNumber: "" });
      executeTool("create_case", { name: "Another", caseNumber: "" }, state);
      // Empty caseNumber should not match — creates a new case
      expect(db.cases.size).toBe(2);
    });

    it("defaults missing fields", () => {
      executeTool("create_case", { name: "Minimal" }, state);
      const c = [...db.cases.values()][0];
      expect(c.caseNumber).toBe("");
      expect(c.court).toBe("");
      expect(c.status).toBe("active");
    });
  });

  describe("add_party", () => {
    it("adds a party to the selected case", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      const result = executeTool(
        "add_party",
        { name: "Alice", role: "plaintiff" },
        state,
      );
      expect(result.message).toContain("Added party");
      const c = db.cases.get("case-1")!;
      expect(c.parties).toHaveLength(1);
      expect(c.parties[0].name).toBe("Alice");
      expect(c.parties[0].role).toBe("plaintiff");
    });

    it("uses explicit caseId over selectedCaseId", () => {
      seedCase({ id: "case-1" });
      seedCase({ id: "case-2", name: "Other" });
      state.selectedCaseId = "case-1";
      executeTool(
        "add_party",
        { name: "Bob", role: "defendant", caseId: "case-2" },
        state,
      );
      expect(db.cases.get("case-1")!.parties).toHaveLength(0);
      expect(db.cases.get("case-2")!.parties).toHaveLength(1);
    });

    it("returns error when no case selected", () => {
      const result = executeTool(
        "add_party",
        { name: "Alice", role: "plaintiff" },
        state,
      );
      expect(result.message).toContain("No case selected");
    });

    it("returns error when case not found", () => {
      state.selectedCaseId = "nonexistent";
      const result = executeTool(
        "add_party",
        { name: "Alice", role: "plaintiff" },
        state,
      );
      expect(result.message).toContain("not found");
    });

    it("deduplicates by name and role", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      executeTool("add_party", { name: "Alice", role: "plaintiff" }, state);
      const result = executeTool(
        "add_party",
        { name: "Alice", role: "plaintiff" },
        state,
      );
      expect(result.message).toContain("already exists");
      expect(db.cases.get("case-1")!.parties).toHaveLength(1);
    });

    it("allows same name with different role", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      executeTool("add_party", { name: "Alice", role: "plaintiff" }, state);
      executeTool("add_party", { name: "Alice", role: "witness" }, state);
      expect(db.cases.get("case-1")!.parties).toHaveLength(2);
    });
  });

  describe("create_filing", () => {
    it("creates a filing linked to the selected case", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      const result = executeTool(
        "create_filing",
        { title: "Motion to Dismiss", date: "2024-03-01", type: "motion" },
        state,
      );
      expect(result.message).toContain("Created filing");
      expect(db.filings.size).toBe(1);
      const filing = [...db.filings.values()][0];
      expect(filing.caseId).toBe("case-1");
      expect(filing.title).toBe("Motion to Dismiss");
    });

    it("also pushes filing to case.filings array", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      executeTool(
        "create_filing",
        { title: "Order", date: "2024-03-01" },
        state,
      );
      expect(db.cases.get("case-1")!.filings).toHaveLength(1);
    });

    it("deduplicates by title, date, and caseId", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      executeTool(
        "create_filing",
        { title: "Order", date: "2024-03-01" },
        state,
      );
      const result = executeTool(
        "create_filing",
        { title: "Order", date: "2024-03-01" },
        state,
      );
      expect(result.message).toContain("already exists");
      expect(db.filings.size).toBe(1);
    });

    it("allows same title with different date", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      executeTool(
        "create_filing",
        { title: "Order", date: "2024-03-01" },
        state,
      );
      executeTool(
        "create_filing",
        { title: "Order", date: "2024-04-01" },
        state,
      );
      expect(db.filings.size).toBe(2);
    });

    it("creates filing without a case", () => {
      const result = executeTool(
        "create_filing",
        { title: "Orphan Filing" },
        state,
      );
      expect(result.message).toContain("Created filing");
      const filing = [...db.filings.values()][0];
      expect(filing.caseId).toBe("");
    });
  });

  describe("create_deadline", () => {
    it("creates a deadline linked to the selected case", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      const result = executeTool(
        "create_deadline",
        { title: "Response Due", date: "2024-04-01", type: "filing" },
        state,
      );
      expect(result.message).toContain("Created deadline");
      const dl = [...db.deadlines.values()][0];
      expect(dl.caseId).toBe("case-1");
      expect(dl.type).toBe("filing");
      expect(dl.completed).toBe(false);
    });

    it("deduplicates by title, date, and caseId", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      executeTool(
        "create_deadline",
        { title: "Hearing", date: "2024-05-01" },
        state,
      );
      const result = executeTool(
        "create_deadline",
        { title: "Hearing", date: "2024-05-01" },
        state,
      );
      expect(result.message).toContain("already exists");
      expect(db.deadlines.size).toBe(1);
    });

    it("respects completed flag", () => {
      state.selectedCaseId = undefined;
      executeTool(
        "create_deadline",
        { title: "Done", date: "2024-01-01", completed: true },
        state,
      );
      const dl = [...db.deadlines.values()][0];
      expect(dl.completed).toBe(true);
    });

    it("defaults type to other", () => {
      executeTool(
        "create_deadline",
        { title: "Something", date: "2024-06-01" },
        state,
      );
      expect([...db.deadlines.values()][0].type).toBe("other");
    });
  });

  describe("create_contact", () => {
    it("creates a contact linked to the selected case", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      const result = executeTool(
        "create_contact",
        {
          name: "John Doe",
          role: "attorney",
          email: "john@example.com",
          phone: "555-1234",
        },
        state,
      );
      expect(result.message).toContain("Created contact");
      const contact = [...db.contacts.values()][0];
      expect(contact.caseId).toBe("case-1");
      expect(contact.email).toBe("john@example.com");
    });

    it("deduplicates by name, role, and caseId", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      executeTool("create_contact", { name: "John", role: "clerk" }, state);
      const result = executeTool(
        "create_contact",
        { name: "John", role: "clerk" },
        state,
      );
      expect(result.message).toContain("already exists");
      expect(db.contacts.size).toBe(1);
    });

    it("allows same name with different role", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      executeTool("create_contact", { name: "John", role: "clerk" }, state);
      executeTool("create_contact", { name: "John", role: "attorney" }, state);
      expect(db.contacts.size).toBe(2);
    });

    it("defaults missing optional fields to empty strings", () => {
      executeTool("create_contact", { name: "Jane", role: "judge" }, state);
      const c = [...db.contacts.values()][0];
      expect(c.organization).toBe("");
      expect(c.phone).toBe("");
      expect(c.address).toBe("");
    });
  });

  describe("create_evidence", () => {
    it("creates evidence linked to the selected case", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      const result = executeTool(
        "create_evidence",
        {
          title: "Exhibit A",
          description: "Contract",
          type: "document",
          relevance: "high",
          tags: ["contract", "signed"],
        },
        state,
      );
      expect(result.message).toContain("Created evidence");
      const ev = [...db.evidences.values()][0];
      expect(ev.caseId).toBe("case-1");
      expect(ev.type).toBe("document");
      expect(ev.relevance).toBe("high");
      expect(ev.tags).toEqual(["contract", "signed"]);
    });

    it("defaults type to document and relevance to medium", () => {
      executeTool("create_evidence", { title: "Minimal Evidence" }, state);
      const ev = [...db.evidences.values()][0];
      expect(ev.type).toBe("document");
      expect(ev.relevance).toBe("medium");
      expect(ev.admissible).toBe(false);
    });

    it("handles non-array tags gracefully", () => {
      executeTool(
        "create_evidence",
        { title: "Bad Tags", tags: "not-an-array" },
        state,
      );
      const ev = [...db.evidences.values()][0];
      expect(ev.tags).toEqual([]);
    });
  });

  describe("create_note", () => {
    it("creates a note linked to the selected case", () => {
      seedCase();
      state.selectedCaseId = "case-1";
      const result = executeTool(
        "create_note",
        {
          title: "Summary",
          content: "This is a motion hearing summary.",
          category: "case-notes",
          tags: ["hearing"],
          isPinned: true,
        },
        state,
      );
      expect(result.message).toContain("Created note");
      const note = [...db.notes.values()][0];
      expect(note.caseId).toBe("case-1");
      expect(note.category).toBe("case-notes");
      expect(note.isPinned).toBe(true);
      expect(note.tags).toEqual(["hearing"]);
    });

    it("defaults category to case-notes and isPinned to false", () => {
      executeTool("create_note", { title: "Quick", content: "text" }, state);
      const note = [...db.notes.values()][0];
      expect(note.category).toBe("case-notes");
      expect(note.isPinned).toBe(false);
    });

    it("handles non-array tags", () => {
      executeTool(
        "create_note",
        { title: "T", content: "C", tags: "bad" },
        state,
      );
      expect([...db.notes.values()][0].tags).toEqual([]);
    });
  });

  describe("unknown tool", () => {
    it("returns unknown tool message", () => {
      const result = executeTool("nonexistent_tool", {}, state);
      expect(result.message).toContain("Unknown tool");
    });
  });

  describe("cross-tool linking flow", () => {
    it("creates a case then links subsequent entities via selectedCaseId", () => {
      // Simulate the agent creating a case first, then adding related records
      const caseResult = executeTool(
        "create_case",
        { name: "Doe v. Roe", caseNumber: "CL-2024-100" },
        state,
      );
      const caseId = caseResult.selectedCaseId!;

      executeTool("add_party", { name: "John Doe", role: "plaintiff" }, state);
      executeTool("add_party", { name: "Jane Roe", role: "defendant" }, state);
      executeTool(
        "create_filing",
        { title: "Complaint", date: "2024-01-15", type: "petition" },
        state,
      );
      executeTool(
        "create_deadline",
        { title: "Answer Due", date: "2024-02-15", type: "filing" },
        state,
      );
      executeTool(
        "create_contact",
        { name: "Attorney Smith", role: "attorney" },
        state,
      );
      executeTool(
        "create_evidence",
        { title: "Contract Exhibit", type: "document" },
        state,
      );
      executeTool(
        "create_note",
        { title: "Initial Review", content: "Case filed." },
        state,
      );

      // Verify all linked to the same case
      expect(db.cases.get(caseId)!.parties).toHaveLength(2);
      expect(db.cases.get(caseId)!.filings).toHaveLength(1);
      expect([...db.filings.values()][0].caseId).toBe(caseId);
      expect([...db.deadlines.values()][0].caseId).toBe(caseId);
      expect([...db.contacts.values()][0].caseId).toBe(caseId);
      expect([...db.evidences.values()][0].caseId).toBe(caseId);
      expect([...db.notes.values()][0].caseId).toBe(caseId);
    });

    it("links to existing case then adds records", () => {
      seedCase({ id: "existing-case" });
      executeTool("use_existing_case", { caseId: "existing-case" }, state);
      executeTool("add_party", { name: "Witness", role: "witness" }, state);
      executeTool(
        "create_filing",
        { title: "Response", date: "2024-06-01" },
        state,
      );

      expect(db.cases.get("existing-case")!.parties).toHaveLength(1);
      expect([...db.filings.values()][0].caseId).toBe("existing-case");
    });

    it("switches case mid-flow via use_existing_case", () => {
      seedCase({ id: "case-a", name: "Case A" });
      seedCase({ id: "case-b", name: "Case B" });

      executeTool("use_existing_case", { caseId: "case-a" }, state);
      executeTool(
        "create_filing",
        { title: "Filing A", date: "2024-01-01" },
        state,
      );

      executeTool("use_existing_case", { caseId: "case-b" }, state);
      executeTool(
        "create_filing",
        { title: "Filing B", date: "2024-02-01" },
        state,
      );

      const filings = [...db.filings.values()];
      expect(filings.find((f) => f.title === "Filing A")!.caseId).toBe(
        "case-a",
      );
      expect(filings.find((f) => f.title === "Filing B")!.caseId).toBe(
        "case-b",
      );
    });

    it("create_case dedup reuses case and subsequent tools link to it", () => {
      seedCase({ id: "orig", caseNumber: "CL-2024-001" });
      executeTool(
        "create_case",
        { name: "Duplicate Attempt", caseNumber: "CL-2024-001" },
        state,
      );
      expect(state.selectedCaseId).toBe("orig");

      executeTool(
        "add_party",
        { name: "New Party", role: "intervenor" },
        state,
      );
      expect(db.cases.get("orig")!.parties).toHaveLength(1);
      expect(db.cases.size).toBe(1);
    });
  });

  describe("autoPopulateFromDocument", () => {
    beforeEach(freshDb);

    it("processes tool calls from the model and returns log", async () => {
      seedCase({ id: "case-1", caseNumber: "CL-2024-001" });

      const mockOpenai = {
        chat: {
          completions: {
            create: mock()
              .mockResolvedValueOnce({
                choices: [
                  {
                    message: {
                      tool_calls: [
                        {
                          id: "tc-1",
                          type: "function",
                          function: {
                            name: "use_existing_case",
                            arguments: JSON.stringify({ caseId: "case-1" }),
                          },
                        },
                        {
                          id: "tc-2",
                          type: "function",
                          function: {
                            name: "create_filing",
                            arguments: JSON.stringify({
                              title: "Order",
                              date: "2024-03-01",
                            }),
                          },
                        },
                      ],
                    },
                  },
                ],
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: "Done processing." } }],
              }),
          },
        },
      } as unknown as OpenAI;

      const entry: DocumentRecord = {
        id: "doc-1",
        filename: "order.pdf",
        category: "filings",
        title: "order",
        pageCount: 2,
        dates: ["03/01/2024"],
        fileSize: 1024,
        hash: "abc",
        caseId: "",
        extractedText: "",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      const result = await autoPopulateFromDocument({
        openai: mockOpenai,
        entry,
        text: "Court order dated March 1, 2024",
      });

      expect(result.caseId).toBe("case-1");
      expect(result.log).toContain(
        "use_existing_case: Linked to existing case case-1",
      );
      expect(result.log.some((l) => l.includes("create_filing"))).toBe(true);
      expect(db.filings.size).toBe(1);
    });

    it("handles tool call parse errors gracefully", async () => {
      const mockOpenai = {
        chat: {
          completions: {
            create: mock()
              .mockResolvedValueOnce({
                choices: [
                  {
                    message: {
                      tool_calls: [
                        {
                          id: "tc-bad",
                          type: "function",
                          function: {
                            name: "create_case",
                            arguments: "{{invalid json",
                          },
                        },
                      ],
                    },
                  },
                ],
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: "Recovered." } }],
              }),
          },
        },
      } as unknown as OpenAI;

      const entry: DocumentRecord = {
        id: "doc-2",
        filename: "bad.pdf",
        category: "misc",
        title: "bad",
        pageCount: 1,
        dates: [],
        fileSize: 0,
        hash: "abc",
        caseId: "",
        extractedText: "",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      const result = await autoPopulateFromDocument({
        openai: mockOpenai,
        entry,
        text: "text",
      });
      expect(result.log.some((l) => l.includes("failed"))).toBe(true);
    });

    it("stops after model returns no tool calls", async () => {
      const mockOpenai = {
        chat: {
          completions: {
            create: mock().mockResolvedValueOnce({
              choices: [{ message: { content: "No actions needed." } }],
            }),
          },
        },
      } as unknown as OpenAI;

      const entry: DocumentRecord = {
        id: "doc-3",
        filename: "info.pdf",
        category: "misc",
        title: "info",
        pageCount: 1,
        dates: [],
        fileSize: 0,
        hash: "abc",
        caseId: "",
        extractedText: "",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      const result = await autoPopulateFromDocument({
        openai: mockOpenai,
        entry,
        text: "generic text",
      });
      expect(result.log).toContain("No actions needed.");
      expect(result.caseId).toBeUndefined();
      expect(mockOpenai.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });
});
