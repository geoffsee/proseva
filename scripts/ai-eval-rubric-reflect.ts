#!/usr/bin/env bun

import OpenAI from "openai";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
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

type ScoreReport = {
  generatedAt: string;
  sourceReportPath: string;
  rubricVersion?: string;
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
  scoredResults: Array<{
    id: number;
    question: string;
    finalScore: number;
    band: string;
    categoryScores: {
      executionReliability: number;
      processStageCompleteness: number;
      answerRelevanceAndCoverage: number;
      legalGroundingAndCitationQuality: number;
      safetyAndUncertaintyHandling: number;
    };
    llmJudgment: {
      topDefects: string[];
      remediationOwner: string;
      rationale: string;
    };
  }>;
};

type CliOptions = {
  reportsDir: string;
  model: string;
  apply: boolean;
  limit: number;
};

const DEFAULT_REPORTS_DIR = "reports/ai-eval";
const DEFAULT_MODEL = process.env.AI_EVAL_SCORER_MODEL ?? "gpt-4.1";
const RUBRIC_DOC_PATH = join(
  import.meta.dirname ?? process.cwd(),
  "..",
  "docs",
  "ai-eval-scoring-standard.md",
);

const usage = `AI eval rubric reflection

Analyzes recent score reports and proposes rubric amendments.

Usage:
  bun run scripts/ai-eval-rubric-reflect.ts [options]

Options:
  --reports-dir <path>  Directory to search for score reports (default: ${DEFAULT_REPORTS_DIR})
  --model <name>        OpenAI model for reflection (default: ${DEFAULT_MODEL})
  --limit <n>           Max number of recent score reports to analyze (default: 10)
  --apply               Append proposed amendment to rubric doc
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

  let reportsDir = DEFAULT_REPORTS_DIR;
  let model = DEFAULT_MODEL;
  let apply = false;
  let limit = 10;

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) break;
    switch (arg) {
      case "--reports-dir":
        reportsDir = next("--reports-dir");
        break;
      case "--model":
        model = next("--model");
        break;
      case "--limit":
        limit = parseInt(next("--limit"), 10);
        break;
      case "--apply":
        apply = true;
        break;
      case "--help":
      case "-h":
        console.log(usage);
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    reportsDir: resolve(reportsDir),
    model: model.trim().length > 0 ? model.trim() : DEFAULT_MODEL,
    apply,
    limit,
  };
};

const isScoreReportFilename = (name: string): boolean =>
  /^ai-eval-.*-score-.*\.json$/i.test(name);

const loadScoreReports = async (
  reportsDir: string,
  limit: number,
): Promise<ScoreReport[]> => {
  const entries = await readdir(reportsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && isScoreReportFilename(entry.name))
    .map((entry) => entry.name)
    .sort()
    .slice(-limit);

  const reports: ScoreReport[] = [];
  for (const file of files) {
    const raw = await readFile(join(reportsDir, file), "utf8");
    try {
      const parsed = JSON.parse(raw) as ScoreReport;
      if (parsed.config?.dryRun) continue;
      reports.push(parsed);
    } catch {
      console.warn(`[reflect] skipping malformed report: ${file}`);
    }
  }
  return reports;
};

type AggregatedStats = {
  reportCount: number;
  totalResults: number;
  meanScore: number;
  stddevScore: number;
  categoryMeans: Record<string, number>;
  categoryStddevs: Record<string, number>;
  bandCounts: Record<string, number>;
  defectFrequency: Record<string, number>;
  remediationOwnerFrequency: Record<string, number>;
  ceilingCount: number;
  floorCount: number;
};

const aggregateStats = (reports: ScoreReport[]): AggregatedStats => {
  const allScores: number[] = [];
  const categoryValues: Record<string, number[]> = {
    executionReliability: [],
    processStageCompleteness: [],
    answerRelevanceAndCoverage: [],
    legalGroundingAndCitationQuality: [],
    safetyAndUncertaintyHandling: [],
  };
  const bandCounts: Record<string, number> = {};
  const defectFrequency: Record<string, number> = {};
  const remediationOwnerFrequency: Record<string, number> = {};
  let ceilingCount = 0;
  let floorCount = 0;

  for (const report of reports) {
    for (const result of report.scoredResults) {
      allScores.push(result.finalScore);
      if (result.finalScore >= 95) ceilingCount++;
      if (result.finalScore < 60) floorCount++;

      bandCounts[result.band] = (bandCounts[result.band] ?? 0) + 1;

      for (const [key, values] of Object.entries(categoryValues)) {
        const score =
          result.categoryScores[key as keyof typeof result.categoryScores];
        if (typeof score === "number") values.push(score);
      }

      for (const defect of result.llmJudgment.topDefects) {
        const normalized = defect.toLowerCase().trim();
        if (normalized && normalized !== "no defects provided.") {
          defectFrequency[normalized] =
            (defectFrequency[normalized] ?? 0) + 1;
        }
      }

      const owner = result.llmJudgment.remediationOwner;
      remediationOwnerFrequency[owner] =
        (remediationOwnerFrequency[owner] ?? 0) + 1;
    }
  }

  const mean = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const stddev = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  };

  const categoryMeans: Record<string, number> = {};
  const categoryStddevs: Record<string, number> = {};
  for (const [key, values] of Object.entries(categoryValues)) {
    categoryMeans[key] = Number(mean(values).toFixed(2));
    categoryStddevs[key] = Number(stddev(values).toFixed(2));
  }

  return {
    reportCount: reports.length,
    totalResults: allScores.length,
    meanScore: Number(mean(allScores).toFixed(2)),
    stddevScore: Number(stddev(allScores).toFixed(2)),
    categoryMeans,
    categoryStddevs,
    bandCounts,
    defectFrequency,
    remediationOwnerFrequency,
    ceilingCount,
    floorCount,
  };
};

const getCurrentAmendmentCount = (): number => {
  try {
    const content = readFileSync(RUBRIC_DOC_PATH, "utf8");
    const startMarker = "<!-- AMENDMENTS_START -->";
    const endMarker = "<!-- AMENDMENTS_END -->";
    const startIdx = content.indexOf(startMarker);
    const endIdx = content.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return 0;
    const section = content.slice(startIdx + startMarker.length, endIdx);
    return (section.match(/^### Amendment /gm) ?? []).length;
  } catch {
    return 0;
  }
};

const buildReflectionPrompt = (stats: AggregatedStats, currentCount: number): string => {
  const nextN = currentCount + 1;
  const today = new Date().toISOString().slice(0, 10);

  return `You are a rubric improvement analyst. Analyze the aggregated evaluation statistics below and propose exactly one rubric amendment (or explicitly state "NO_AMENDMENT" if no change is warranted).

