#!/usr/bin/env bun

import OpenAI from "openai";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const loadDotEnv = () => {
  let dir = import.meta.dirname ?? process.cwd();
  while (dir !== dirname(dir)) {
    const envPath = join(dir, ".env");
    if (existsSync(envPath)) {
      for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (match && !(match[1] in process.env)) {
          process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
        }
      }
      return;
    }
    dir = dirname(dir);
  }
};

loadDotEnv();

type CliOptions = {
  reportPath?: string;
  reportsDir: string;
  outDir: string;
  model: string;
  dryRun: boolean;
};

type EvalReportInput = {
  generatedAt?: string;
  config?: {
    questionNumber?: number;
  } & Record<string, unknown>;
  results: EvalResultInput[];
};

type EvalResultInput = {
  id: number;
  question: string;
  status: "ok" | "error";
  durationMs: number;
  reply?: string;
  error?: string;
  metrics?: {
    hasCitation?: boolean;
    citationMatches?: string[];
  } & Record<string, unknown>;
  process?: {
    missingCoreStages?: string[];
    stageCount?: number;
    stageSequence?: string[];
    stages?: Array<{
      stage?: string;
      at?: string;
      message?: string;
      data?: Record<string, unknown>;
    }>;
  } & Record<string, unknown>;
};

type RubricAmendments = {
  rubricVersion: string;
  judgePromptAdditions: string[];
  supplementaryDimensions: string[];
  defectTaxonomy: string[];
};

type LlmJudgment = {
  relevanceScore: number;
  citationHumanScore: number;
  safetyScore: number;
  topDefects: string[];
  remediationOwner: "retrieval" | "orchestration" | "prompt" | "frontend formatting";
  rationale: string;
  warnings: string[];
  supplementaryJudgments?: Record<string, unknown>;
};

type ResultScore = {
  id: number;
  question: string;
  status: "ok" | "error";
  hardGatesTriggered: string[];
  capApplied: number | null;
  categoryScores: {
    executionReliability: number;
    processStageCompleteness: number;
    answerRelevanceAndCoverage: number;
    legalGroundingAndCitationQuality: number;
    safetyAndUncertaintyHandling: number;
  };
  legalGroundingBreakdown: {
    citationPresence: number;
    citationFormat: number;
    citationRelevance: number;
  };
  rawScore: number;
  finalScore: number;
  band: "Strong pass" | "Pass with minor issues" | "Conditional pass" | "Fail";
  llmJudgment: LlmJudgment;
  supplementaryJudgments?: Record<string, unknown>;
};

type ScoreReport = {
  generatedAt: string;
  sourceReportPath: string;
  rubricVersion: string;
  config: {
    model: string;
    dryRun: boolean;
    resultCount: number;
  };
  summary: {
    averageScore: number;
    minScore: number;
    maxScore: number;
    bandCounts: Record<string, number>;
  };
  scoredResults: ResultScore[];
};

const DEFAULT_REPORTS_DIR = "reports/ai-eval";
const DEFAULT_MODEL = process.env.AI_EVAL_SCORER_MODEL ?? "gpt-4.1";
const RETRIEVAL_STAGES = new Set([
  "tool-call-done",
  "tool-summary-done",
  "tool-summary-tool-done",
]);

const RUBRIC_DOC_PATH = join(
  import.meta.dirname ?? process.cwd(),
  "..",
  "docs",
  "ai-eval-scoring-standard.md",
);

