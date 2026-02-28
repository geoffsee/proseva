#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

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
  baseUrl: string;
  questionsPath: string;
  outDir: string;
  questionNumber: number;
  timeoutMs: number;
  delayMs: number;
  ttl: string;
  dryRun: boolean;
  token?: string;
  passphrase?: string;
};

type EvalResult = {
  id: number;
  question: string;
  status: "ok" | "error";
  startedAt: string;
  durationMs: number;
  reply?: string;
  error?: string;
  response?: {
    status: number;
    bodyText: string;
    bodyJson?: unknown;
  };
  process?: {
    wsUrl: string;
    runId?: string;
    stageCount: number;
    stageSequence: string[];
    stageCounts: Record<string, number>;
    missingCoreStages: string[];
    stages: Array<{
      stage: string;
      message: string;
      at: string;
      data?: Record<string, unknown>;
    }>;
    collectorWarning?: string;
  };
  metrics?: {
    responseChars: number;
    responseWords: number;
    citationMatches: string[];
    hasCitation: boolean;
    mentionsCodeOfVirginia: boolean;
    mentionsUncertainty: boolean;
  };
};

type EvalReport = {
  generatedAt: string;
  config: {
    baseUrl: string;
    questionsPath: string;
    outDir: string;
    questionNumber: number;
    timeoutMs: number;
    delayMs: number;
    questionCount: number;
    dryRun: boolean;
  };
  summary: {
    total: number;
    ok: number;
    error: number;
    citationRate: number;
    avgDurationMs: number;
  };
  results: EvalResult[];
};

const DEFAULT_BASE_URL = "http://localhost:3001/api";
const DEFAULT_QUESTIONS_PATH = "docs/ai-eval-questions.md";
const DEFAULT_OUT_DIR = "reports/ai-eval";
const DEFAULT_TIMEOUT_MS = 180_000;
const WS_CONNECT_TIMEOUT_MS = 3_000;
const PROCESS_EVENT_SETTLE_MS = 200;
const CORE_SUCCESS_STAGES = [
  "request-start",
  "final-context-ready",
  "final-generation-start",
  "final-generation-done",
] as const;

const usage = `AI chat evaluation runner

Usage:
  bun run scripts/ai-eval-chat.ts [options]

Options:
  --question-number <n>   1-based question number to run (required)
  --base-url <url>        API base URL (default: ${DEFAULT_BASE_URL})
  --questions <path>      Path to markdown question list (default: ${DEFAULT_QUESTIONS_PATH})
  --out-dir <path>        Output directory for reports (default: ${DEFAULT_OUT_DIR})
  --token <jwt>           Bearer token for /api requests
  --passphrase <text>     Passphrase to exchange for a token via /api/auth/login
  --ttl <duration>        Token TTL for auth/login (default: 24h)
  --timeout-ms <number>   Per-request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})
  --delay-ms <number>     Delay between requests (default: 0)
  --dry-run               Parse questions and write scaffold report without calling API
  --help                  Show this message

Env vars:
  AI_EVAL_BASE_URL
  AI_EVAL_QUESTIONS_PATH
  AI_EVAL_OUT_DIR
  AI_EVAL_TIMEOUT_MS
  AI_EVAL_DELAY_MS
  PROSEVA_AUTH_TOKEN
  PROSEVA_PASSPHRASE
`;

