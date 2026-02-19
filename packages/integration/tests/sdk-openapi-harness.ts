import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type OpenAPISpec = {
  paths: Record<string, any>;
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type OpenApiOp = {
  method: Method;
  path: string;
  op: any;
  pathItem: any;
};

function readJson<T>(p: string): T {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(p) as T;
}

function isHttpMethod(x: string): x is Lowercase<Method> {
  return ["get", "post", "put", "patch", "delete"].includes(x);
}

function collectOps(spec: OpenAPISpec): OpenApiOp[] {
  const ops: OpenApiOp[] = [];
  for (const [p, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [m, op] of Object.entries(pathItem ?? {})) {
      if (!isHttpMethod(m)) continue;
      ops.push({ method: m.toUpperCase() as Method, path: p, op, pathItem });
    }
  }
  ops.sort((a, b) =>
    (a.path + ":" + a.method).localeCompare(b.path + ":" + b.method),
  );
  return ops;
}

function parseParams(op: any, pathItem: any): {
  path: string[];
  query: string[];
} {
  const params = [...(pathItem?.parameters ?? []), ...(op?.parameters ?? [])];
  const pathParams: string[] = [];
  const queryParams: string[] = [];
  for (const p of params) {
    if (!p || typeof p !== "object") continue;
    if (p.in === "path") pathParams.push(p.name);
    if (p.in === "query") queryParams.push(p.name);
  }
  return { path: [...new Set(pathParams)], query: [...new Set(queryParams)] };
}

function exampleFromSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return {};
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length) {
    return schema.enum[0];
  }
  if (schema.type === "string") {
    if (schema.format === "date") return "2024-01-01";
    if (schema.format === "date-time") return new Date().toISOString();
    return "test";
  }
  if (schema.type === "integer" || schema.type === "number") return 1;
  if (schema.type === "boolean") return true;
  if (schema.type === "array") return [];
  if (schema.type === "object" || schema.properties || schema.additionalProperties) {
    const out: Record<string, any> = {};
    const req: string[] = Array.isArray(schema.required) ? schema.required : [];
    for (const key of req) {
      out[key] = exampleFromSchema(schema.properties?.[key] ?? {});
    }
    return out;
  }
  return {};
}

function getJsonRequestSchema(op: any): any | null {
  const content = op?.requestBody?.content;
  if (!content || typeof content !== "object") return null;
  const json = content["application/json"];
  const schema = json?.schema;
  return schema ?? null;
}

function isPublicPath(p: string): boolean {
  return (
    p === "/health" ||
    p === "/auth/login" ||
    p === "/security/status" ||
    p === "/security/setup-passphrase" ||
    p === "/security/verify-passphrase" ||
    p === "/security/recovery-key"
  );
}

async function serveWithRetries(
  name: string,
  fetchHandler: (req: Request) => Response | Promise<Response>,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const host = "127.0.0.1";
  for (let i = 0; i < 40; i++) {
    const port = 20000 + Math.floor(Math.random() * 40000);
    try {
      const server = Bun.serve({
        hostname: host,
        port,
        fetch: fetchHandler,
      });
      return {
        baseUrl: `http://${host}:${server.port}`,
        close: async () => {
          server.stop();
        },
      };
    } catch (err: any) {
      const msg = String(err);
      const code =
        err && typeof err === "object" && "code" in err ? (err as any).code : "";
      if (code === "EADDRINUSE" || msg.includes("EADDRINUSE")) continue;
      if (
        code === "EACCES" ||
        code === "EPERM" ||
        msg.includes("operation not permitted")
      ) {
        throw new Error(
          `${name}: listening on localhost is not permitted in this environment (${host}:${port}). ` +
            `Run this harness outside the sandbox/CI restrictions.`,
        );
      }
      throw new Error(`${name}: failed to listen: ${msg}`);
    }
  }
  throw new Error(
    `${name}: could not find a free port (or listening is blocked in this environment)`,
  );
}