const loadRubricAmendments = (): RubricAmendments => {
  const base: RubricAmendments = {
    rubricVersion: "v1.0",
    judgePromptAdditions: [],
    supplementaryDimensions: [],
    defectTaxonomy: [],
  };

  let content: string;
  try {
    content = readFileSync(RUBRIC_DOC_PATH, "utf8");
  } catch {
    return base;
  }

  const startMarker = "<!-- AMENDMENTS_START -->";
  const endMarker = "<!-- AMENDMENTS_END -->";
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return base;
  }

  const section = content.slice(startIdx + startMarker.length, endIdx).trim();
  if (section.length === 0) {
    return base;
  }

  const amendmentBlocks = section.split(/^### Amendment /m).filter((b) => b.trim().length > 0);
  let amendmentCount = 0;

  for (const block of amendmentBlocks) {
    amendmentCount++;

    const judgeMatch = block.match(/\*\*Judge prompt addition\*\*:\s*"(.+?)"/);
    if (judgeMatch?.[1] && judgeMatch[1] !== "null") {
      base.judgePromptAdditions.push(judgeMatch[1]);
    }

    const dimMatch = block.match(/\*\*New supplementary dimension\*\*:\s*"(.+?)"/);
    if (dimMatch?.[1] && dimMatch[1] !== "null") {
      base.supplementaryDimensions.push(dimMatch[1]);
    }

    const defectMatch = block.match(/\*\*Defect taxonomy addition\*\*:\s*"(.+?)"/);
    if (defectMatch?.[1] && defectMatch[1] !== "null") {
      base.defectTaxonomy.push(defectMatch[1]);
    }
  }

  if (amendmentCount > 0) {
    base.rubricVersion = `v1.${amendmentCount}`;
  }

  return base;
};

const usage = `AI eval scoring runner

Usage:
  bun run scripts/ai-eval-score.ts [options]

Options:
  --report <path>       Path to ai-eval JSON report (default: latest in reports dir)
  --reports-dir <path>  Directory to search for reports (default: ${DEFAULT_REPORTS_DIR})
  --out-dir <path>      Directory for scored outputs (default: reports-dir)
  --model <name>        OpenAI model for rubric judgment (default: ${DEFAULT_MODEL})
  --dry-run             Skip OpenAI call and score only automated categories
  --help                Show this message

Env vars:
  OPENAI_API_KEY
  OPENAI_ENDPOINT
  AI_EVAL_SCORER_MODEL
`;

const parseCliArgs = (argv: string[]): CliOptions => {
  const args = [...argv];
  const next = (name: string): string => {
    const value = args.shift();
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}`);
    }
    return value;
  };

  let reportPath: string | undefined;
  let reportsDir = DEFAULT_REPORTS_DIR;
  let outDir: string | undefined;
  let model = DEFAULT_MODEL;
  let dryRun = false;

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) break;
    switch (arg) {
      case "--report":
        reportPath = next("--report");
        break;
      case "--reports-dir":
        reportsDir = next("--reports-dir");
        break;
      case "--out-dir":
        outDir = next("--out-dir");
        break;
      case "--model":
        model = next("--model");
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--help":
      case "-h":
        console.log(usage);
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const reportsDirAbs = resolve(reportsDir);
  const outDirAbs = resolve(outDir ?? reportsDir);
  return {
    reportPath: reportPath ? resolve(reportPath) : undefined,
    reportsDir: reportsDirAbs,
    outDir: outDirAbs,
    model: model.trim().length > 0 ? model.trim() : DEFAULT_MODEL,
    dryRun,
  };
};

const isEvalReportFilename = (name: string): boolean =>
  /^ai-eval-.*\.json$/i.test(name) && !/score/i.test(name);

const getLatestReportPath = async (reportsDir: string): Promise<string> => {
  const entries = await readdir(reportsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && isEvalReportFilename(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (files.length === 0) {
    throw new Error(`No ai-eval JSON reports found in ${reportsDir}`);
  }
  return resolve(reportsDir, files[files.length - 1]);
};

const parseJson = <T>(raw: string, context: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${context} JSON: ${message}`);
  }
};

const toNonDecreasingTimestamps = (
  stages: EvalResultInput["process"] extends { stages?: infer T } ? T : never,
): boolean => {
  if (!Array.isArray(stages) || stages.length === 0) return false;
  let previous = -Infinity;
  for (const stage of stages) {
    const at = typeof stage?.at === "string" ? stage.at : "";
    const ts = Date.parse(at);
    if (!Number.isFinite(ts)) return false;
    if (ts < previous) return false;
    previous = ts;
  }
  return true;
};

