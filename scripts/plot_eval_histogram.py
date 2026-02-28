#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["matplotlib", "numpy"]
# ///
"""Plot histograms from AI eval score reports."""

import json
import glob
import os
import sys

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "reports", "ai-eval")

BAND_COLORS = {
    "Strong pass": "#2ecc71",
    "Pass with minor issues": "#f1c40f",
    "Conditional pass": "#e67e22",
    "Fail": "#e74c3c",
}

CATEGORY_LABELS = {
    "executionReliability": "Execution\nReliability (/20)",
    "processStageCompleteness": "Process Stage\nCompleteness (/30)",
    "answerRelevanceAndCoverage": "Answer Relevance\n& Coverage (/25)",
    "legalGroundingAndCitationQuality": "Legal Grounding\n& Citations (/20)",
    "safetyAndUncertaintyHandling": "Safety &\nUncertainty (/5)",
}


def load_score_reports(reports_dir):
    pattern = os.path.join(reports_dir, "*-score-*.json")
    files = sorted(glob.glob(pattern))
    # Exclude improvement plans and dry runs
    files = [f for f in files if "improvement-plan" not in f]

    records = []
    for path in files:
        with open(path) as f:
            data = json.load(f)
        if data.get("config", {}).get("dryRun"):
            continue
        for result in data.get("scoredResults", []):
            records.append({
                "file": os.path.basename(path),
                "question_id": result["id"],
                "question": result["question"],
                "finalScore": result["finalScore"],
                "band": result["band"],
                **result.get("categoryScores", {}),
            })
    return records


def main():
    records = load_score_reports(REPORTS_DIR)
    if not records:
        print("No score reports found in", REPORTS_DIR)
        sys.exit(1)

    scores = [r["finalScore"] for r in records]
    bands = [r["band"] for r in records]

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle(f"AI Eval Score Reports (n={len(records)})", fontsize=16, fontweight="bold")

    # --- 1. Final Score Histogram ---
    ax = axes[0, 0]
    colors = [BAND_COLORS.get(r["band"], "#95a5a6") for r in records]
    bins = np.arange(0, 105, 5)
    ax.hist(scores, bins=bins, edgecolor="white", linewidth=0.5, color="#3498db", alpha=0.85)
    ax.set_xlabel("Final Score")
    ax.set_ylabel("Count")
    ax.set_title("Distribution of Final Scores")
    ax.axvline(np.mean(scores), color="#e74c3c", linestyle="--", linewidth=1.5, label=f"Mean: {np.mean(scores):.1f}")
    ax.axvline(np.median(scores), color="#2ecc71", linestyle="--", linewidth=1.5, label=f"Median: {np.median(scores):.1f}")
    ax.legend(fontsize=9)
    ax.set_xlim(0, 100)

    # --- 2. Band Distribution ---
    ax = axes[0, 1]
    band_order = ["Strong pass", "Pass with minor issues", "Conditional pass", "Fail"]
    band_counts = {b: bands.count(b) for b in band_order}
    bar_colors = [BAND_COLORS[b] for b in band_order]
    bars = ax.bar(range(len(band_order)), [band_counts[b] for b in band_order],
                  color=bar_colors, edgecolor="white", linewidth=0.5)
    ax.set_xticks(range(len(band_order)))
    ax.set_xticklabels(band_order, fontsize=9, rotation=15, ha="right")
    ax.set_ylabel("Count")
    ax.set_title("Score Band Distribution")
    ax.yaxis.set_major_locator(mticker.MaxNLocator(integer=True))
    for bar, count in zip(bars, [band_counts[b] for b in band_order]):
        if count > 0:
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.2,
                    str(count), ha="center", va="bottom", fontweight="bold", fontsize=11)

    # --- 3. Category Score Boxplots ---
    ax = axes[1, 0]
    cat_keys = list(CATEGORY_LABELS.keys())
    cat_data = []
    for key in cat_keys:
        vals = [r.get(key, 0) for r in records]
        cat_data.append(vals)
    bp = ax.boxplot(cat_data, patch_artist=True, labels=[CATEGORY_LABELS[k] for k in cat_keys])
    colors_box = ["#3498db", "#9b59b6", "#1abc9c", "#e67e22", "#e74c3c"]
    for patch, color in zip(bp["boxes"], colors_box):
        patch.set_facecolor(color)
        patch.set_alpha(0.6)
    ax.set_ylabel("Score")
    ax.set_title("Category Score Distribution")
    ax.tick_params(axis="x", labelsize=8)

    # --- 4. Score by Question ID ---
    ax = axes[1, 1]
    q_ids = sorted(set(r["question_id"] for r in records))
    q_scores = {qid: [r["finalScore"] for r in records if r["question_id"] == qid] for qid in q_ids}
    positions = range(len(q_ids))
    means = [np.mean(q_scores[qid]) for qid in q_ids]
    ax.bar(positions, means, color="#3498db", alpha=0.7, edgecolor="white")
    for qid in q_ids:
        for s in q_scores[qid]:
            ax.scatter(q_ids.index(qid), s, color="#2c3e50", s=20, zorder=5, alpha=0.6)
    ax.set_xticks(positions)
    ax.set_xticklabels([f"Q{qid}" for qid in q_ids], fontsize=8)
    ax.set_xlabel("Question ID")
    ax.set_ylabel("Final Score")
    ax.set_title("Scores by Question")
    ax.set_ylim(0, 105)

    plt.tight_layout()
    out_path = os.path.join(REPORTS_DIR, "eval-histogram.png")
    plt.savefig(out_path, dpi=150)
    print(f"Saved histogram to {out_path}")
    plt.show()


if __name__ == "__main__":
    main()
