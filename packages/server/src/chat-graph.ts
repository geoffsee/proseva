import { createKnowledgeGraph } from "mst-graph";
import type {
  Case,
  Contact,
  Deadline,
  DocumentRecord,
  Evidence,
  Filing,
  Note,
} from "./db";

type GraphEntity =
  | "Workspace"
  | "Case"
  | "Party"
  | "Deadline"
  | "Contact"
  | "Filing"
  | "Evidence"
  | "Note"
  | "Document";

type GraphRelation =
  | "HAS_CASE"
  | "HAS_PARTY"
  | "HAS_DEADLINE"
  | "HAS_CONTACT"
  | "HAS_FILING"
  | "HAS_EVIDENCE"
  | "HAS_NOTE"
  | "HAS_DOCUMENT";

export interface ChatGraphInput {
  cases: Case[];
  deadlines: Deadline[];
  contacts: Contact[];
  filings: Filing[];
  evidences: Evidence[];
  notes: Note[];
  documents: DocumentRecord[];
}

export interface AnalyzeCaseGraphOptions {
  caseId?: string;
  topK?: number;
}

export interface CaseGraphSummary {
  caseId: string;
  caseName: string;
  caseNumber: string;
  status: Case["status"];
  connectivity: number;
  counts: {
    deadlines: number;
    openDeadlines: number;
    contacts: number;
    filings: number;
    evidences: number;
    notes: number;
    documents: number;
  };
}

export interface AnalyzeCaseGraphResult {
  scope: {
    caseId?: string;
    caseCount: number;
  };
  totals: {
    cases: number;
    deadlines: number;
    contacts: number;
    filings: number;
    evidences: number;
    notes: number;
    documents: number;
    nodes: number;
    edges: number;
  };
  topConnectedNodes: Array<{
    nodeId: string;
    entity: string;
    label: string;
    degree: number;
  }>;
  caseSummaries: CaseGraphSummary[];
  warning?: string;
}

export interface CompressCaseGraphOptions {
  maxCases?: number;
  maxNodes?: number;
}

export interface CompressedCaseGraphSnapshot {
  scope: AnalyzeCaseGraphResult["scope"];
  totals: AnalyzeCaseGraphResult["totals"];
  openDeadlineCount: number;
  priorityCases: Array<{
    caseId: string;
    caseNumber: string;
    caseName: string;
    status: Case["status"];
    connectivity: number;
    openDeadlines: number;
    recordCount: number;
  }>;
  bottlenecks: Array<{
    caseId: string;
    caseNumber: string;
    caseName: string;
    openDeadlines: number;
  }>;
  hotNodes: Array<{
    nodeId: string;
    entity: string;
    label: string;
    degree: number;
  }>;
  warning?: string;
}

type GraphNode = {
  id: string;
  entity: GraphEntity;
  attributes: Record<string, string | number | boolean>;
};

type GraphEdge = {
  id: string;
  relation: GraphRelation;
  from: string;
  to: string;
  attributes: Record<string, string | number | boolean>;
};