async function startMockOpenAI(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return serveWithRetries("mock-openai", async (req) => {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const pathname = url.pathname;
    const noV1Path = pathname.startsWith("/v1/") ? pathname.slice(3) : pathname;

    if (method === "GET" && (pathname === "/v1/models" || noV1Path === "/models")) {
      return Response.json({ data: [{ id: "gpt-test" }] });
    }

    if (method === "POST" && (pathname === "/v1/embeddings" || noV1Path === "/embeddings")) {
      return Response.json({ data: [{ embedding: [0.01, 0.02, 0.03] }] });
    }

    if (
      method === "POST" &&
      (pathname === "/v1/chat/completions" || noV1Path === "/chat/completions")
    ) {
      let payload: any = null;
      try {
        payload = await req.json();
      } catch {
        payload = null;
      }

      // Document ingestion uses "messages[0].content" as an array with a "file" item.
      const content0 = payload?.messages?.[0]?.content;
      const isFileExtraction = Array.isArray(content0);
      const content = isFileExtraction
        ? "Sample extracted text\nPAGE_COUNT:1"
        : "OK";

      return Response.json({
        choices: [
          {
            message: { role: "assistant", content },
            finish_reason: "stop",
          },
        ],
      });
    }

    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  });
}

async function startProsevaServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const { router } = await import("../../server/src");
  // Avoid LocalFileAdapter persistence writes (debounced) racing cleanup.
  const [{ resetDb }, { InMemoryAdapter }] = await Promise.all([
    import("../../server/src/db.ts"),
    import("../../server/src/persistence.ts"),
  ]);
  await resetDb(new InMemoryAdapter());
  return serveWithRetries("proseva-server", async (req) => {
    if (process.env.HARNESS_DEBUG === "1") {
      const url = new URL(req.url);
      // eslint-disable-next-line no-console
      console.log(`[proseva] ${req.method} ${url.pathname}`);
      if (url.pathname === "/api/documents/upload") {
        try {
          const fd = await req.clone().formData();
          // eslint-disable-next-line no-console
          console.log(
            `[proseva] upload formData ok: files=${fd.getAll("files").length} category=${String(
              fd.get("category") ?? "",
            )} ct=${req.headers.get("content-type")}`,
          );
          const f = fd.getAll("files")[0] as any;
          // eslint-disable-next-line no-console
          console.log(`[proseva] upload file name=${String(f?.name ?? "")}`);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(
            `[proseva] upload formData parse failed: ${String(e)} ct=${req.headers.get("content-type")}`,
          );
        }
      }
    }
    return router.fetch(req);
  });
}

