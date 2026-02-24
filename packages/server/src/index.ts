import { AutoRouter, cors } from "itty-router";
import OpenAI from "openai";
import { db, initDb } from "./db";
import {
  getBlobStore,
  migrateResearchAttachmentsToBlobStore,
} from "./blob-store";
import { ingestPdfToBlob, classifyDocument } from "./ingest";
import { autoPopulateFromDocument } from "./ingestion-agent";
import { initScheduler } from "./scheduler";
import { initScanner, stopScanner } from "./scanner";
import { initEmailPoller, stopEmailPoller } from "./email-service";
import { configRouter } from "./config-api";
import { securityRouter } from "./security-api";
import { authRouter, verifyToken } from "./auth-api";
import { getConfig } from "./config";
import { researchRouter } from "./research";
import { handleResearchChat } from "./research-agent";
import { yoga } from "./graphql";
import { ensureWasmSimilarityInit } from "./wasm-similarity-init";
import { asIttyRoute, json, openapiFormat } from "./openapi";
import { broadcast, wsClients } from "./broadcast";
import { maybeAutoIngestFromEnv } from "./ingestion-status";

// Domain routers
import { casesRouter } from "./cases.router";
import { caseDataRouter } from "./case-data.router";
import { correspondenceRouter } from "./correspondence.router";
import { chatRouter } from "./chat.router";
import { documentsRouter } from "./documents.router";
import { estatePlansRouter } from "./estate-plans.router";
import { communicationsRouter } from "./communications.router";
import { notificationsRouter } from "./notifications.router";
import { operationsRouter } from "./operations.router";

import type { ServerWebSocket } from "bun";

const { preflight, corsify } = cors();

const ALLOWED_WHEN_DB_LOCKED = new Set([
  "/api/health",
  "/api/security/status",
  "/api/security/recovery-key",
  "/api/security/setup-passphrase",
  "/api/security/verify-passphrase",
  "/api/auth/login",
]);

const UNAUTHENTICATED_ROUTES = new Set([
  "/api/health",
  "/api/security/status",
  "/api/security/verify-passphrase",
  "/api/auth/login",
]);

const requireUnlockedDatabase = (request: Request) => {
  if (request.method === "OPTIONS") return;
  if (!db.isLocked()) return;

  const pathname = new URL(request.url).pathname;
  if (ALLOWED_WHEN_DB_LOCKED.has(pathname)) return;

  return new Response(
    JSON.stringify({
      error: "Database is locked. Provide a valid recovery key to continue.",
      code: "DB_LOCKED",
      lockReason: db.securityStatus().lockReason,
    }),
    {
      status: 423,
      headers: { "content-type": "application/json" },
    },
  );
};

