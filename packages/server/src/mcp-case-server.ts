import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { db } from "./db";
import { join } from "path";
import { readFile } from "fs/promises";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

const appRoot = process.env.PROSEVA_DATA_DIR ?? join(__dir, "../../..");

const server = new McpServer({
  name: "case-management",
  version: "1.0.0",
});

server.tool(
  "GetCases",
  "List all cases with their parties and filings",
  {},
  async () => {
    return {
      content: [{ type: "text", text: JSON.stringify([...db.cases.values()]) }],
    };
  }
);

server.tool(
  "GetDeadlines",
  "List all deadlines, optionally filtered by caseId",
  {
    caseId: z.string().optional().describe("Optional case ID to filter by"),
  },
  async ({ caseId }) => {
    let deadlines = [...db.deadlines.values()];
    if (caseId) deadlines = deadlines.filter((d) => d.caseId === caseId);
    return {
      content: [{ type: "text", text: JSON.stringify(deadlines) }],
    };
  }
);

server.tool(
  "GetContacts",
  "List all contacts, optionally filtered by caseId",
  {
    caseId: z.string().optional().describe("Optional case ID to filter by"),
  },
  async ({ caseId }) => {
    let contacts = [...db.contacts.values()];
    if (caseId) contacts = contacts.filter((c) => c.caseId === caseId);
    return {
      content: [{ type: "text", text: JSON.stringify(contacts) }],
    };
  }
);

server.tool(
  "GetFinances",
  "List all financial entries",
  {},
  async () => {
    return {
      content: [{ type: "text", text: JSON.stringify([...db.finances.values()]) }],
    };
  }
);

server.tool(
  "GetDocuments",
  "List all ingested documents from the document index",
  {},
  async () => {
    const docs = [...db.documents.values()];
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            docs.map(({ id, title, category, pageCount }) => ({
              id,
              title,
              category,
              pages: pageCount,
            }))
          ),
        },
      ],
    };
  }
);

server.tool(
  "GetDocumentText",
  "Read the extracted text of a specific document by its ID",
  {
    id: z.string().describe("The document ID"),
  },
  async ({ id }) => {
    const doc = db.documents.get(id);
    if (!doc) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Document not found" }) }],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: doc.id,
            title: doc.title,
            text: doc.extractedText,
          }),
        },
      ],
    };
  }
);

server.tool(
  "SearchTimeline",
  "Search timeline events by date, party, title, case number, or keyword. Returns chronological events from the case timeline.",
  {
    query: z.string().optional().describe("Search query to match against event titles, details, or parties"),
    party: z.string().optional().describe("Filter by party (Father, Mother, Court)"),
    caseNumber: z.string().optional().describe("Filter by case number (e.g., JA018953-05-00)"),
    isCritical: z.boolean().optional().describe("Filter to only critical events"),
    startDate: z.string().optional().describe("Filter events after this date (MM-DD format)"),
    endDate: z.string().optional().describe("Filter events before this date (MM-DD format)"),
  },
  async (args) => {
    interface TimelineEvent {
      title?: string;
      details?: string;
      party?: string;
      date?: string;
      case?: { number?: string };
      isCritical?: boolean;
      source?: string;
    }

    try {
      const timelinePath = join(
        appRoot,
        "case-data/case-documents/timeline_data.json"
      );
      const timelineRaw = await readFile(timelinePath, "utf-8");
      const timelineData = JSON.parse(timelineRaw);
      let events: TimelineEvent[] = timelineData.events || [];
      
      const query = args.query;
      const party = args.party;
      const caseNumber = args.caseNumber;
      const isCritical = args.isCritical;
      const startDate = args.startDate;
      const endDate = args.endDate;

      // Apply filters
      if (query) {
        const q = query.toLowerCase();
        events = events.filter(
          (e: TimelineEvent) =>
            e.title?.toLowerCase().includes(q) ||
            e.details?.toLowerCase().includes(q) ||
            e.party?.toLowerCase().includes(q)
        );
      }
      if (party) {
        events = events.filter((e: TimelineEvent) => e.party === party);
      }
      if (caseNumber) {
        events = events.filter(
          (e: TimelineEvent) => e.case?.number === caseNumber
        );
      }
      if (isCritical !== undefined) {
        events = events.filter(
          (e: TimelineEvent) => e.isCritical === isCritical
        );
      }
      if (startDate) {
        events = events.filter(
          (e: TimelineEvent) => e.date && e.date >= startDate
        );
      }
      if (endDate) {
        events = events.filter(
          (e: TimelineEvent) => e.date && e.date <= endDate
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total: events.length,
              events: events.map((e: TimelineEvent) => ({
                date: e.date,
                party: e.party,
                title: e.title,
                caseNumber: e.case?.number,
                isCritical: e.isCritical,
                details: e.details,
                source: e.source,
              })),
            }),
          },
        ],
      };
    } catch {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Could not search timeline" }) }],
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