const parseNumberArg = (
  name: string,
  raw: string | undefined,
  fallback: number,
): number => {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid numeric value for ${name}: "${raw}"`);
  }
  return parsed;
};

const parseCliArgs = (argv: string[]): CliOptions => {
  const args = [...argv];
  const next = (name: string): string => {
    const value = args.shift();
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}`);
    }
    return value;
  };

  let baseUrl = process.env.AI_EVAL_BASE_URL ?? DEFAULT_BASE_URL;
  let questionsPath =
    process.env.AI_EVAL_QUESTIONS_PATH ?? DEFAULT_QUESTIONS_PATH;
  let outDir = process.env.AI_EVAL_OUT_DIR ?? DEFAULT_OUT_DIR;
  let questionNumber: number | undefined;
  let token = process.env.PROSEVA_AUTH_TOKEN;
  let passphrase = process.env.PROSEVA_PASSPHRASE;
  let ttl = "24h";
  let timeoutMs = parseNumberArg(
    "AI_EVAL_TIMEOUT_MS",
    process.env.AI_EVAL_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  let delayMs = parseNumberArg(
    "AI_EVAL_DELAY_MS",
    process.env.AI_EVAL_DELAY_MS,
    0,
  );
  let dryRun = false;

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) break;
    switch (arg) {
      case "--base-url":
        baseUrl = next("--base-url");
        break;
      case "--question-number":
      case "--q":
        questionNumber = parseNumberArg(
          "--question-number",
          next("--question-number"),
          NaN,
        );
        break;
      case "--questions":
        questionsPath = next("--questions");
        break;
      case "--out-dir":
        outDir = next("--out-dir");
        break;
      case "--token":
        token = next("--token");
        break;
      case "--passphrase":
        passphrase = next("--passphrase");
        break;
      case "--ttl":
        ttl = next("--ttl");
        break;
      case "--timeout-ms":
        timeoutMs = parseNumberArg("--timeout-ms", next("--timeout-ms"), timeoutMs);
        break;
      case "--delay-ms":
        delayMs = parseNumberArg("--delay-ms", next("--delay-ms"), delayMs);
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

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  if (!questionNumber || !Number.isInteger(questionNumber) || questionNumber <= 0) {
    throw new Error("A positive integer --question-number is required.");
  }
  return {
    baseUrl: normalizedBaseUrl,
    questionsPath,
    outDir,
    questionNumber,
    timeoutMs,
    delayMs,
    ttl,
    dryRun,
    token: token && token.trim().length > 0 ? token.trim() : undefined,
    passphrase:
      passphrase && passphrase.trim().length > 0 ? passphrase : undefined,
  };
};

const parseQuestionsFromMarkdown = (markdown: string): string[] => {
  const lines = markdown.split(/\r?\n/);
  const questions: string[] = [];
  let current: string[] | null = null;

  const flush = () => {
    if (!current || current.length === 0) return;
    const question = current.join(" ").replace(/\s+/g, " ").trim();
    if (question.length > 0) questions.push(question);
    current = null;
  };

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (match) {
      flush();
      current = [match[2].trim()];
      continue;
    }
    if (current) {
      const trimmed = line.trim();
      if (trimmed.length > 0) current.push(trimmed);
    }
  }

  flush();
  return questions;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

type WsEnvelope = {
  event: string;
  data?: unknown;
};

type ChatProcessPayload = {
  source: "chat";
  runId: string;
  stage: string;
  message: string;
  at: string;
  data?: Record<string, unknown>;
};

type ChatProcessCollector = {
  wsUrl: string;
  runId?: string;
  collectorWarning?: string;
  stages: Array<{
    stage: string;
    message: string;
    at: string;
    data?: Record<string, unknown>;
  }>;
  close: () => Promise<void>;
};

