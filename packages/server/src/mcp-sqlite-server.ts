import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Database } from "bun:sqlite";

const log = (...args: unknown[]) => console.error("[mcp-sqlite]", ...args);

// Parse --db <path> from CLI args
let dbPath: string | null = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--db" && argv[i + 1]) {
    dbPath = argv[i + 1];
    break;
  }
}

if (!dbPath) {
  log("Usage: bun run mcp-sqlite-server.ts --db <path>");
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
log(`Opened database: ${dbPath}`);

const server = new McpServer({
  name: "sqlite-readonly",
  version: "1.0.0",
});

server.tool(
  "list_tables",
  "List all tables in the Virginia legal database with row counts. Tables: virginia_code (sections with title_num, section, title, body), constitution, courts, authorities, popular_names, documents.",
  {},
  async () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    const result = tables.map((t) => {
      const row = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get() as {
        count: number;
      };
      return { name: t.name, row_count: row.count };
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ tables: result }) }],
    };
  },
);

server.tool(
  "describe_table",
  "Show column names and types for a table in the Virginia legal database. Use before writing queries if unsure of column names.",
  {
    table: z.string().describe("Table name to describe"),
  },
  async ({ table }) => {
    const exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(table);
    if (!exists) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: "Table not found" }) },
        ],
      };
    }
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as {
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }[];
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            table,
            columns: columns.map((c) => ({
              name: c.name,
              type: c.type,
              notnull: !!c.notnull,
              pk: !!c.pk,
            })),
          }),
        },
      ],
    };
  },
);

server.tool(
  "query",
  "Run a read-only SQL SELECT against the Virginia legal database. Use for exact lookups, counts, and filtering — e.g. SELECT COUNT(*) FROM virginia_code WHERE title_num='20'; SELECT section, title, body FROM virginia_code WHERE section='20-124.3'. Key columns: virginia_code(title_num, section, title, body), constitution(article, section_name, section_text), courts(name, locality, type). Only SELECT allowed. Max 500 rows.",
  {
    sql: z.string().describe("SQL SELECT query to execute"),
    limit: z
      .number()
      .optional()
      .default(100)
      .describe("Maximum rows to return (default 100, max 500)"),
  },
  async ({ sql, limit }) => {
    const normalized = sql.trim().replace(/^\/\*[\s\S]*?\*\//g, "").trim();
    if (!/^SELECT\b/i.test(normalized)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "Only SELECT queries are allowed" }),
          },
        ],
      };
    }

    const effectiveLimit = Math.min(Math.max(1, limit ?? 100), 500);

    try {
      const rows = db.prepare(sql).all() as Record<string, unknown>[];
      const truncated = rows.length > effectiveLimit;
      const limitedRows = rows.slice(0, effectiveLimit);
      const columns =
        limitedRows.length > 0 ? Object.keys(limitedRows[0]) : [];
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              columns,
              rows: limitedRows,
              row_count: limitedRows.length,
              truncated,
            }),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`query error: ${message}`);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: message }) },
        ],
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
log("MCP sqlite-readonly server connected.");