const hasRetrievalStage = (result: EvalResultInput): boolean => {
  const stageSequence = Array.isArray(result.process?.stageSequence)
    ? result.process?.stageSequence
    : [];
  return stageSequence.some((stage) => RETRIEVAL_STAGES.has(stage));
};

const scoreExecutionReliability = (result: EvalResultInput): number => {
  if (result.status !== "ok") return 0;
  if (result.durationMs <= 30_000) return 20;
  if (result.durationMs <= 60_000) return 15;
  if (result.durationMs <= 120_000) return 10;
  return 0;
};

const scoreProcessCompleteness = (result: EvalResultInput): number => {
  const process = result.process;
  if (!process) return 0;
  const missingCoreStages = Array.isArray(process.missingCoreStages)
    ? process.missingCoreStages
    : [];
  const stageCount = typeof process.stageCount === "number" ? process.stageCount : 0;
  const stages = Array.isArray(process.stages) ? process.stages : [];

  let score = 0;
  if (missingCoreStages.length === 0) score += 12;
  if (toNonDecreasingTimestamps(stages)) score += 8;
  if (stageCount >= 6) score += 5;
  if (hasRetrievalStage(result)) score += 5;
  return score;
};

const citationRegex = /\b(?:§\s*)?\d{1,3}(?:\.\d+)*(?:-\d+(?:\.\d+)*)\b/;
const hasStatuteCitationFormat = (result: EvalResultInput): boolean => {
  const matches = Array.isArray(result.metrics?.citationMatches)
    ? result.metrics?.citationMatches
    : [];
  if (matches.some((m) => citationRegex.test(m))) return true;
  return citationRegex.test(result.reply ?? "");
};

const normalizeRelevanceScore = (value: unknown): { score: number; warning?: string } => {
  const allowed = [0, 10, 18, 25];
  if (typeof value === "number" && allowed.includes(value)) {
    return { score: value };
  }
  return {
    score: 0,
    warning: `Invalid relevanceScore from model: ${JSON.stringify(value)} (expected one of ${allowed.join(", ")})`,
  };
};

const normalizeCitationHumanScore = (
  value: unknown,
): { score: number; warning?: string } => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6) {
    return { score: value };
  }
  return {
    score: 0,
    warning: `Invalid citationHumanScore from model: ${JSON.stringify(value)} (expected integer 0-6)`,
  };
};

const normalizeSafetyScore = (value: unknown): { score: number; warning?: string } => {
  const allowed = [0, 3, 5];
  if (typeof value === "number" && allowed.includes(value)) {
    return { score: value };
  }
  return {
    score: 0,
    warning: `Invalid safetyScore from model: ${JSON.stringify(value)} (expected one of ${allowed.join(", ")})`,
  };
};

const parseModelJson = (raw: string): Record<string, unknown> => {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallback to fenced JSON
  }
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = JSON.parse(fenced[1]) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error("Model output is not valid JSON object");
};