const toWsUrl = (baseApiUrl: string): string => {
  const apiUrl = new URL(baseApiUrl);
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${apiUrl.host}/ws`;
};

const parseWsEnvelope = (raw: unknown): WsEnvelope | null => {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const envelope = parsed as Partial<WsEnvelope>;
    if (typeof envelope.event !== "string") return null;
    return {
      event: envelope.event,
      data: envelope.data,
    };
  } catch {
    return null;
  }
};

const parseChatProcessPayload = (raw: unknown): ChatProcessPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Partial<ChatProcessPayload>;
  if (payload.source !== "chat") return null;
  if (typeof payload.runId !== "string" || payload.runId.length === 0) return null;
  if (typeof payload.stage !== "string" || payload.stage.length === 0) return null;
  if (typeof payload.message !== "string") return null;
  if (typeof payload.at !== "string" || payload.at.length === 0) return null;
  return {
    source: "chat",
    runId: payload.runId,
    stage: payload.stage,
    message: payload.message,
    at: payload.at,
    data:
      payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
        ? payload.data
        : undefined,
  };
};

const startChatProcessCollector = async (
  baseUrl: string,
): Promise<ChatProcessCollector> => {
  const wsUrl = toWsUrl(baseUrl);
  const stages: ChatProcessCollector["stages"] = [];
  let runId: string | undefined;
  let collectorWarning: string | undefined;
  let ws: WebSocket | undefined;

  const onMessage = (event: MessageEvent) => {
    const envelope = parseWsEnvelope(event.data);
    if (!envelope || envelope.event !== "chat-process") return;
    const payload = parseChatProcessPayload(envelope.data);
    if (!payload) return;

    if (!runId) {
      if (payload.stage !== "request-start") return;
      runId = payload.runId;
    } else if (payload.runId !== runId) {
      return;
    }

    stages.push({
      stage: payload.stage,
      message: payload.message,
      at: payload.at,
      data: payload.data,
    });
  };

  const connect = async () => {
    ws = new WebSocket(wsUrl);
    ws.addEventListener("message", onMessage);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`WebSocket connect timeout after ${WS_CONNECT_TIMEOUT_MS}ms`));
      }, WS_CONNECT_TIMEOUT_MS);
      ws?.addEventListener(
        "open",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      ws?.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          reject(new Error("WebSocket connection failed"));
        },
        { once: true },
      );
    });
  };

  try {
    await connect();
  } catch (error) {
    collectorWarning = error instanceof Error ? error.message : String(error);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    ws = undefined;
  }

  const close = async () => {
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
      await sleep(10);
    }
    ws = undefined;
  };

  return {
    wsUrl,
    get runId() {
      return runId;
    },
    get collectorWarning() {
      return collectorWarning;
    },
    stages,
    close,
  };
};

const buildStageCounts = (
  stages: Array<{ stage: string }>,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const entry of stages) {
    counts[entry.stage] = (counts[entry.stage] ?? 0) + 1;
  }
  return counts;
};

const computeMissingCoreStages = (stageSequence: string[]): string[] => {
  if (stageSequence.includes("error")) {
    return stageSequence.includes("request-start") ? [] : ["request-start"];
  }
  return CORE_SUCCESS_STAGES.filter((stage) => !stageSequence.includes(stage));
};

const ensureAuthToken = async (opts: CliOptions): Promise<string | undefined> => {
  if (opts.token) return opts.token;
  if (!opts.passphrase) return undefined;

  const loginUrl = `${opts.baseUrl}/auth/login`;
  const response = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase: opts.passphrase, ttl: opts.ttl }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });
  const payloadText = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(payloadText) as unknown;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      `auth/login failed (${response.status}): ${payloadText.slice(0, 300)}`,
    );
  }

  const token =
    payload &&
    typeof payload === "object" &&
    "token" in payload &&
    typeof (payload as { token?: unknown }).token === "string"
      ? (payload as { token: string }).token
      : undefined;
  if (!token) {
    throw new Error("auth/login response did not include token");
  }
  return token;
};

const extractCitationMatches = (reply: string): string[] => {
  const sectionRefRegex = /\b(?:§\s*)?\d{1,3}(?:\.\d+)*(?:-\d+(?:\.\d+)*)\b/g;
  const matches = reply.match(sectionRefRegex) ?? [];
  const unique: string[] = [];
  for (const raw of matches) {
    const normalized = raw.replace(/\s+/g, " ").trim();
    if (!unique.includes(normalized)) unique.push(normalized);
    if (unique.length >= 12) break;
  }
  return unique;
};

const evaluateReplyMetrics = (reply: string) => {
  const citationMatches = extractCitationMatches(reply);
  return {
    responseChars: reply.length,
    responseWords: reply.trim().length > 0 ? reply.trim().split(/\s+/).length : 0,
    citationMatches,
    hasCitation: citationMatches.length > 0,
    mentionsCodeOfVirginia:
      /\bvirginia code\b/i.test(reply) || /\bcode of virginia\b/i.test(reply),
    mentionsUncertainty:
      /\b(?:not legal advice|may|might|uncertain|insufficient)\b/i.test(reply),
  };
};

const runSingleQuestion = async ({
  id,
  question,
  opts,
  token,
}: {
  id: number;
  question: string;
  opts: CliOptions;
  token?: string;
}): Promise<EvalResult> => {
  const startedAt = new Date().toISOString();
  const started = Date.now();

  if (opts.dryRun) {
    return {
      id,
      question,
      status: "ok",
      startedAt,
      durationMs: 0,
      reply: "[dry-run] Request skipped.",
      metrics: evaluateReplyMetrics(""),
    };
  }

  const processCollector = await startChatProcessCollector(opts.baseUrl);

  try {
    const response = await fetch(`${opts.baseUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: question }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });

    const responseText = await response.text();
    let payload: unknown = null;
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      await sleep(PROCESS_EVENT_SETTLE_MS);
      await processCollector.close();
      throw new Error(
        `HTTP ${response.status}: ${responseText.slice(0, 400).replace(/\s+/g, " ")}`,
      );
    }

    const reply =
      payload &&
      typeof payload === "object" &&
      "reply" in payload &&
      typeof (payload as { reply?: unknown }).reply === "string"
        ? (payload as { reply: string }).reply
        : "";
    await sleep(PROCESS_EVENT_SETTLE_MS);
    await processCollector.close();
    const stageSequence = processCollector.stages.map((event) => event.stage);

    return {
      id,
      question,
      status: "ok",
      startedAt,
      durationMs: Date.now() - started,
      reply,
      response: {
        status: response.status,
        bodyText: responseText,
        bodyJson: payload ?? undefined,
      },
      process: {
        wsUrl: processCollector.wsUrl,
        runId: processCollector.runId,
        stageCount: processCollector.stages.length,
        stageSequence,
        stageCounts: buildStageCounts(processCollector.stages),
        missingCoreStages: computeMissingCoreStages(stageSequence),
        stages: processCollector.stages,
        collectorWarning: processCollector.collectorWarning,
      },
      metrics: evaluateReplyMetrics(reply),
    };
  } catch (error) {
    await processCollector.close();
    const stageSequence = processCollector.stages.map((event) => event.stage);
    const message = error instanceof Error ? error.message : String(error);
    return {
      id,
      question,
      status: "error",
      startedAt,
      durationMs: Date.now() - started,
      error: message,
      process: {
        wsUrl: processCollector.wsUrl,
        runId: processCollector.runId,
        stageCount: processCollector.stages.length,
        stageSequence,
        stageCounts: buildStageCounts(processCollector.stages),
        missingCoreStages: computeMissingCoreStages(stageSequence),
        stages: processCollector.stages,
        collectorWarning: processCollector.collectorWarning,
      },
    };
  }
};