async function main() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "proseva-openapi-harness-"));
  const scanDir = mkdtempSync(path.join(tmpdir(), "proseva-openapi-scan-"));

  // Seed a PDF for scanDirectory.
  const scanPdfPath = path.join(scanDir, "scan.pdf");
  writeFileSync(scanPdfPath, "%PDF-1.4\n%EOF");

  // Stand up a local OpenAI-compatible stub so server endpoints do not hit the internet.
  const openai = await startMockOpenAI();

  // Configure server env BEFORE importing/starting it.
  process.env.PROSEVA_DATA_DIR = dataDir;
  process.env.EVALUATION_ENABLED = "false";
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_ENDPOINT = openai.baseUrl;

  // Avoid filesystem encryption keypair persistence in harness runs.
  const { setKeypairForceMemory } = await import("../../server/src/encryption.ts");
  setKeypairForceMemory(true);

  const server = await startProsevaServer();

  const { createProsevaClient } = await import("../../sdk/src");

  const api = createProsevaClient({ baseUrl: `${server.baseUrl}/api` });
  const covered = new Set<string>();
  const spec = readJson<OpenAPISpec>(path.resolve("server/openapi.json"));
  const ops = collectOps(spec);
  const allowedStatuses = new Map<string, Set<number>>();
  for (const { method, path: p, op } of ops) {
    const key = `${method} ${p}`;
    const statuses = new Set<number>();
    const responses = op?.responses ?? {};
    for (const k of Object.keys(responses)) {
      const n = Number(k);
      if (Number.isFinite(n)) statuses.add(n);
    }
    allowedStatuses.set(key, statuses);
  }

  const mark = (m: Method, p: string) => covered.add(`${m} ${p}`);

  const mustBeAllowed = (resp: Response, opKey: string) => {
    if (resp.status < 500) return;
    const allowed = allowedStatuses.get(opKey);
    if (allowed && allowed.has(resp.status)) return;
    throw new Error(`${opKey} returned unexpected ${resp.status}`);
  };

  // 1) Bootstrap auth
  {
    const setup = await api.POST("/security/setup-passphrase", {
      body: { passphrase: "integration-passphrase" },
    } as any);
    mark("POST", "/security/setup-passphrase");
    mustBeAllowed(setup.response, "POST /security/setup-passphrase");

    const login = await api.POST("/auth/login", {
      body: { passphrase: "integration-passphrase" },
    } as any);
    mark("POST", "/auth/login");
    mustBeAllowed(login.response, "POST /auth/login");
    const token = (login.data as any)?.token as string | undefined;
    if (!token) throw new Error("auth/login did not return token");

    const authed = createProsevaClient({
      baseUrl: `${server.baseUrl}/api`,
      getAuthToken: () => token,
    });

    // 2) Seed core IDs used in path params
    const ids: Record<string, string> = {};

    const health = await api.GET("/health");
    mark("GET", "/health");
    mustBeAllowed(health.response, "GET /health");

    const secStatus = await api.GET("/security/status");
    mark("GET", "/security/status");
    mustBeAllowed(secStatus.response, "GET /security/status");

    const verifyPass = await api.POST("/security/verify-passphrase", {
      body: { passphrase: "integration-passphrase" },
    } as any);
    mark("POST", "/security/verify-passphrase");
    mustBeAllowed(verifyPass.response, "POST /security/verify-passphrase");

    const config = await authed.GET("/config");
    mark("GET", "/config");
    mustBeAllowed(config.response, "GET /config");

    const createCase = await authed.POST("/cases", {
      body: {
        name: "Harness Case",
        caseNumber: `HAR-${Date.now()}`,
        status: "active",
      },
    } as any);
    mark("POST", "/cases");
    mustBeAllowed(createCase.response, "POST /cases");
    ids.caseId = (createCase.data as any)?.id;
    if (!ids.caseId) throw new Error("POST /cases did not return id");

    const createContact = await authed.POST("/contacts", {
      body: { name: "Harness Contact", role: "attorney", caseId: ids.caseId },
    } as any);
    mark("POST", "/contacts");
    mustBeAllowed(createContact.response, "POST /contacts");
    ids.contactId = (createContact.data as any)?.id;
    if (!ids.contactId) throw new Error("POST /contacts did not return id");

    const createDeadline = await authed.POST("/deadlines", {
      body: {
        title: "Harness Deadline",
        date: "2024-02-01",
        type: "filing",
        completed: false,
        caseId: ids.caseId,
      },
    } as any);
    mark("POST", "/deadlines");
    mustBeAllowed(createDeadline.response, "POST /deadlines");
    ids.deadlineId = (createDeadline.data as any)?.id;
    if (!ids.deadlineId) throw new Error("POST /deadlines did not return id");

    const createFinance = await authed.POST("/finances", {
      body: {
        category: "expense",
        subcategory: "filing-fee",
        amount: 10.5,
        frequency: "one-time",
        date: "2024-02-10",
        description: "Harness fee",
      },
    } as any);
    mark("POST", "/finances");
    mustBeAllowed(createFinance.response, "POST /finances");
    ids.entryId = (createFinance.data as any)?.id;
    if (!ids.entryId) throw new Error("POST /finances did not return id");

    const createEvidence = await authed.POST("/evidences", {
      body: {
        caseId: ids.caseId,
        title: "Harness Evidence",
        exhibitNumber: "EX-1",
        type: "digital",
        dateCollected: "2024-02-05",
        relevance: "high",
      },
    } as any);
    mark("POST", "/evidences");
    mustBeAllowed(createEvidence.response, "POST /evidences");
    ids.evidenceId = (createEvidence.data as any)?.id;
    if (!ids.evidenceId) throw new Error("POST /evidences did not return id");

    const createFiling = await authed.POST("/filings", {
      body: {
        title: "Harness Filing",
        date: "2024-01-15",
        type: "complaint",
        notes: "harness",
        caseId: ids.caseId,
      },
    } as any);
    mark("POST", "/filings");
    mustBeAllowed(createFiling.response, "POST /filings");
    ids.filingId = (createFiling.data as any)?.id;
    if (!ids.filingId) throw new Error("POST /filings did not return id");

    const createNote = await authed.POST("/notes", {
      body: {
        title: "Harness Note",
        content: "note",
        category: "case-notes",
        caseId: ids.caseId,
        tags: ["harness"],
        isPinned: false,
      },
    } as any);
    mark("POST", "/notes");
    mustBeAllowed(createNote.response, "POST /notes");
    ids.noteId = (createNote.data as any)?.id;
    if (!ids.noteId) throw new Error("POST /notes did not return id");

    // Seed case party + case filing for nested delete endpoints.
    const createParty = await authed.POST("/cases/{caseId}/parties", {
      params: { path: { caseId: ids.caseId } },
      body: { name: "Harness Party", role: "Plaintiff", contact: "x@y.com" },
    } as any);
    mark("POST", "/cases/{caseId}/parties");
    mustBeAllowed(createParty.response, "POST /cases/{caseId}/parties");
    ids.partyId = (createParty.data as any)?.id;
    if (!ids.partyId) throw new Error("POST /cases/{caseId}/parties did not return id");

    const createCaseFiling = await authed.POST("/cases/{caseId}/filings", {
      params: { path: { caseId: ids.caseId } },
      body: { title: "Harness Case Filing", date: "2024-01-01", type: "motion" },
    } as any);
    mark("POST", "/cases/{caseId}/filings");
    mustBeAllowed(createCaseFiling.response, "POST /cases/{caseId}/filings");
    ids.caseFilingId = (createCaseFiling.data as any)?.id;
    if (!ids.caseFilingId) throw new Error("POST /cases/{caseId}/filings did not return id");

    // Upload a document (requires OpenAI stub to extract text).
    {
      const pdfBytes = Buffer.from("%PDF-1.4\n%EOF");
      const form = new FormData();
      form.append(
        "files",
        new Blob([pdfBytes], { type: "application/pdf" }),
        "sample.pdf",
      );
      form.append("category", "harness");
      const up = await authed.POST("/documents/upload", { body: form as any } as any);
      mark("POST", "/documents/upload");
      mustBeAllowed(up.response, "POST /documents/upload");
      if (up.response.status !== 201) {
        const text = await up.response.clone().text().catch(() => "");
        throw new Error(
          `POST /documents/upload expected 201, got ${up.response.status}: ${text}`,
        );
      }
      const first = Array.isArray(up.data) ? (up.data as any[])[0] : undefined;
      ids.documentId = first?.id;
      if (!ids.documentId) {
        throw new Error(
          `POST /documents/upload returned 201 but no document id. data=${JSON.stringify(up.data)}`,
        );
      }
    }

    // Ingest scan uses filesystem path.
    const scan = await authed.POST("/ingest/scan", {
      body: { directory: scanDir, watch: false },
    } as any);
    mark("POST", "/ingest/scan");
    mustBeAllowed(scan.response, "POST /ingest/scan");

    // Create estate plan + nested records.
    const plan = await authed.POST("/estate-plans", {
      body: { name: "Harness Estate Plan" },
    } as any);
    mark("POST", "/estate-plans");
    mustBeAllowed(plan.response, "POST /estate-plans");
    ids.planId = (plan.data as any)?.id;
    if (!ids.planId) throw new Error("POST /estate-plans did not return id");

    const ben = await authed.POST("/estate-plans/{planId}/beneficiaries", {
      params: { path: { planId: ids.planId } },
      body: { name: "Ben", relationship: "spouse" },
    } as any);
    mark("POST", "/estate-plans/{planId}/beneficiaries");
    mustBeAllowed(ben.response, "POST /estate-plans/{planId}/beneficiaries");
    ids.beneficiaryId = (ben.data as any)?.id ?? (ben.data as any)?.beneficiary?.id;
    if (!ids.beneficiaryId) ids.beneficiaryId = "missing";

    const asset = await authed.POST("/estate-plans/{planId}/assets", {
      params: { path: { planId: ids.planId } },
      body: { name: "Asset", type: "bank", value: 100 },
    } as any);
    mark("POST", "/estate-plans/{planId}/assets");
    mustBeAllowed(asset.response, "POST /estate-plans/{planId}/assets");
    ids.assetId = (asset.data as any)?.id ?? (asset.data as any)?.asset?.id;
    if (!ids.assetId) ids.assetId = "missing";

    const estateDoc = await authed.POST("/estate-plans/{planId}/documents", {
      params: { path: { planId: ids.planId } },
      body: { title: "Doc", type: "will" },
    } as any);
    mark("POST", "/estate-plans/{planId}/documents");
    mustBeAllowed(estateDoc.response, "POST /estate-plans/{planId}/documents");
    ids.estateDocId = (estateDoc.data as any)?.id ?? (estateDoc.data as any)?.document?.id;
    if (!ids.estateDocId) ids.estateDocId = "missing";

    // Notifications + fax.
    const devTok = await authed.POST("/device-tokens", {
      body: { token: `tok-${Date.now()}`, platform: "web" },
    } as any);
    mark("POST", "/device-tokens");
    mustBeAllowed(devTok.response, "POST /device-tokens");
    ids.tokenId = (devTok.data as any)?.id;
    if (!ids.tokenId) ids.tokenId = "missing";

    const smsRec = await authed.POST("/sms-recipients", {
      body: { phoneNumber: "+15555550123" },
    } as any);
    mark("POST", "/sms-recipients");
    mustBeAllowed(smsRec.response, "POST /sms-recipients");
    ids.recipientId = (smsRec.data as any)?.id;
    if (!ids.recipientId) ids.recipientId = "missing";

    const faxJob = await authed.POST("/fax-jobs", {
      body: { filingId: ids.filingId, recipientFax: "+15555550123" },
    } as any);
    mark("POST", "/fax-jobs");
    mustBeAllowed(faxJob.response, "POST /fax-jobs");
    ids.jobId = (faxJob.data as any)?.id;
    if (!ids.jobId) ids.jobId = "missing";

    // Fax sending is async; wait for it to finish so cleanup doesn't race db.persist().
    if (ids.jobId !== "missing") {
      const start = Date.now();
      while (Date.now() - start < 10_000) {
        const job = await authed.GET("/fax-jobs/{jobId}", {
          params: { path: { jobId: ids.jobId } },
        } as any);
        const status = (job.data as any)?.status as string | undefined;
        if (status && status !== "pending" && status !== "sending") break;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Evaluations
    const trig = await authed.POST("/evaluations/trigger", {} as any);
    mark("POST", "/evaluations/trigger");
    mustBeAllowed(trig.response, "POST /evaluations/trigger");
    ids.evaluationId =
      (trig.data as any)?.evaluation?.id ??
      (trig.data as any)?.id ??
      (trig.data as any)?.evaluationId ??
      "missing";

    // Reports + chat
    const chat = await authed.POST("/chat", {
      body: { messages: [{ role: "user", content: "Hello" }] },
    } as any);
    mark("POST", "/chat");
    mustBeAllowed(chat.response, "POST /chat");

    const rep = await authed.POST("/reports", {
      body: { type: "case-summary", caseId: ids.caseId, options: { includeAI: false } },
    } as any);
    mark("POST", "/reports");
    mustBeAllowed(rep.response, "POST /reports");

    // OpenAI config endpoints
    const models = await authed.GET("/config/openai-models");
    mark("GET", "/config/openai-models");
    mustBeAllowed(models.response, "GET /config/openai-models");

    const testFax = await authed.POST("/config/test-fax", {
      body: { recipientNumber: "+15555550123" },
    } as any);
    mark("POST", "/config/test-fax");
    mustBeAllowed(testFax.response, "POST /config/test-fax");

    const testTwilio = await authed.POST("/config/test-twilio", {
      body: { testPhone: "+15555550123" },
    } as any);
    mark("POST", "/config/test-twilio");
    mustBeAllowed(testTwilio.response, "POST /config/test-twilio");

    const testFirebase = await authed.POST("/config/test-firebase", {} as any);
    mark("POST", "/config/test-firebase");
    mustBeAllowed(testFirebase.response, "POST /config/test-firebase");

    const testOpenai = await authed.POST("/config/test-openai", {} as any);
    mark("POST", "/config/test-openai");
    mustBeAllowed(testOpenai.response, "POST /config/test-openai");

    // 3) Sweep the rest of the OpenAPI operations (best-effort).

    const resolvePathParams = (template: string, names: string[]) => {
      const out: Record<string, string> = {};
      for (const name of names) {
        if (ids[name]) {
          out[name] = ids[name];
          continue;
        }
        if (name === "filingId" && template.includes("/cases/") && template.includes("/filings/")) {
          out[name] = ids.caseFilingId ?? ids.filingId ?? "missing";
          continue;
        }
        if (name === "id") {
          if (template.startsWith("/documents/")) out[name] = ids.documentId ?? "missing";
          else if (template.includes("/estate-plans/") && template.includes("/beneficiaries/"))
            out[name] = ids.beneficiaryId ?? "missing";
          else if (template.includes("/estate-plans/") && template.includes("/assets/"))
            out[name] = ids.assetId ?? "missing";
          else if (template.includes("/estate-plans/") && template.includes("/documents/"))
            out[name] = ids.estateDocId ?? "missing";
          else out[name] = ids.documentId ?? "missing";
          continue;
        }
        // Reasonable defaults for non-critical paths.
        if (name === "group") out[name] = "ai";
        else if (name === "key") out[name] = "openaiApiKey";
        else out[name] = "missing";
      }
      return out;
    };

    const resolveQueryParams = (names: string[]) => {
      const out: Record<string, any> = {};
      for (const name of names) {
        if (name === "q" || name === "query") out[name] = "test";
        else if (name === "limit") out[name] = 5;
        else if (name === "offset") out[name] = 0;
        else if (name === "types") out[name] = "cases";
        else out[name] = "test";
      }
      return out;
    };

    for (const { method, path: p, op, pathItem } of ops) {
      const opKey = `${method} ${p}`;
      if (covered.has(opKey)) continue;

      const { path: pathParams, query: queryParams } = parseParams(op, pathItem);
      const params: any = {};
      if (pathParams.length) params.path = resolvePathParams(p, pathParams);
      if (queryParams.length) params.query = resolveQueryParams(queryParams);

      // Prefer authed client for almost everything.
      const client = isPublicPath(p) ? api : authed;

      let body: any = undefined;
      if (method !== "GET" && method !== "DELETE") {
        // Multipart handled explicitly earlier.
        if (p === "/documents/upload") {
          // already covered
          continue;
        }

        // Some operations need specific minimal bodies.
        if (p === "/ingest/scan") {
          body = { directory: scanDir, watch: false };
        } else if (p === "/chat") {
          body = { messages: [{ role: "user", content: "Hello" }] };
        } else if (p === "/reports") {
          body = { type: "case-summary", caseId: ids.caseId, options: { includeAI: false } };
        } else if (p === "/config/test-twilio") {
          body = { testPhone: "+15555550123" };
        } else if (p === "/config/test-fax") {
          body = { recipientNumber: "+15555550123" };
        } else {
          const schema = getJsonRequestSchema(op);
          body = schema ? exampleFromSchema(schema) : {};
        }
      }

      const callArgs: any = {};
      if (Object.keys(params).length) callArgs.params = params;
      if (body !== undefined) callArgs.body = body;

      const res = await (client as any)[method](p, callArgs);
      mark(method, p);
      mustBeAllowed(res.response, opKey);
    }

    // 4) Verify full coverage against spec
    const all = ops.map((o) => `${o.method} ${o.path}`);
    const missing = all.filter((k) => !covered.has(k));
    if (missing.length) {
      throw new Error(
        `Harness did not cover all OpenAPI ops. Missing ${missing.length}:\n` +
          missing.slice(0, 50).join("\n"),
      );
    }

    // 5) Cleanup some deletes explicitly at the end (best-effort)
    await (authed as any).DELETE("/notes/{noteId}", { params: { path: { noteId: ids.noteId } } });
    await (authed as any).DELETE("/filings/{filingId}", { params: { path: { filingId: ids.filingId } } });
    await (authed as any).DELETE("/evidences/{evidenceId}", { params: { path: { evidenceId: ids.evidenceId } } });
    await (authed as any).DELETE("/finances/{entryId}", { params: { path: { entryId: ids.entryId } } });
    await (authed as any).DELETE("/deadlines/{deadlineId}", { params: { path: { deadlineId: ids.deadlineId } } });
    await (authed as any).DELETE("/contacts/{contactId}", { params: { path: { contactId: ids.contactId } } });
    await (authed as any).DELETE("/cases/{caseId}", { params: { path: { caseId: ids.caseId } } });

    // Exit with a clear single-line success marker for CI logs.
    // eslint-disable-next-line no-console
    console.log(`SDK OpenAPI harness: covered ${covered.size}/${all.length} operations`);
  }

  // Stop servers before deleting temp dirs to avoid races with background tasks.
  await server.close();
  await openai.close();
  rmSync(scanDir, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