export function analyzeCaseGraph(
  input: ChatGraphInput,
  options: AnalyzeCaseGraphOptions = {},
): AnalyzeCaseGraphResult {
  const caseFilter = options.caseId?.trim();
  const topK = clampTopK(options.topK);
  const selectedCases = caseFilter
    ? input.cases.filter((c) => c.id === caseFilter)
    : input.cases;
  const selectedCaseIds = new Set(selectedCases.map((c) => c.id));

  const workspaceNodeId = "workspace:proseva";
  const nodes: GraphNode[] = [
    {
      id: workspaceNodeId,
      entity: "Workspace",
      attributes: { label: "ProSeVA Workspace" },
    },
  ];
  const edges: GraphEdge[] = [];

  for (const caseRecord of selectedCases) {
    nodes.push({
      id: `case:${caseRecord.id}`,
      entity: "Case",
      attributes: {
        label: caseRecord.name,
        caseNumber: caseRecord.caseNumber,
        status: caseRecord.status,
      },
    });
    edges.push({
      id: `edge:workspace-case:${caseRecord.id}`,
      relation: "HAS_CASE",
      from: workspaceNodeId,
      to: `case:${caseRecord.id}`,
      attributes: {},
    });

    for (const party of caseRecord.parties ?? []) {
      nodes.push({
        id: `party:${caseRecord.id}:${party.id}`,
        entity: "Party",
        attributes: {
          label: party.name,
          role: party.role,
        },
      });
      edges.push({
        id: `edge:case-party:${caseRecord.id}:${party.id}`,
        relation: "HAS_PARTY",
        from: `case:${caseRecord.id}`,
        to: `party:${caseRecord.id}:${party.id}`,
        attributes: {},
      });
    }
  }

  for (const deadline of input.deadlines) {
    if (!selectedCaseIds.has(deadline.caseId)) continue;
    nodes.push({
      id: `deadline:${deadline.id}`,
      entity: "Deadline",
      attributes: {
        label: deadline.title,
        type: deadline.type,
        completed: deadline.completed,
      },
    });
    edges.push({
      id: `edge:case-deadline:${deadline.caseId}:${deadline.id}`,
      relation: "HAS_DEADLINE",
      from: `case:${deadline.caseId}`,
      to: `deadline:${deadline.id}`,
      attributes: {},
    });
  }

  for (const contact of input.contacts) {
    if (!selectedCaseIds.has(contact.caseId)) continue;
    nodes.push({
      id: `contact:${contact.id}`,
      entity: "Contact",
      attributes: {
        label: contact.name,
        role: contact.role || "contact",
      },
    });
    edges.push({
      id: `edge:case-contact:${contact.caseId}:${contact.id}`,
      relation: "HAS_CONTACT",
      from: `case:${contact.caseId}`,
      to: `contact:${contact.id}`,
      attributes: {},
    });
  }

  for (const filing of input.filings) {
    if (!selectedCaseIds.has(filing.caseId)) continue;
    nodes.push({
      id: `filing:${filing.id}`,
      entity: "Filing",
      attributes: {
        label: filing.title,
        type: filing.type || "filing",
      },
    });
    edges.push({
      id: `edge:case-filing:${filing.caseId}:${filing.id}`,
      relation: "HAS_FILING",
      from: `case:${filing.caseId}`,
      to: `filing:${filing.id}`,
      attributes: {},
    });
  }

  for (const evidence of input.evidences) {
    if (!selectedCaseIds.has(evidence.caseId)) continue;
    nodes.push({
      id: `evidence:${evidence.id}`,
      entity: "Evidence",
      attributes: {
        label: evidence.title,
        type: evidence.type,
      },
    });
    edges.push({
      id: `edge:case-evidence:${evidence.caseId}:${evidence.id}`,
      relation: "HAS_EVIDENCE",
      from: `case:${evidence.caseId}`,
      to: `evidence:${evidence.id}`,
      attributes: {},
    });
  }

  for (const note of input.notes) {
    if (!selectedCaseIds.has(note.caseId)) continue;
    nodes.push({
      id: `note:${note.id}`,
      entity: "Note",
      attributes: {
        label: note.title,
        category: note.category,
      },
    });
    edges.push({
      id: `edge:case-note:${note.caseId}:${note.id}`,
      relation: "HAS_NOTE",
      from: `case:${note.caseId}`,
      to: `note:${note.id}`,
      attributes: {},
    });
  }

  for (const doc of input.documents) {
    if (!doc.caseId || !selectedCaseIds.has(doc.caseId)) continue;
    nodes.push({
      id: `document:${doc.id}`,
      entity: "Document",
      attributes: {
        label: doc.title,
        category: doc.category,
        pages: doc.pageCount,
      },
    });
    edges.push({
      id: `edge:case-document:${doc.caseId}:${doc.id}`,
      relation: "HAS_DOCUMENT",
      from: `case:${doc.caseId}`,
      to: `document:${doc.id}`,
      attributes: {},
    });
  }

  const dedupedNodes = dedupeNodes(nodes);
  const nodeIdSet = new Set(dedupedNodes.map((n) => n.id));
  const dedupedEdges = dedupeEdges(edges).filter(
    (edge) => nodeIdSet.has(edge.from) && nodeIdSet.has(edge.to),
  );

  const graphStore = createKnowledgeGraph();
  registerSchema(graphStore);
  graphStore.bindEnvironment({
    nodes: dedupedNodes,
    edges: dedupedEdges,
  });

  const degreeCentrality = graphStore.runReasoner("degreeCentrality") as Record<
    string,
    number
  >;

  const caseSummaries: CaseGraphSummary[] = selectedCases.map((caseRecord) => {
    const caseId = caseRecord.id;
    return {
      caseId,
      caseName: caseRecord.name,
      caseNumber: caseRecord.caseNumber,
      status: caseRecord.status,
      connectivity: degreeCentrality[`case:${caseId}`] ?? 0,
      counts: {
        deadlines: input.deadlines.filter((d) => d.caseId === caseId).length,
        openDeadlines: input.deadlines.filter(
          (d) => d.caseId === caseId && !d.completed,
        ).length,
        contacts: input.contacts.filter((c) => c.caseId === caseId).length,
        filings: input.filings.filter((f) => f.caseId === caseId).length,
        evidences: input.evidences.filter((e) => e.caseId === caseId).length,
        notes: input.notes.filter((n) => n.caseId === caseId).length,
        documents: input.documents.filter((d) => d.caseId === caseId).length,
      },
    };
  });

  const topConnectedNodes = Object.entries(degreeCentrality)
    .sort(([, leftDegree], [, rightDegree]) => rightDegree - leftDegree)
    .slice(0, topK)
    .map(([nodeId, degree]) => {
      const node = graphStore.graph.nodes.get(nodeId);
      return {
        nodeId,
        entity: node?.entity.id ?? "Unknown",
        label: node?.label ?? nodeId,
        degree,
      };
    });

  const warning =
    caseFilter && selectedCases.length === 0
      ? `No case found for caseId "${caseFilter}".`
      : undefined;

  return {
    scope: {
      caseId: caseFilter || undefined,
      caseCount: selectedCases.length,
    },
    totals: {
      cases: selectedCases.length,
      deadlines: input.deadlines.filter((d) => selectedCaseIds.has(d.caseId))
        .length,
      contacts: input.contacts.filter((c) => selectedCaseIds.has(c.caseId))
        .length,
      filings: input.filings.filter((f) => selectedCaseIds.has(f.caseId))
        .length,
      evidences: input.evidences.filter((e) => selectedCaseIds.has(e.caseId))
        .length,
      notes: input.notes.filter((n) => selectedCaseIds.has(n.caseId)).length,
      documents: input.documents.filter(
        (d) => !!d.caseId && selectedCaseIds.has(d.caseId),
      ).length,
      nodes: dedupedNodes.length,
      edges: dedupedEdges.length,
    },
    topConnectedNodes,
    caseSummaries,
    warning,
  };
}