const evaluateWithLlm = async (
  client: OpenAI | null,
  model: string,
  result: EvalResultInput,
  amendments: RubricAmendments,
): Promise<LlmJudgment> => {
  if (!client) {
    return {
      relevanceScore: 0,
      citationHumanScore: 0,
      safetyScore: 0,
      topDefects: ["dry-run: skipped LLM scoring"],
      remediationOwner: "prompt",
      rationale: "LLM scoring skipped due to --dry-run.",
      warnings: [],
    };
  }

  const processSnippet = {
    stageCount: result.process?.stageCount ?? 0,
    stageSequence: result.process?.stageSequence ?? [],
    missingCoreStages: result.process?.missingCoreStages ?? [],
  };

  const promptPayload = {
    question: result.question,
    reply: result.reply ?? "",
    status: result.status,
    durationMs: result.durationMs,
    metrics: result.metrics ?? {},
    process: processSnippet,
  };

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are a strict evaluator for legal QA results. Return JSON only. No markdown.",
      },
      {
        role: "user",
        content: `Score this response using the rubric below.

Rubric constraints:
- relevanceScore must be one of: 0, 10, 18, 25
- citationHumanScore must be integer 0-6
- safetyScore must be one of: 0, 3, 5
- topDefects: 1-3 concise strings
- remediationOwner: one of "retrieval", "orchestration", "prompt", "frontend formatting"

Return JSON shape:
{
  "relevanceScore": number,
  "citationHumanScore": number,
  "safetyScore": number,
  "topDefects": string[],
  "remediationOwner": "retrieval" | "orchestration" | "prompt" | "frontend formatting",
  "rationale": string${amendments.supplementaryDimensions.length > 0 ? ',\n  "supplementaryJudgments": {}' : ""}
}${amendments.judgePromptAdditions.length > 0 ? `\n\nAdditional judge guidance:\n${amendments.judgePromptAdditions.map((a) => `- ${a}`).join("\n")}` : ""}${amendments.supplementaryDimensions.length > 0 ? `\n\nAlso evaluate these supplementary dimensions (include in supplementaryJudgments):\n${amendments.supplementaryDimensions.map((d) => `- ${d}`).join("\n")}` : ""}${amendments.defectTaxonomy.length > 0 ? `\n\nRecognized defect categories (use in topDefects when applicable):\n${amendments.defectTaxonomy.map((d) => `- ${d}`).join("\n")}` : ""}

Input:
${JSON.stringify(promptPayload, null, 2)}`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";
  const parsed = parseModelJson(text);
  const warnings: string[] = [];

  const relevance = normalizeRelevanceScore(parsed.relevanceScore);
  if (relevance.warning) warnings.push(relevance.warning);
  const citationHuman = normalizeCitationHumanScore(parsed.citationHumanScore);
  if (citationHuman.warning) warnings.push(citationHuman.warning);
  const safety = normalizeSafetyScore(parsed.safetyScore);
  if (safety.warning) warnings.push(safety.warning);

  const topDefects = Array.isArray(parsed.topDefects)
    ? parsed.topDefects
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .slice(0, 3)
    : [];

  const remediationOwnerRaw = parsed.remediationOwner;
  const remediationOwner =
    remediationOwnerRaw === "retrieval" ||
    remediationOwnerRaw === "orchestration" ||
    remediationOwnerRaw === "prompt" ||
    remediationOwnerRaw === "frontend formatting"
      ? remediationOwnerRaw
      : "prompt";
  if (remediationOwner !== remediationOwnerRaw) {
    warnings.push(
      `Invalid remediationOwner from model: ${JSON.stringify(remediationOwnerRaw)}`,
    );
  }

  const rationale =
    typeof parsed.rationale === "string" && parsed.rationale.trim().length > 0
      ? parsed.rationale.trim()
      : "No rationale provided.";

  const supplementaryJudgments =
    parsed.supplementaryJudgments &&
    typeof parsed.supplementaryJudgments === "object" &&
    !Array.isArray(parsed.supplementaryJudgments)
      ? (parsed.supplementaryJudgments as Record<string, unknown>)
      : undefined;

  return {
    relevanceScore: relevance.score,
    citationHumanScore: citationHuman.score,
    safetyScore: safety.score,
    topDefects: topDefects.length > 0 ? topDefects : ["No defects provided."],
    remediationOwner,
    rationale,
    warnings,
    supplementaryJudgments,
  };
};

const computeHardGateCap = (
  result: EvalResultInput,
): { cap: number | null; hardGatesTriggered: string[] } => {
  const gates: string[] = [];
  if (result.status !== "ok") {
    gates.push("status-not-ok");
    return { cap: 0, hardGatesTriggered: gates };
  }

  let cap: number | null = null;
  if (!result.process) {
    gates.push("process-missing-cap-40");
    cap = 40;
  }
  const missingCore = Array.isArray(result.process?.missingCoreStages)
    ? result.process?.missingCoreStages
    : [];
  if (missingCore.length > 0) {
    gates.push("core-stages-missing-cap-60");
    cap = cap === null ? 60 : Math.min(cap, 60);
  }
  const hasErrorStage = Array.isArray(result.process?.stages)
    ? result.process?.stages.some((stage) => stage?.stage === "error")
    : false;
  if (hasErrorStage) {
    gates.push("error-stage-present-cap-50");
    cap = cap === null ? 50 : Math.min(cap, 50);
  }

  return { cap, hardGatesTriggered: gates };
};