## Monotonic difficulty constraint (CRITICAL)
Amendments must ONLY:
- Tighten existing criteria (require more specificity, accuracy, or detail)
- Add new defect categories for patterns seen in the data
- Add supplementary evaluation dimensions (advisory, not scored)
- Clarify ambiguous judge prompt guidance

Amendments must NEVER:
- Lower score thresholds or weaken requirements
- Remove defect categories
- Make it easier to achieve high scores

## Aggregated Statistics
${JSON.stringify(stats, null, 2)}

## Pattern Detection Guide
- If ceilingCount / totalResults > 0.7: rubric may lack discriminating power → add supplementary dimension or tighten relevance guidance
- If floorCount / totalResults > 0.5: rubric may measure something uncontrollable → do NOT lower standards, but consider adding a supplementary dimension to capture nuance
- If a defect appears 3+ times: consider adding it as a formal defect taxonomy category
- If stddev for a category is < 1: that category may not discriminate → consider adding judge prompt guidance

## Output Format
If an amendment is warranted, output EXACTLY this template (fill in values):

### Amendment ${nextN} (${today}, rubric-v1.${nextN})

**Trigger**: <describe the data pattern>
**Change**: <one-sentence summary>
**Judge prompt addition**: "<exact text>" or null
**New supplementary dimension**: "<field name>" or null
**Defect taxonomy addition**: "<category name>" or null
**Safeguard check**: yes

If no amendment is warranted, output exactly: NO_AMENDMENT`;
};

const applyAmendment = async (amendmentText: string): Promise<void> => {
  const content = readFileSync(RUBRIC_DOC_PATH, "utf8");
  const endMarker = "<!-- AMENDMENTS_END -->";
  const endIdx = content.indexOf(endMarker);
  if (endIdx === -1) {
    throw new Error(
      `Cannot find ${endMarker} in ${RUBRIC_DOC_PATH}. Add the amendments section first.`,
    );
  }

  const before = content.slice(0, endIdx);
  const after = content.slice(endIdx);
  const updated = `${before}${amendmentText.trim()}\n\n${after}`;
  await writeFile(RUBRIC_DOC_PATH, updated, "utf8");
};

const run = async () => {
  const opts = parseCliArgs(Bun.argv.slice(2));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  console.log(`[reflect] loading score reports from ${opts.reportsDir}`);
  const reports = await loadScoreReports(opts.reportsDir, opts.limit);
  if (reports.length === 0) {
    throw new Error(
      `No non-dry-run score reports found in ${opts.reportsDir}`,
    );
  }
  console.log(`[reflect] loaded ${reports.length} score report(s)`);

  const stats = aggregateStats(reports);
  console.log(
    `[reflect] ${stats.totalResults} results, mean=${stats.meanScore}, stddev=${stats.stddevScore}`,
  );
  console.log(
    `[reflect] ceiling(≥95)=${stats.ceilingCount}, floor(<60)=${stats.floorCount}`,
  );

  const currentCount = getCurrentAmendmentCount();
  console.log(`[reflect] current amendment count: ${currentCount}`);

  const client = new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: process.env.OPENAI_ENDPOINT?.trim() || undefined,
  });

  const prompt = buildReflectionPrompt(stats, currentCount);

  const completion = await client.chat.completions.create({
    model: opts.model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are a rubric improvement analyst. Be precise and conservative. Only propose changes backed by clear data patterns.",
      },
      { role: "user", content: prompt },
    ],
  });

  const output = completion.choices[0]?.message?.content?.trim() ?? "";

  if (output === "NO_AMENDMENT" || output.includes("NO_AMENDMENT")) {
    console.log("[reflect] no amendment warranted");
    console.log(output);
    return;
  }

  console.log("[reflect] proposed amendment:");
  console.log("---");
  console.log(output);
  console.log("---");

  if (opts.apply) {
    await applyAmendment(output);
    console.log(`[reflect] amendment applied to ${RUBRIC_DOC_PATH}`);
  } else {
    console.log(
      "[reflect] use --apply to append this amendment to the rubric doc",
    );
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[reflect] fatal: ${message}`);
  process.exit(1);
});