const requireAuthentication = async (request: Request) => {
  if (request.method === "OPTIONS") return;

  const pathname = new URL(request.url).pathname;

  // Skip authentication for always-public routes
  if (UNAUTHENTICATED_ROUTES.has(pathname)) return;

  // setup-passphrase is only unauthenticated during first-run (no passphrase yet)
  if (
    pathname === "/api/security/setup-passphrase" &&
    !db.serverConfig.has("passphrase_hash")
  )
    return;

  // recovery-key is only unauthenticated when the DB is locked (can't login)
  if (pathname === "/api/security/recovery-key" && db.isLocked()) return;

  // Get Authorization header
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return new Response(
      JSON.stringify({
        error: "Authentication required. Please provide a valid Bearer token.",
        code: "AUTH_REQUIRED",
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Verify Bearer token format
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return new Response(
      JSON.stringify({
        error: "Invalid Authorization header format. Use 'Bearer <token>'.",
        code: "INVALID_AUTH_HEADER",
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const token = match[1];

  // Verify token
  const valid = await verifyToken(token);
  if (!valid) {
    return new Response(
      JSON.stringify({
        error: "Invalid or expired token.",
        code: "INVALID_TOKEN",
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Token is valid, continue
  return;
};

const persistAfterMutation = (response: Response, request: Request) => {
  if (request.method !== "GET") db.persist();
  return response;
};

export const router = AutoRouter({
  format: openapiFormat,
  before: [preflight, requireAuthentication, requireUnlockedDatabase],
  finally: [persistAfterMutation, corsify],
  base: "/api",
});

router.get(
  "/health",
  asIttyRoute("get", "/health", () => ({ status: "ok" })),
);

// Mount GraphQL (graphql-yoga) endpoint.
// Wrap yoga's response in a native Response so itty-router's format chain
// recognises it (yoga ships its own Response class via @whatwg-node/fetch).
router.all("/graphql", async (req: Request) => {
  const yogaRes = await yoga.fetch(req);
  return new Response(yogaRes.body, {
    status: yogaRes.status,
    statusText: yogaRes.statusText,
    headers: Object.fromEntries(yogaRes.headers.entries()),
  });
});

// Initialize WASM modules and database before handling any requests.
ensureWasmSimilarityInit();
await initDb();

// Initialize the blob store and migrate any legacy research attachments.
getBlobStore();
void migrateResearchAttachmentsToBlobStore()
  .then(({ migrated }) => {
    if (migrated > 0) {
      console.log(
        `[blob-store] Migrated ${migrated} research attachments to blob store`,
      );
    }
  })
  .catch((err) => console.error("[blob-store] Migration failed:", err));

// Kick off optional bulk ingestion when AUTO_INGEST_DIR is set.
void maybeAutoIngestFromEnv().catch((err) =>
  console.error("[auto-ingest] Failed to start", err),
);

process.on("beforeExit", () => void db.flush());
process.on("SIGINT", () => {
  stopScanner();
  stopEmailPoller();
  void db.flush().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  stopScanner();
  stopEmailPoller();
  void db.flush().then(() => process.exit(0));
});

// Mount domain routers
router.all("/search", operationsRouter.fetch);
router.all("/cases/*", casesRouter.fetch);
router.all("/contacts/*", caseDataRouter.fetch);
router.all("/deadlines/*", caseDataRouter.fetch);
router.all("/finances/*", caseDataRouter.fetch);
router.all("/evidences/*", caseDataRouter.fetch);
router.all("/filings/*", caseDataRouter.fetch);
router.all("/notes/*", caseDataRouter.fetch);
router.all("/correspondence/*", correspondenceRouter.fetch);
router.all("/correspondences/*", correspondenceRouter.fetch);
router.all("/chat", chatRouter.fetch);
router.all("/documents/*", documentsRouter.fetch);
router.all("/ingest/*", documentsRouter.fetch);
router.all("/estate-plans/*", estatePlansRouter.fetch);
router.all("/email/*", communicationsRouter.fetch);
router.all("/fax-jobs/*", communicationsRouter.fetch);
router.all("/fax/*", communicationsRouter.fetch);
router.all("/device-tokens/*", notificationsRouter.fetch);
router.all("/sms-recipients/*", notificationsRouter.fetch);
router.all("/evaluations/*", operationsRouter.fetch);
router.all("/reports", operationsRouter.fetch);
router.all("/scheduler/*", operationsRouter.fetch);

// Mount config, security, auth routers
router.all("/config/*", configRouter.fetch);
router.all("/security/*", securityRouter.fetch);
router.all("/auth/*", authRouter.fetch);

// Research agent chat endpoint
router.post(
  "/research/agent/chat",
  asIttyRoute("post", "/research/agent/chat", async (request: Request) => {
    try {
      const body = (await request.json()) as {
        messages?: Array<{ role: string; content: string }>;
      };
      if (!body.messages || !Array.isArray(body.messages)) {
        return json(400, { error: "messages array is required" });
      }

      const result = await handleResearchChat(
        body.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        (data) => broadcast("activity-status", data),
      );

      return result;
    } catch (err) {
      console.error("[ResearchAgent] Error:", (err as Error)?.message);
      return json(500, { error: (err as Error)?.message ?? "Unknown error" });
    }
  }),
);

// Mount research router
router.all("/research/*", researchRouter.fetch);

// Initialize the scheduler on server startup
initScheduler();

// Initialize the email poller on server startup
initEmailPoller();

// Initialize the document scanner service on server startup.
// Scanned documents are ingested directly into SQLite — no intermediate files.
initScanner({
  onComplete: (buffer, filename) => {
    void (async () => {
      try {
        const openai = new OpenAI({
          apiKey: getConfig("OPENAI_API_KEY"),
          baseURL: getConfig("OPENAI_ENDPOINT"),
        });
        const { record } = await ingestPdfToBlob(
          buffer,
          filename,
          "scanned",
          openai,
        );
        const classified = await classifyDocument(record.extractedText, openai);
        record.category = classified;
        db.documents.set(record.id, record);
        console.log(`[scanner] Auto-classified ${filename} as "${classified}"`);
        try {
          const { caseId } = await autoPopulateFromDocument({
            openai,
            entry: record,
            text: record.extractedText,
          });
          if (caseId) {
            record.caseId = caseId;
            db.documents.set(record.id, record);
          }
        } catch (err) {
          console.error("[scanner] auto-populate failed:", err);
        }
        db.persist();
        broadcast("documents-changed");
        console.log(`[scanner] Ingested ${filename} -> ${record.id}`);
      } catch (err) {
        console.error("[scanner] post-scan ingestion failed:", err);
      }
    })();
  },
});

const port = parseInt(process.env.PORT || "3001", 10);

if (import.meta.main) {
  console.log(`ProSeVA server running on http://localhost:${port}`);
}

// Re-export broadcast for backward compatibility (used by other modules)
export { broadcast };

export default {
  port,
  fetch(req: Request, server: import("bun").Server<unknown>) {
    if (new URL(req.url).pathname === "/ws") {
      if (server.upgrade(req, { data: undefined })) return undefined;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }
    return router.fetch(req);
  },
  websocket: {
    open(ws: ServerWebSocket) {
      wsClients.add(ws);
      console.log(`[ws] Client connected (${wsClients.size} total)`);
    },
    close(ws: ServerWebSocket) {
      wsClients.delete(ws);
      console.log(`[ws] Client disconnected (${wsClients.size} total)`);
    },
    message() {},
  },
};
