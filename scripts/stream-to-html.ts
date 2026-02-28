#!/usr/bin/env bun
/**
 * Reads Claude Code stream-json (NDJSON) from stdin and writes
 * a self-contained HTML report to reports/ai-eval/auto-eval-<timestamp>.html.
 *
 * The file is written after every event so you can open it in a browser
 * and watch the run in real time — a small JS snippet auto-reloads the
 * page while the stream is active and preserves your scroll position.
 *
 * Usage:
 *   claude -p --output-format stream-json ... | bun scripts/stream-to-html.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

// ── helpers ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s: string, max = 300): { text: string; truncated: boolean } {
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max), truncated: true };
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function jsonBlock(obj: unknown): string {
  const raw = JSON.stringify(obj, null, 2);
  const { text, truncated } = truncate(raw, 2000);
  let html = `<pre class="json">${escapeHtml(text)}`;
  if (truncated) html += `\n<span class="truncated">... truncated</span>`;
  html += `</pre>`;
  return html;
}

// ── event → HTML renderers ───────────────────────────────────────────

function renderInit(ev: any): string {
  const ts = new Date().toISOString();
  return `
<div class="event init">
  <h1>Claude Code Auto-Eval Report</h1>
  <table class="meta">
    <tr><td>Model</td><td>${escapeHtml(ev.model ?? "unknown")}</td></tr>
    <tr><td>Session</td><td><code>${escapeHtml(ev.session_id ?? "")}</code></td></tr>
    <tr><td>Version</td><td>${escapeHtml(ev.claude_code_version ?? "")}</td></tr>
    <tr><td>Permission</td><td>${escapeHtml(ev.permissionMode ?? "")}</td></tr>
    <tr><td>Generated</td><td>${ts}</td></tr>
    <tr><td>Tools (${(ev.tools ?? []).length})</td><td>${escapeHtml((ev.tools ?? []).join(", "))}</td></tr>
  </table>
</div>`;
}

function renderTaskStarted(ev: any): string {
  return `
<div class="event task-started">
  <span class="badge">subagent</span>
  <strong>${escapeHtml(ev.task_type ?? "task")}</strong>: ${escapeHtml(ev.description ?? "")}
</div>`;
}

function renderThinking(block: any, index: number): string {
  const { text, truncated } = truncate(block.thinking ?? "", 4000);
  return `
<details class="thinking">
  <summary>Thinking (block ${index + 1})</summary>
  <pre>${escapeHtml(text)}${truncated ? "\n... truncated" : ""}</pre>
</details>`;
}

function renderText(block: any): string {
  return `<div class="text-block"><pre>${escapeHtml(block.text ?? "")}</pre></div>`;
}

function renderToolUse(block: any): string {
  const name = block.name ?? "unknown_tool";
  const inputStr = JSON.stringify(block.input ?? {}, null, 2);
  const { text, truncated } = truncate(inputStr, 2000);
  return `
<details class="tool-use" data-tool-id="${escapeHtml(block.id ?? "")}">
  <summary><span class="tool-name">${escapeHtml(name)}</span></summary>
  <pre class="json">${escapeHtml(text)}${truncated ? "\n<span class=\"truncated\">... truncated</span>" : ""}</pre>
</details>`;
}

function renderAssistant(ev: any): string {
  const content: any[] = ev.message?.content ?? [];
  let html = `<div class="event assistant">`;
  let thinkIdx = 0;
  for (const block of content) {
    switch (block.type) {
      case "thinking":
        html += renderThinking(block, thinkIdx++);
        break;
      case "text":
        html += renderText(block);
        break;
      case "tool_use":
        html += renderToolUse(block);
        break;
    }
  }
  html += `</div>`;
  return html;
}

function renderToolResult(ev: any): string {
  const result = ev.tool_use_result;
  const messageContent: any[] = ev.message?.content ?? [];
  let html = `<div class="event tool-result">`;

  if (result && typeof result === "object") {
    // Bash result with stdout/stderr
    if ("stdout" in result || "stderr" in result) {
      if (result.stdout) {
        const { text, truncated } = truncate(result.stdout, 3000);
        html += `<details class="result-detail" open><summary>stdout</summary><pre>${escapeHtml(text)}${truncated ? "\n... truncated" : ""}</pre></details>`;
      }
      if (result.stderr) {
        const { text, truncated } = truncate(result.stderr, 3000);
        html += `<details class="result-detail"><summary>stderr</summary><pre class="stderr">${escapeHtml(text)}${truncated ? "\n... truncated" : ""}</pre></details>`;
      }
    }
    // File read result
    if (result.file) {
      const f = result.file;
      const { text, truncated } = truncate(f.content ?? "", 3000);
      html += `<details class="result-detail"><summary>${escapeHtml(f.filePath ?? "file")} (${f.numLines ?? "?"}/${f.totalLines ?? "?"} lines)</summary><pre>${escapeHtml(text)}${truncated ? "\n... truncated" : ""}</pre></details>`;
    }
    // Edit result with structured patch
    if (result.structuredPatch) {
      html += `<details class="result-detail"><summary>Edit: ${escapeHtml(result.filePath ?? "file")}</summary>`;
      for (const hunk of result.structuredPatch) {
        html += `<pre class="diff">`;
        for (const line of hunk.lines ?? []) {
          const cls = line.startsWith("+")
            ? "add"
            : line.startsWith("-")
              ? "del"
              : "ctx";
          html += `<span class="${cls}">${escapeHtml(line)}</span>\n`;
        }
        html += `</pre>`;
      }
      html += `</details>`;
    }
    // Glob result with filenames
    if (result.filenames && Array.isArray(result.filenames)) {
      html += `<details class="result-detail"><summary>Glob: ${result.numFiles ?? result.filenames.length} files</summary><pre>${escapeHtml(result.filenames.join("\n"))}</pre></details>`;
    }
    // Grep result
    if (result.content && result.mode) {
      const { text, truncated } = truncate(result.content, 3000);
      html += `<details class="result-detail"><summary>Grep (${escapeHtml(result.mode)}, ${result.numLines ?? "?"} lines)</summary><pre>${escapeHtml(text)}${truncated ? "\n... truncated" : ""}</pre></details>`;
    }
    // Subagent result
    if (result.agentId) {
      html += `<details class="result-detail"><summary>Subagent: ${escapeHtml(result.status ?? "done")} (${formatDuration(result.totalDurationMs ?? 0)}, ${result.totalToolUseCount ?? 0} tool calls)</summary>`;
      for (const item of result.content ?? []) {
        if (item.text) {
          const { text, truncated } = truncate(item.text, 3000);
          html += `<pre>${escapeHtml(text)}${truncated ? "\n... truncated" : ""}</pre>`;
        }
      }
      html += `</details>`;
    }
    // Todo result
    if (result.newTodos) {
      html += `<details class="result-detail"><summary>Todos</summary>${jsonBlock(result.newTodos)}</details>`;
    }
  } else if (typeof result === "string") {
    const { text, truncated } = truncate(result, 3000);
    html += `<pre>${escapeHtml(text)}${truncated ? "\n... truncated" : ""}</pre>`;
  }

  // Also render message.content items (tool_result text)
  for (const item of messageContent) {
    if (item.type === "tool_result" && item.content) {
      const textContent =
        typeof item.content === "string"
          ? item.content
          : Array.isArray(item.content)
            ? item.content.map((c: any) => c.text ?? "").join("\n")
            : "";
      if (textContent) {
        const { text, truncated } = truncate(textContent, 3000);
        html += `<details class="result-detail"><summary>Tool result text</summary><pre>${escapeHtml(text)}${truncated ? "\n... truncated" : ""}</pre></details>`;
      }
    }
  }

  html += `</div>`;
  return html;
}

function renderResult(ev: any): string {
  const dur = formatDuration(ev.duration_ms ?? 0);
  const durApi = formatDuration(ev.duration_api_ms ?? 0);
  const cost = (ev.total_cost_usd ?? 0).toFixed(4);
  const usage = ev.usage ?? {};
  const inputTok = formatTokens(usage.input_tokens ?? 0);
  const outputTok = formatTokens(usage.output_tokens ?? 0);
  const cacheRead = formatTokens(usage.cache_read_input_tokens ?? 0);
  const cacheCreate = formatTokens(usage.cache_creation_input_tokens ?? 0);

  let modelRows = "";
  if (ev.modelUsage) {
    for (const [model, data] of Object.entries(ev.modelUsage) as [
      string,
      any,
    ][]) {
      modelRows += `<tr><td>${escapeHtml(model)}</td><td>$${(data.costUSD ?? 0).toFixed(4)}</td><td>${formatTokens(data.inputTokens ?? 0)} in / ${formatTokens(data.outputTokens ?? 0)} out</td></tr>`;
    }
  }

  const resultText = ev.result ?? "";
  const { text: resultPreview, truncated } = truncate(resultText, 5000);

  return `
<div class="event result">
  <h2>Result</h2>
  <table class="meta">
    <tr><td>Error</td><td>${ev.is_error ? '<span class="error-badge">YES</span>' : '<span class="ok-badge">NO</span>'}</td></tr>
    <tr><td>Duration</td><td>${dur} (API: ${durApi})</td></tr>
    <tr><td>Turns</td><td>${ev.num_turns ?? "?"}</td></tr>
    <tr><td>Cost</td><td>$${cost}</td></tr>
    <tr><td>Tokens</td><td>${inputTok} in / ${outputTok} out (cache read: ${cacheRead}, cache create: ${cacheCreate})</td></tr>
  </table>
  ${modelRows ? `<table class="meta model-usage"><tr><th>Model</th><th>Cost</th><th>Tokens</th></tr>${modelRows}</table>` : ""}
  <details class="final-result" open>
    <summary>Final output</summary>
    <pre>${escapeHtml(resultPreview)}${truncated ? "\n... truncated" : ""}</pre>
  </details>
</div>`;
}

// ── CSS ──────────────────────────────────────────────────────────────

const CSS = `
:root {
  --bg: #1e1e2e;
  --surface: #262637;
  --surface2: #2e2e42;
  --border: #3e3e56;
  --text: #cdd6f4;
  --text-dim: #7f849c;
  --accent: #89b4fa;
  --green: #a6e3a1;
  --red: #f38ba8;
  --yellow: #f9e2af;
  --peach: #fab387;
  --mono: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.5;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
h1 { color: var(--accent); font-size: 18px; margin-bottom: 12px; }
h2 { color: var(--accent); font-size: 15px; margin-bottom: 8px; }
.event { margin-bottom: 8px; padding: 10px 14px; border-radius: 6px; border-left: 3px solid var(--border); }
.init { background: var(--surface); border-left-color: var(--accent); }
.task-started { background: var(--surface2); border-left-color: var(--peach); }
.assistant { background: var(--surface); border-left-color: var(--green); }
.tool-result { background: var(--surface2); border-left-color: var(--yellow); margin-left: 20px; }
.result { background: var(--surface); border-left-color: var(--accent); margin-top: 20px; }
.meta { border-collapse: collapse; margin: 6px 0; width: 100%; }
.meta td, .meta th { padding: 3px 10px 3px 0; vertical-align: top; }
.meta td:first-child, .meta th { color: var(--text-dim); white-space: nowrap; }
.model-usage { margin-top: 8px; }
.model-usage th { text-align: left; color: var(--text-dim); }
code { background: var(--surface2); padding: 1px 4px; border-radius: 3px; }
pre { white-space: pre-wrap; word-break: break-word; overflow-x: auto; max-height: 600px; overflow-y: auto; padding: 6px; }
.json { color: var(--text-dim); font-size: 12px; }
.truncated { color: var(--peach); font-style: italic; }
details { margin: 4px 0; }
summary { cursor: pointer; padding: 4px 0; color: var(--text-dim); }
summary:hover { color: var(--text); }
.thinking summary { color: var(--text-dim); }
.thinking pre { color: var(--text-dim); font-size: 12px; }
.tool-name { color: var(--yellow); font-weight: bold; }
.tool-use summary { color: var(--yellow); }
.badge { display: inline-block; background: var(--peach); color: var(--bg); font-size: 11px; font-weight: bold; padding: 1px 6px; border-radius: 3px; margin-right: 6px; }
.error-badge { color: var(--red); font-weight: bold; }
.ok-badge { color: var(--green); font-weight: bold; }
.diff .add { color: var(--green); }
.diff .del { color: var(--red); }
.diff .ctx { color: var(--text-dim); }
.stderr { color: var(--red); }
.result-detail { margin: 4px 0 4px 10px; }
.final-result pre { max-height: 800px; }
.turn-marker { color: var(--text-dim); font-size: 11px; margin: 12px 0 4px 0; border-top: 1px dashed var(--border); padding-top: 4px; }
.streaming-bar {
  position: fixed; top: 10px; right: 10px;
  display: flex; align-items: center; gap: 8px;
  z-index: 100;
}
.streaming-indicator {
  background: var(--green); color: var(--bg);
  font-size: 11px; font-weight: bold;
  padding: 4px 10px; border-radius: 12px;
  animation: pulse 1.5s ease-in-out infinite;
}
.stop-btn {
  background: var(--red); color: var(--bg);
  font-family: var(--mono); font-size: 11px; font-weight: bold;
  padding: 4px 10px; border-radius: 12px;
  border: none; cursor: pointer;
}
.stop-btn:hover { opacity: .8; }
.stop-btn:disabled { opacity: .4; cursor: default; }
.follow-btn {
  position: fixed; bottom: 20px; right: 20px;
  background: var(--accent); color: var(--bg);
  font-family: var(--mono); font-size: 12px; font-weight: bold;
  padding: 8px 16px; border-radius: 16px;
  border: none; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,.4);
  z-index: 100;
  transition: opacity .15s;
}
.follow-btn:hover { opacity: .85; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
`;

// JS snippet injected while the stream is still active.
// Uses Alpine.js for reactive state. Polls /content every 2s
// and swaps the #content div in-place — no page reloads.
function liveReloadJs(stopToken: string): string {
  return `
<div x-data="liveEval" @scroll.window.throttle.100ms="trackScroll" id="live-eval">
  <div class="streaming-bar">
    <span class="streaming-indicator">streaming...</span>
    <button class="stop-btn" :disabled="stopping" @click="stop()" x-text="stopping ? 'stopping...' : 'stop agent'"></button>
  </div>
  <button class="follow-btn" x-show="!atBottom" x-transition @click="follow()">follow &#8595;</button>
</div>
<div id="bottom"></div>
<script>
document.addEventListener('alpine:init', function() {
  Alpine.data('liveEval', function() {
    return {
      stopping: false,
      atBottom: true,

      init: function() {
        var self = this;
        document.getElementById('bottom').scrollIntoView();
        setInterval(function() {
          fetch('/content').then(function(r) { return r.text(); }).then(function(html) {
            var el = document.getElementById('content');
            if (!el || el.innerHTML.length === html.length) return;

            // Save open/closed state by stable content key, not index.
            // Indexes shift as new rows stream in, which collapses user-opened details.
            var openSet = {};
            var keyCount = {};
            el.querySelectorAll('details').forEach(function(d) {
              var summaryEl = d.querySelector('summary');
              var summary = summaryEl ? summaryEl.textContent.trim() : '';
              var pre = d.querySelector('pre');
              var snippet = pre ? pre.textContent.slice(0, 120) : '';
              var baseKey = [d.className || '', summary, snippet].join('|');
              var seen = keyCount[baseKey] || 0;
              keyCount[baseKey] = seen + 1;
              var key = baseKey + '#' + seen;
              if (d.open) openSet[key] = true;
            });

            el.innerHTML = html;

            // Restore open state
            var restoreCount = {};
            el.querySelectorAll('details').forEach(function(d) {
              var summaryEl = d.querySelector('summary');
              var summary = summaryEl ? summaryEl.textContent.trim() : '';
              var pre = d.querySelector('pre');
              var snippet = pre ? pre.textContent.slice(0, 120) : '';
              var baseKey = [d.className || '', summary, snippet].join('|');
              var seen = restoreCount[baseKey] || 0;
              restoreCount[baseKey] = seen + 1;
              var key = baseKey + '#' + seen;
              if (openSet[key]) d.open = true;
            });

            if (self.atBottom) document.getElementById('bottom').scrollIntoView();
          }).catch(function() {});
        }, 2000);
      },

      trackScroll: function() {
        this.atBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 50);
      },

      follow: function() {
        this.atBottom = true;
        document.getElementById('bottom').scrollIntoView({ behavior: 'smooth' });
      },

      stop: function() {
        this.stopping = true;
        fetch('/stop?token=${stopToken}').catch(function() {});
      }
    };
  });
});
</script>`;
}

// ── build full HTML document ─────────────────────────────────────────

function buildHtml(sections: string[], streaming: boolean, stopToken: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Auto-Eval Report${streaming ? " (live)" : ""}</title>
<style>${CSS}</style>
${streaming ? '<script src="https://unpkg.com/alpinejs" defer></script>' : ""}
</head>
<body>
<div id="content">
${sections.join("\n")}
</div>
${streaming ? liveReloadJs(stopToken) : ""}
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  // Determine output path upfront so we can start writing immediately
  const root = process.env.PROJECT_ROOT ?? process.cwd();
  const dir = resolve(root, "reports", "ai-eval");
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(dir, `auto-eval-${ts}.html`);

  // Print path immediately so the user can open it
  console.log(outPath);

  const sections: string[] = [];
  let turnNumber = 0;

  // HTTP server serves the live page and handles stop/content polling.
  // A random token prevents stale browser tabs from killing the wrong process.
  const stopToken = randomBytes(16).toString("hex");
  let stopped = false;
  const server = Bun.serve({
    port: 0, // random available port
    fetch(req) {
      const url = new URL(req.url);
      const headers = { "Content-Type": "text/html; charset=utf-8" };

      if (url.pathname === "/") {
        return new Response(buildHtml(sections, true, stopToken), { headers });
      }

      if (url.pathname === "/content") {
        return new Response(sections.join("\n"), { headers });
      }

      if (url.pathname === "/stop" && url.searchParams.get("token") === stopToken) {
        stopped = true;
        writeFileSync(outPath, buildHtml(sections, false, stopToken));
        server.stop();
        // Exiting breaks the pipe → claude gets SIGPIPE
        setTimeout(() => process.exit(0), 100);
        return new Response("stopped", { headers });
      }

      return new Response("not found", { status: 404 });
    },
  });

  function flush() {
    // Also write static file so the report persists after the server stops
    writeFileSync(outPath, buildHtml(sections, false, stopToken));
  }

  // Open live page in browser
  spawn("open", [`http://localhost:${server.port}`], { stdio: "ignore", detached: true }).unref();
  console.log(`Live: http://localhost:${server.port}`);

  function processEvent(ev: any) {
    switch (ev.type) {
      case "system":
        if (ev.subtype === "init") {
          sections.push(renderInit(ev));
        } else if (ev.subtype === "task_started") {
          sections.push(renderTaskStarted(ev));
        }
        break;

      case "assistant":
        turnNumber++;
        sections.push(
          `<div class="turn-marker">Turn ${turnNumber}</div>`,
        );
        sections.push(renderAssistant(ev));
        break;

      case "user":
        sections.push(renderToolResult(ev));
        break;

      case "result":
        sections.push(renderResult(ev));
        break;
    }
  }

  // Read stdin incrementally, flushing the HTML after every chunk
  // so a browser viewing the file sees updates in near-real-time.
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of Bun.stdin.stream()) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    let changed = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let ev: any;
      try {
        ev = JSON.parse(trimmed);
      } catch {
        continue;
      }
      processEvent(ev);
      changed = true;
    }

    if (changed) flush();
  }

  // Handle any remaining data in the buffer
  if (buffer.trim()) {
    try {
      const ev = JSON.parse(buffer.trim());
      processEvent(ev);
    } catch {
      // ignore
    }
  }

  // Final static write and shut down server
  flush();
  server.stop();
}

main().catch((err) => {
  console.error("stream-to-html error:", err);
  process.exit(1);
});