const buildReport = (
  opts: CliOptions,
  questionsPath: string,
  questions: string[],
  results: EvalResult[],
): EvalReport => {
  const okResults = results.filter((result) => result.status === "ok");
  const errorResults = results.filter((result) => result.status === "error");
  const citationHits = okResults.filter(
    (result) => result.metrics?.hasCitation,
  ).length;
  const avgDurationMs =
    results.length > 0
      ? results.reduce((sum, result) => sum + result.durationMs, 0) / results.length
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl: opts.baseUrl,
      questionsPath,
      outDir: opts.outDir,
      questionNumber: opts.questionNumber,
      timeoutMs: opts.timeoutMs,
      delayMs: opts.delayMs,
      questionCount: questions.length,
      dryRun: opts.dryRun,
    },
    summary: {
      total: results.length,
      ok: okResults.length,
      error: errorResults.length,
      citationRate:
        okResults.length > 0 ? Number((citationHits / okResults.length).toFixed(4)) : 0,
      avgDurationMs: Number(avgDurationMs.toFixed(1)),
    },
    results,
  };
};

const toMarkdownReport = (report: EvalReport): string => {
  const lines: string[] = [];
  lines.push("# AI Eval Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Base URL: ${report.config.baseUrl}`);
  lines.push(`Question source: ${report.config.questionsPath}`);
  lines.push(`Question number: ${report.config.questionNumber}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total: ${report.summary.total}`);
  lines.push(`- OK: ${report.summary.ok}`);
  lines.push(`- Error: ${report.summary.error}`);
  lines.push(`- Citation rate: ${report.summary.citationRate}`);
  lines.push(`- Average latency: ${report.summary.avgDurationMs} ms`);
  lines.push("");
  lines.push("## Results");
  lines.push("");

  for (const result of report.results) {
    lines.push(`### ${result.id}. ${result.question}`);
    lines.push("");
    lines.push(`- Status: ${result.status}`);
    lines.push(`- Duration: ${result.durationMs} ms`);
    if (result.metrics) {
      lines.push(`- Response words: ${result.metrics.responseWords}`);
      lines.push(`- Has citation: ${result.metrics.hasCitation ? "yes" : "no"}`);
      if (result.metrics.citationMatches.length > 0) {
        lines.push(`- Citations: ${result.metrics.citationMatches.join(", ")}`);
      }
    }
    if (result.error) {
      lines.push(`- Error: ${result.error}`);
    }
    if (result.reply) {
      lines.push("");
      lines.push("```text");
      lines.push(result.reply);
      lines.push("```");
    }
    if (result.process) {
      lines.push("");
      lines.push("#### Process stages");
      lines.push("");
      lines.push(`- WebSocket: ${result.process.wsUrl}`);
      lines.push(`- Run ID: ${result.process.runId ?? "(not captured)"}`);
      lines.push(`- Stage count: ${result.process.stageCount}`);
      lines.push(`- Stage sequence: ${result.process.stageSequence.join(" -> ") || "(none)"}`);
      if (result.process.missingCoreStages.length > 0) {
        lines.push(
          `- Missing core stages: ${result.process.missingCoreStages.join(", ")}`,
        );
      } else {
        lines.push("- Missing core stages: none");
      }
      if (result.process.collectorWarning) {
        lines.push(`- Collector warning: ${result.process.collectorWarning}`);
      }
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(result.process, null, 2));
      lines.push("```");
    }
    lines.push("");
  }

  return lines.join("\n");
};