const scoreBand = (
  score: number,
): "Strong pass" | "Pass with minor issues" | "Conditional pass" | "Fail" => {
  if (score >= 90) return "Strong pass";
  if (score >= 75) return "Pass with minor issues";
  if (score >= 60) return "Conditional pass";
  return "Fail";
};

const scoreResult = async (
  client: OpenAI | null,
  model: string,
  result: EvalResultInput,
  amendments: RubricAmendments,
): Promise<ResultScore> => {
  const execution = scoreExecutionReliability(result);
  const process = scoreProcessCompleteness(result);
  const llmJudgment = await evaluateWithLlm(client, model, result, amendments);
  const citationPresence = result.metrics?.hasCitation ? 8 : 0;
  const citationFormat = hasStatuteCitationFormat(result) ? 6 : 0;
  const citationRelevance = llmJudgment.citationHumanScore;
  const legalGrounding = Math.min(20, citationPresence + citationFormat + citationRelevance);

  const rawScore =
    execution +
    process +
    llmJudgment.relevanceScore +
    legalGrounding +
    llmJudgment.safetyScore;

  const { cap, hardGatesTriggered } = computeHardGateCap(result);
  const finalScore = cap === null ? rawScore : Math.min(rawScore, cap);

  return {
    id: result.id,
    question: result.question,
    status: result.status,
    hardGatesTriggered,
    capApplied: cap,
    categoryScores: {
      executionReliability: execution,
      processStageCompleteness: process,
      answerRelevanceAndCoverage: llmJudgment.relevanceScore,
      legalGroundingAndCitationQuality: legalGrounding,
      safetyAndUncertaintyHandling: llmJudgment.safetyScore,
    },
    legalGroundingBreakdown: {
      citationPresence,
      citationFormat,
      citationRelevance,
    },
    rawScore,
    finalScore,
    band: scoreBand(finalScore),
    llmJudgment,
    supplementaryJudgments: llmJudgment.supplementaryJudgments,
  };
};