export function compressCaseGraphForPrompt(
  result: AnalyzeCaseGraphResult,
  options: CompressCaseGraphOptions = {},
): CompressedCaseGraphSnapshot {
  const maxCases = clampLimit(options.maxCases, 4, 1, 8);
  const maxNodes = clampLimit(options.maxNodes, 6, 1, 12);
  const sortedCases = [...result.caseSummaries].sort((left, right) => {
    const openDeadlineDelta =
      right.counts.openDeadlines - left.counts.openDeadlines;
    if (openDeadlineDelta !== 0) return openDeadlineDelta;

    const connectivityDelta = right.connectivity - left.connectivity;
    if (connectivityDelta !== 0) return connectivityDelta;

    const recordDelta = countCaseRecords(right) - countCaseRecords(left);
    if (recordDelta !== 0) return recordDelta;

    return left.caseId.localeCompare(right.caseId);
  });

  return {
    scope: result.scope,
    totals: result.totals,
    openDeadlineCount: result.caseSummaries.reduce(
      (sum, summary) => sum + summary.counts.openDeadlines,
      0,
    ),
    priorityCases: sortedCases.slice(0, maxCases).map((summary) => ({
      caseId: summary.caseId,
      caseNumber: summary.caseNumber,
      caseName: summary.caseName,
      status: summary.status,
      connectivity: summary.connectivity,
      openDeadlines: summary.counts.openDeadlines,
      recordCount: countCaseRecords(summary),
    })),
    bottlenecks: sortedCases
      .filter((summary) => summary.counts.openDeadlines > 0)
      .slice(0, 3)
      .map((summary) => ({
        caseId: summary.caseId,
        caseNumber: summary.caseNumber,
        caseName: summary.caseName,
        openDeadlines: summary.counts.openDeadlines,
      })),
    hotNodes: result.topConnectedNodes
      .filter((node) => node.entity !== "Workspace")
      .slice(0, maxNodes)
      .map((node) => ({
        nodeId: node.nodeId,
        entity: node.entity,
        label: node.label,
        degree: node.degree,
      })),
    warning: result.warning,
  };
}

function registerSchema(store: ReturnType<typeof createKnowledgeGraph>) {
  const entities: Array<{ id: GraphEntity; label: string }> = [
    { id: "Workspace", label: "Workspace" },
    { id: "Case", label: "Case" },
    { id: "Party", label: "Party" },
    { id: "Deadline", label: "Deadline" },
    { id: "Contact", label: "Contact" },
    { id: "Filing", label: "Filing" },
    { id: "Evidence", label: "Evidence" },
    { id: "Note", label: "Note" },
    { id: "Document", label: "Document" },
  ];
  for (const entity of entities) {
    store.schema.addEntity(entity);
  }

  const relations: Array<{ id: GraphRelation; label: string }> = [
    { id: "HAS_CASE", label: "has case" },
    { id: "HAS_PARTY", label: "has party" },
    { id: "HAS_DEADLINE", label: "has deadline" },
    { id: "HAS_CONTACT", label: "has contact" },
    { id: "HAS_FILING", label: "has filing" },
    { id: "HAS_EVIDENCE", label: "has evidence" },
    { id: "HAS_NOTE", label: "has note" },
    { id: "HAS_DOCUMENT", label: "has document" },
  ];
  for (const relation of relations) {
    store.schema.addRelation(relation);
  }
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const byId = new Map<string, GraphNode>();
  for (const node of nodes) {
    if (!byId.has(node.id)) {
      byId.set(node.id, node);
      continue;
    }
    const existing = byId.get(node.id)!;
    byId.set(node.id, {
      ...existing,
      attributes: {
        ...existing.attributes,
        ...node.attributes,
      },
    });
  }
  return [...byId.values()];
}

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const byId = new Map<string, GraphEdge>();
  for (const edge of edges) {
    if (!byId.has(edge.id)) byId.set(edge.id, edge);
  }
  return [...byId.values()];
}

function clampTopK(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 8;
  if (value < 1) return 1;
  if (value > 20) return 20;
  return Math.floor(value);
}

function countCaseRecords(summary: CaseGraphSummary): number {
  return (
    summary.counts.deadlines +
    summary.counts.contacts +
    summary.counts.filings +
    summary.counts.evidences +
    summary.counts.notes +
    summary.counts.documents
  );
}

function clampLimit(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return Math.floor(value);
}