const run = async () => {
  const opts = parseCliArgs(Bun.argv.slice(2));
  const questionsPath = resolve(opts.questionsPath);
  const outDir = resolve(opts.outDir);

  const raw = await readFile(questionsPath, "utf8");
  const allQuestions = parseQuestionsFromMarkdown(raw);
  if (allQuestions.length === 0) {
    throw new Error(`No numbered questions found in ${questionsPath}`);
  }
  if (opts.questionNumber > allQuestions.length) {
    throw new Error(
      `Question number ${opts.questionNumber} is out of range (1-${allQuestions.length}).`,
    );
  }
  const questions = [allQuestions[opts.questionNumber - 1]];

  console.log(
    `[ai-eval] loaded ${allQuestions.length} questions from ${questionsPath}`,
  );
  console.log(`[ai-eval] selected question #${opts.questionNumber}`);
  console.log(`[ai-eval] target ${opts.baseUrl}`);

  const token = await ensureAuthToken(opts);
  if (!opts.dryRun && !token) {
    console.warn(
      "[ai-eval] no auth token/passphrase provided; requests may fail with 401",
    );
  }

  const results: EvalResult[] = [];
  for (let i = 0; i < questions.length; i++) {
    const id = i + 1;
    const question = questions[i];
    console.log(`[ai-eval] q${id}/${questions.length} starting`);

    const result = await runSingleQuestion({ id, question, opts, token });
    results.push(result);

    if (result.status === "ok") {
      const wordCount = result.metrics?.responseWords ?? 0;
      const citations = result.metrics?.citationMatches.length ?? 0;
      console.log(
        `[ai-eval] q${id} ok duration_ms=${result.durationMs} words=${wordCount} citations=${citations}`,
      );
    } else {
      console.log(`[ai-eval] q${id} error duration_ms=${result.durationMs}`);
      console.error(`[ai-eval] q${id} ${result.error}`);
    }

    if (opts.delayMs > 0 && i < questions.length - 1) {
      await sleep(opts.delayMs);
    }
  }

  const report = buildReport(opts, questionsPath, questions, results);

  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `ai-eval-${stamp}.json`);
  const mdPath = join(outDir, `ai-eval-${stamp}.md`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(mdPath, toMarkdownReport(report), "utf8");

  console.log(`[ai-eval] summary ok=${report.summary.ok} error=${report.summary.error}`);
  console.log(`[ai-eval] wrote ${jsonPath}`);
  console.log(`[ai-eval] wrote ${mdPath}`);
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ai-eval] fatal: ${message}`);
  process.exit(1);
});
