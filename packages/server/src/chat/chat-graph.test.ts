import { describe, expect, it } from "vitest";
import {
  analyzeCaseGraph,
  compressCaseGraphForPrompt,
  type AnalyzeCaseGraphResult,
} from "./chat-graph";
import type {
  Case,
  Contact,
  Deadline,
  DocumentRecord,
  Evidence,
  Filing,
  Note,
} from "../db";

const now = "2024-01-01T00:00:00.000Z";

function makeCase(id: string, name: string, caseNumber: string): Case {
  return {
    id,
    name,
    caseNumber,
    court: "Juvenile Court",
    caseType: "custody",
    status: "active",
    parties: [
      {
        id: `${id}-p1`,
        name: `${name} Party`,
        role: "Petitioner",
        contact: "party@example.com",
      },
    ],
    filings: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

function makeDeadline(
  id: string,
  caseId: string,
  completed: boolean,
): Deadline {
  return {
    id,
    caseId,
    title: `${id} deadline`,
    date: "2024-05-01",
    type: "filing",
    completed,
  };
}

function makeContact(id: string, caseId: string): Contact {
  return {
    id,
    caseId,
    name: `${id} Contact`,
    role: "Attorney",
    organization: "Test Org",
    phone: "555-555-5555",
    email: "contact@example.com",
    address: "123 Main St",
    notes: "",
  };
}

function makeFiling(id: string, caseId: string): Filing {
  return {
    id,
    caseId,
    title: `${id} Filing`,
    date: "2024-04-01",
    type: "motion",
    notes: "",
  };
}

function makeEvidence(id: string, caseId: string): Evidence {
  return {
    id,
    caseId,
    exhibitNumber: `EX-${id}`,
    title: `${id} Evidence`,
    description: "",
    type: "document",
    fileUrl: "",
    dateCollected: "2024-03-01",
    location: "Court",
    tags: [],
    relevance: "high",
    admissible: true,
    chain: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

function makeNote(id: string, caseId: string): Note {
  return {
    id,
    caseId,
    title: `${id} Note`,
    content: "",
    category: "case-notes",
    tags: [],
    isPinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

function makeDocument(id: string, caseId?: string): DocumentRecord {
  return {
    id,
    caseId: caseId ?? "",
    filename: `${id}.pdf`,
    category: "case",
    title: `${id} Doc`,
    pageCount: 3,
    dates: [],
    fileSize: 1000,
    hash: "abc123",
    extractedText: "",
    createdAt: now,
  };
}

describe("chat-graph", () => {
  it("analyzes a mixed case graph and computes expected totals", () => {
    const c1 = makeCase("c1", "Custody Matter", "JA-123");
    const c2 = makeCase("c2", "Support Matter", "CS-456");
    c1.parties.push({
      id: "c1-p2",
      name: "Second Party",
      role: "Respondent",
      contact: "second@example.com",
    });

    const result = analyzeCaseGraph(
      {
        cases: [c1, c2],
        deadlines: [
          makeDeadline("d1", "c1", false),
          makeDeadline("d2", "c1", true),
          makeDeadline("d3", "c2", false),
          makeDeadline("d-ignored", "missing", false),
        ],
        contacts: [makeContact("ct1", "c1"), makeContact("ct2", "c2")],
        filings: [makeFiling("f1", "c1")],
        evidences: [makeEvidence("e1", "c1"), makeEvidence("e2", "c2")],
        notes: [makeNote("n1", "c1"), makeNote("n2", "c1")],
        documents: [
          makeDocument("doc1", "c1"),
          makeDocument("doc2", "c2"),
          makeDocument("doc-ignored"),
        ],
      },
      { topK: 5 },
    );

    expect(result.warning).toBeUndefined();
    expect(result.scope).toEqual({ caseId: undefined, caseCount: 2 });
    expect(result.totals).toMatchObject({
      cases: 2,
      deadlines: 3,
      contacts: 2,
      filings: 1,
      evidences: 2,
      notes: 2,
      documents: 2,
      nodes: 18,
      edges: 17,
    });
    expect(result.topConnectedNodes).toHaveLength(5);
    expect(result.topConnectedNodes.map((node) => node.nodeId)).toContain(
      "case:c1",
    );

    const case1 = result.caseSummaries.find(
      (summary) => summary.caseId === "c1",
    );
    const case2 = result.caseSummaries.find(
      (summary) => summary.caseId === "c2",
    );

    expect(case1).toBeDefined();
    expect(case1?.counts).toMatchObject({
      deadlines: 2,
      openDeadlines: 1,
      contacts: 1,
      filings: 1,
      evidences: 1,
      notes: 2,
      documents: 1,
    });
    expect(case2).toBeDefined();
    expect(case2?.counts).toMatchObject({
      deadlines: 1,
      openDeadlines: 1,
      contacts: 1,
      filings: 0,
      evidences: 1,
      notes: 0,
      documents: 1,
    });
  });

  it("supports case scoping and emits warning for unknown case filters", () => {
    const c1 = makeCase("c1", "Case One", "JA-111");
    const c2 = makeCase("c2", "Case Two", "JA-222");

    const scoped = analyzeCaseGraph(
      {
        cases: [c1, c2],
        deadlines: [
          makeDeadline("d1", "c1", false),
          makeDeadline("d2", "c2", false),
        ],
        contacts: [makeContact("ct1", "c1"), makeContact("ct2", "c2")],
        filings: [],
        evidences: [],
        notes: [],
        documents: [makeDocument("doc1", "c1"), makeDocument("doc2", "c2")],
      },
      { caseId: "c1", topK: 99 },
    );

    expect(scoped.warning).toBeUndefined();
    expect(scoped.scope).toEqual({ caseId: "c1", caseCount: 1 });
    expect(scoped.totals).toMatchObject({
      cases: 1,
      deadlines: 1,
      contacts: 1,
      documents: 1,
    });
    expect(scoped.caseSummaries).toHaveLength(1);
    expect(scoped.topConnectedNodes.length).toBeLessThanOrEqual(20);

    const missing = analyzeCaseGraph(
      {
        cases: [c1, c2],
        deadlines: [makeDeadline("d1", "c1", false)],
        contacts: [makeContact("ct1", "c1")],
        filings: [makeFiling("f1", "c1")],
        evidences: [makeEvidence("e1", "c1")],
        notes: [makeNote("n1", "c1")],
        documents: [makeDocument("doc1", "c1")],
      },
      { caseId: "missing" },
    );

    expect(missing.warning).toBe('No case found for caseId "missing".');
    expect(missing.scope).toEqual({ caseId: "missing", caseCount: 0 });
    expect(missing.caseSummaries).toHaveLength(0);
    expect(missing.totals).toMatchObject({
      cases: 0,
      deadlines: 0,
      contacts: 0,
      filings: 0,
      evidences: 0,
      notes: 0,
      documents: 0,
      nodes: 1,
      edges: 0,
    });
  });

  it("compresses graph output for prompts with ordering, filtering, and clamping", () => {
    const input: AnalyzeCaseGraphResult = {
      scope: { caseCount: 3 },
      totals: {
        cases: 3,
        deadlines: 6,
        contacts: 2,
        filings: 1,
        evidences: 1,
        notes: 1,
        documents: 1,
        nodes: 12,
        edges: 11,
      },
      topConnectedNodes: [
        {
          nodeId: "workspace:proseva",
          entity: "Workspace",
          label: "ProSeVA Workspace",
          degree: 9,
        },
        { nodeId: "case:c2", entity: "Case", label: "Case Two", degree: 8 },
        { nodeId: "case:c1", entity: "Case", label: "Case One", degree: 7 },
        {
          nodeId: "deadline:d1",
          entity: "Deadline",
          label: "Deadline",
          degree: 6,
        },
      ],
      caseSummaries: [
        {
          caseId: "c1",
          caseName: "Case One",
          caseNumber: "JA-111",
          status: "active",
          connectivity: 5,
          counts: {
            deadlines: 3,
            openDeadlines: 2,
            contacts: 1,
            filings: 0,
            evidences: 0,
            notes: 0,
            documents: 0,
          },
        },
        {
          caseId: "c2",
          caseName: "Case Two",
          caseNumber: "JA-222",
          status: "active",
          connectivity: 6,
          counts: {
            deadlines: 2,
            openDeadlines: 2,
            contacts: 0,
            filings: 1,
            evidences: 0,
            notes: 1,
            documents: 0,
          },
        },
        {
          caseId: "c3",
          caseName: "Case Three",
          caseNumber: "JA-333",
          status: "pending",
          connectivity: 10,
          counts: {
            deadlines: 1,
            openDeadlines: 0,
            contacts: 1,
            filings: 0,
            evidences: 1,
            notes: 0,
            documents: 1,
          },
        },
      ],
    };

    const compressed = compressCaseGraphForPrompt(input, {
      maxCases: 2,
      maxNodes: 2,
    });
    expect(compressed.openDeadlineCount).toBe(4);
    expect(compressed.priorityCases.map((entry) => entry.caseId)).toEqual([
      "c2",
      "c1",
    ]);
    expect(compressed.bottlenecks.map((entry) => entry.caseId)).toEqual([
      "c2",
      "c1",
    ]);
    expect(compressed.hotNodes.map((node) => node.nodeId)).toEqual([
      "case:c2",
      "case:c1",
    ]);

    const clamped = compressCaseGraphForPrompt(input, {
      maxCases: 0,
      maxNodes: 100,
    });
    expect(clamped.priorityCases).toHaveLength(1);
    expect(clamped.hotNodes).toHaveLength(3);
  });
});