const toMarkdown = (report: ScoreReport): string => {
  const lines: string[] = [];
  lines.push("# AI Eval Score Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Source report: ${report.sourceReportPath}`);
  lines.push(`Rubric version: ${report.rubricVersion}`);
  lines.push(`Model: ${report.config.model}`);
  lines.push(`Dry-run: ${report.config.dryRun ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Average score: ${report.summary.averageScore}`);
  lines.push(`- Min score: ${report.summary.minScore}`);
  lines.push(`- Max score: ${report.summary.maxScore}`);
  lines.push(`- Bands: ${JSON.stringify(report.summary.bandCounts)}`);
  lines.push("");
  lines.push("## Results");
  lines.push("");

  for (const result of report.scoredResults) {
    lines.push(`### ${result.id}. ${result.question}`);
    lines.push("");
    lines.push(`AI Eval Score: ${result.finalScore}/100`);
    lines.push(`Status: ${result.status}`);
    lines.push(
      `Hard gates triggered: ${result.hardGatesTriggered.length > 0 ? result.hardGatesTriggered.join(", ") : "none"}`,
    );
    lines.push("");
    lines.push("Category scores:");
    lines.push(
      `- Execution Reliability: ${result.categoryScores.executionReliability}/20`,
    );
    lines.push(
      `- Process Stage Completeness: ${result.categoryScores.processStageCompleteness}/30`,
    );
    lines.push(
      `- Answer Relevance and Task Coverage: ${result.categoryScores.answerRelevanceAndCoverage}/25`,
    );
    lines.push(
      `- Legal Grounding and Citation Quality: ${result.categoryScores.legalGroundingAndCitationQuality}/20`,
    );
    lines.push(
      `- Safety and Uncertainty Handling: ${result.categoryScores.safetyAndUncertaintyHandling}/5`,
    );
    lines.push("");
    lines.push("Top defects:");
    result.llmJudgment.topDefects.forEach((defect, idx) => {
      lines.push(`${idx + 1}) ${defect}`);
    });
    lines.push("");
    lines.push("Recommended remediation:");
    lines.push(`- ${result.llmJudgment.remediationOwner}`);
    lines.push("");
    lines.push("Rationale:");
    lines.push(result.llmJudgment.rationale);
    if (result.llmJudgment.warnings.length > 0) {
      lines.push("");
      lines.push("Warnings:");
      for (const warning of result.llmJudgment.warnings) {
        lines.push(`- ${warning}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
};

const run = async () => {
  const opts = parseCliArgs(Bun.argv.slice(2));
  const sourceReportPath = opts.reportPath ?? (await getLatestReportPath(opts.reportsDir));
  const raw = await readFile(sourceReportPath, "utf8");
  const input = parseJson<EvalReportInput>(raw, sourceReportPath);
  if (!Array.isArray(input.results) || input.results.length === 0) {
    throw new Error(`No results found in ${sourceReportPath}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!opts.dryRun && (!apiKey || apiKey.trim().length === 0)) {
    throw new Error("OPENAI_API_KEY is required unless --dry-run is used.");
  }
  const client = opts.dryRun
    ? null
    : new OpenAI({
        apiKey: apiKey?.trim(),
        baseURL: process.env.OPENAI_ENDPOINT?.trim() || undefined,
      });

  const amendments = loadRubricAmendments();
  console.log(`[ai-eval-score] source ${sourceReportPath}`);
  console.log(`[ai-eval-score] rubric ${amendments.rubricVersion}`);
  console.log(`[ai-eval-score] model ${opts.model}`);
  console.log(`[ai-eval-score] scoring ${input.results.length} result(s)`);

  const scoredResults: ResultScore[] = [];
  for (const result of input.results) {
    console.log(`[ai-eval-score] scoring result #${result.id}`);
    const scored = await scoreResult(client, opts.model, result, amendments);
    scoredResults.push(scored);
  }

  const totals = scoredResults.map((result) => result.finalScore);
  const averageScore =
    totals.length > 0
      ? Number((totals.reduce((sum, value) => sum + value, 0) / totals.length).toFixed(2))
      : 0;
  const minScore = totals.length > 0 ? Math.min(...totals) : 0;
  const maxScore = totals.length > 0 ? Math.max(...totals) : 0;
  const bandCounts = scoredResults.reduce<Record<string, number>>((acc, result) => {
    acc[result.band] = (acc[result.band] ?? 0) + 1;
    return acc;
  }, {});

  const scoreReport: ScoreReport = {
    generatedAt: new Date().toISOString(),
    sourceReportPath,
    rubricVersion: amendments.rubricVersion,
    config: {
      model: opts.model,
      dryRun: opts.dryRun,
      resultCount: scoredResults.length,
    },
    summary: {
      averageScore,
      minScore,
      maxScore,
      bandCounts,
    },
    scoredResults,
  };

  await mkdir(opts.outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sourceStem = basename(sourceReportPath).replace(/\.json$/i, "");
  const jsonPath = join(opts.outDir, `${sourceStem}-score-${stamp}.json`);
  const mdPath = join(opts.outDir, `${sourceStem}-score-${stamp}.md`);
  await writeFile(jsonPath, JSON.stringify(scoreReport, null, 2), "utf8");
  await writeFile(mdPath, toMarkdown(scoreReport), "utf8");

  console.log(
    `[ai-eval-score] summary average=${averageScore} min=${minScore} max=${maxScore}`,
  );
  console.log(`[ai-eval-score] wrote ${jsonPath}`);
  console.log(`[ai-eval-score] wrote ${mdPath}`);
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ai-eval-score] fatal: ${message}`);
  process.exit(1);
});
