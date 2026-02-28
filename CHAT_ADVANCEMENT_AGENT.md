# Chat Advancement Agent Instructions

You are the chat advancement agent. Your job is to evaluate the ProSeVA chat
pipeline, identify weaknesses through structured scoring, and drive
improvements to answer quality, citation accuracy, and process reliability.

## Environment

Both scripts load environment variables from `.env` at the repo root.
Required variables:

```
PROSEVA_PASSPHRASE=<passphrase for the running ProSeVA server>
OPENAI_API_KEY=<OpenAI key for LLM-judged scoring>
```

Optional overrides (rarely needed):

```
AI_EVAL_BASE_URL=http://localhost:3001/api
AI_EVAL_SCORER_MODEL=gpt-4o-mini
OPENAI_ENDPOINT=<custom OpenAI-compatible base URL>
```

## Step 0 — Start the server

Before any evaluation, ensure the ProSeVA dev server is running:

```bash
bun run dev
```

This starts the server at `http://localhost:3001`. The command runs in the
foreground — leave it running in the background while you proceed.

### Other prerequisites

- `PROSEVA_PASSPHRASE` or `PROSEVA_AUTH_TOKEN` must be set (in `.env` or shell).
- `OPENAI_API_KEY` must be set for scoring (not needed with `--dry-run`).

## Step 1 — Run a chat evaluation

Pick a question number (1-20) from `docs/ai-eval-questions.md` and run:

```bash
bun run eval:ai -- --question-number <N>
```

This sends the question to the chat API, records the response, latency,
process stages, and citation metrics, then writes a timestamped report pair
to `reports/ai-eval/`:

```
reports/ai-eval/ai-eval-<timestamp>.json
reports/ai-eval/ai-eval-<timestamp>.md
```

### Useful flags

| Flag | Purpose |
|---|---|
| `--question-number <n>` | **Required.** 1-based question index. |
| `--base-url <url>` | Override API base URL. |
| `--timeout-ms <ms>` | Per-request timeout (default 180000). |
| `--dry-run` | Parse questions and write a scaffold report without calling the API. |

### What to check in the output

- `status` — must be `"ok"`. An `"error"` means the request failed.
- `durationMs` — under 30s is ideal; over 120s is a red flag.
- `process.missingCoreStages` — should be empty. Missing stages indicate
  the pipeline did not complete all phases.
- `metrics.hasCitation` — whether the reply contains statute-like references.

## Step 2 — Score the evaluation

Run the scorer against the latest chat report:

```bash
bun run eval:ai:score
```

Or target a specific report:

```bash
bun run eval:ai:score -- --report reports/ai-eval/ai-eval-<timestamp>.json
```

This produces a scored report pair:

```
reports/ai-eval/ai-eval-<timestamp>-score-<timestamp>.json
reports/ai-eval/ai-eval-<timestamp>-score-<timestamp>.md
```

### Useful flags

| Flag | Purpose |
|---|---|
| `--report <path>` | Score a specific report instead of the latest. |
| `--model <name>` | OpenAI model for rubric judgment (default `gpt-4o-mini`). |
| `--dry-run` | Skip the LLM call; only compute automated category scores. |

## Step 3 — Interpret scores

Generate the eval histogram and inspect it:

```bash
uv run scripts/plot_eval_histogram.py
```

This reads all score reports in `reports/ai-eval/`, filters out dry runs and
improvement plans, and produces `reports/ai-eval/eval-histogram.png` with four
panels:

1. **Distribution of Final Scores** — histogram with mean/median lines.
2. **Score Band Distribution** — bar chart of Strong pass / Pass with minor
   issues / Conditional pass / Fail counts.
3. **Category Score Distribution** — boxplots for each of the five scoring
   categories, showing where variance and outliers live.
4. **Scores by Question** — per-question bar + scatter so you can spot which
   questions are consistently weak.

Open the generated image and use it to guide your analysis:

- If the histogram is left-skewed or the mean is below 90, there are systemic
  issues — look at the category boxplots to find which category drags scores
  down.
- If a specific question is an outlier in the bottom-right panel, focus your
  investigation on that question's scored report.
- The category with the widest box or lowest median is where improvement effort
  should go first.

### Scoring rubric reference (100 points)

| Category | Max | How scored |
|---|---|---|
| Execution Reliability | 20 | Automated: status + latency thresholds |
| Process Stage Completeness | 30 | Automated: stage sequence, timestamps, retrieval |
| Answer Relevance & Coverage | 25 | LLM-judged (0, 10, 18, or 25) |
| Legal Grounding & Citations | 20 | Hybrid: citation presence (8) + format (6) + LLM relevance (0-6) |
| Safety & Uncertainty | 5 | LLM-judged (0, 3, or 5) |

### Hard gates (applied before the weighted score)

| Condition | Effect |
|---|---|
| `status !== "ok"` | Score capped at 0 |
| `process` data missing | Score capped at 40 |
| Core stages missing | Score capped at 60 |
| Error stage present | Score capped at 50 |

### Bands

| Score | Band |
|---|---|
| 90-100 | Strong pass |
| 75-89 | Pass with minor issues |
| 60-74 | Conditional pass |
| < 60 | Fail |

## Step 4 — Advance the chat pipeline

After interpreting scores, your goal is to improve the system. Use the
remediation owner and defect list to decide where to act:

| Owner | Where to look |
|---|---|
| `retrieval` | Embedding quality, search ranking, chunk boundaries (`packages/embeddings/`) |
| `orchestration` | Stage pipeline, tool calls, context assembly (`packages/server/src/`) |
| `prompt` | System prompt, few-shot examples, instruction tuning (`packages/server/src/`) |
| `frontend formatting` | Response rendering, citation display (`packages/gui/`) |

### Advancement loop

1. Run a sweep (or a targeted question) and score it.
2. Read the scored report. Identify the lowest-scoring category.
3. Investigate the relevant code for the remediation owner.
4. Make a focused change to address the top defect.
5. Re-run the same question(s) and score again.
6. Compare before/after scores to confirm improvement.
7. Repeat until the target band is reached.

### Regression checks

When improving one area, re-evaluate at least 3-5 other questions to confirm
no regression. If a change lifts one score but drops others, reconsider the
approach.

## Running a full sweep

To evaluate all 20 questions, run step 1 and step 2 for each:

```bash
for n in $(seq 1 20); do
  bun run eval:ai -- --question-number "$n"
  bun run eval:ai:score
done
```

## Embedding search evaluation (separate pipeline)

This evaluates the semantic search layer directly, independent of the chat API.

```bash
cd packages/embeddings
bash run_evaluation.sh
```

This builds the Rust embedding server (if needed), starts it, and runs 15
natural-language queries against the embedding corpus. Output is printed to
stdout with per-query hit rates and multi-metric similarity scores.

Prerequisites: Rust toolchain, `packages/datasets/data/embeddings.sqlite.db`,
`packages/datasets/data/virginia.db`.

## File reference

| File | Purpose |
|---|---|
| `scripts/ai-eval-chat.ts` | Chat evaluation runner |
| `scripts/ai-eval-score.ts` | LLM-judged scoring runner |
| `scripts/plot_eval_histogram.py` | Histogram generator for score reports (run with `uv run`) |
| `docs/ai-eval-questions.md` | 20 evaluation questions |
| `docs/ai-eval-scoring-standard.md` | Full scoring rubric specification |
| `reports/ai-eval/` | All generated reports (JSON + Markdown) |
| `reports/ai-eval/eval-histogram.png` | Generated histogram (output of `plot_eval_histogram.py`) |
| `packages/embeddings/eval-search.ts` | Embedding search evaluation |
| `packages/embeddings/run_evaluation.sh` | Embedding eval orchestration script |
