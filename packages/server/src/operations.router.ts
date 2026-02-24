import { AutoRouter } from "itty-router";
import { db } from "./db";
import { executeSearch, type EntityType } from "./search";
import {
  getSchedulerStatus,
  triggerEvaluation,
} from "./scheduler";
import { getChannelsStatus } from "./notifications";
import {
  generateCaseSummary,
  generateEvidenceAnalysis,
  generateFinancialReport,
  generateChronologyReport,
} from "./reports.js";
import {
  asIttyRoute,
  created as openapiCreated,
  json,
  openapiFormat,
  notFound as openapiNotFound,
} from "./openapi";

const json201 = <T>(data: T) => openapiCreated(data);
const notFound = () => openapiNotFound();

const router = AutoRouter({ base: "/api", format: openapiFormat });

// --- Search ---
router.get(
  "/search",
  asIttyRoute("get", "/search", async (req) => {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") ?? "";

    if (!query.trim()) {
      return json(400, { error: "Query parameter 'q' is required" });
    }

    const typesParam = url.searchParams.get("types");
    const types = typesParam
      ? (typesParam.split(",").filter(Boolean) as EntityType[])
      : undefined;

    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const offsetParam = url.searchParams.get("offset");
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    const caseId = url.searchParams.get("caseId") ?? undefined;

    const params = {
      query: query.trim(),
      types,
      limit,
      offset,
      caseId,
    };

    const result = await executeSearch(params);
    return result;
  }),
);

// --- Reports ---
router.post(
  "/reports",
  asIttyRoute("post", "/reports", async (req) => {
    const config = await req.json();

    // Route to appropriate generator
    switch (config.type) {
      case "case-summary":
        return generateCaseSummary(config);
      case "evidence-analysis":
        return generateEvidenceAnalysis(config);
      case "financial":
        return generateFinancialReport(config);
      case "chronology":
        return generateChronologyReport(config);
      default:
        return json(400, { error: "Invalid report type" });
    }
  }),
);

// --- Evaluations ---
router
  .get(
    "/evaluations",
    asIttyRoute("get", "/evaluations", () => {
      const evaluations = [...db.evaluations.values()].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return evaluations;
    }),
  )
  .get(
    "/evaluations/:evaluationId",
    asIttyRoute("get", "/evaluations/:evaluationId", ({ params }) => {
      const evaluation = db.evaluations.get(params.evaluationId);
      return evaluation ?? notFound();
    }),
  )
  .post(
    "/evaluations/trigger",
    asIttyRoute("post", "/evaluations/trigger", async () => {
      try {
        const result = await triggerEvaluation();
        return json201(result);
      } catch (error) {
        return json(500, {
          error: error instanceof Error ? error.message : "Evaluation failed",
        });
      }
    }),
  );

// --- Scheduler ---
router.get(
  "/scheduler/status",
  asIttyRoute("get", "/scheduler/status", () => {
    const status = getSchedulerStatus();
    const channels = getChannelsStatus();
    return { ...status, channels };
  }),
);

export { router as operationsRouter };
