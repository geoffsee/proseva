#!/usr/bin/env python3
"""
Embedding benchmark: measure throughput and estimate time for large datasets.

Usage:
  uv run python benchmark.py
  uv run python benchmark.py --sizes 1000 5000 20000
  uv run python benchmark.py --batch-size 32 --extrapolate 100000 1000000
"""
import argparse
import time
from typing import List

# Load model and embed once (uses same device/config as main.py)
from main import embed

# Sample texts used to fill each benchmark run (varied length)
_SAMPLE_TEXTS = [
    "Semantic search beats keyword matching every time.",
    "Embeddings capture meaning better than TF-IDF.",
    "Apple Silicon with MPS makes local AI surprisingly fast.",
    "Python package managers have evolved — uv is blazing fast.",
    "This is a completely unrelated sentence about pizza.",
    "Machine learning models can encode text into dense vectors.",
    "Vector databases enable fast similarity search at scale.",
    "Batch processing improves GPU utilization significantly.",
]


def _make_texts(n: int) -> List[str]:
    """Return a list of n texts by repeating from _SAMPLE_TEXTS."""
    out: List[str] = []
    for i in range(n):
        out.append(_SAMPLE_TEXTS[i % len(_SAMPLE_TEXTS)])
    return out


def run_benchmark(
    sizes: List[int],
    batch_size: int = 64,
    warmup_size: int = 50,
) -> List[tuple[int, float, float]]:
    """
    Run embedding on each size; return list of (size, elapsed_sec, texts_per_sec).
    """
    results: List[tuple[int, float, float]] = []

    if warmup_size > 0:
        _ = embed(_make_texts(warmup_size), batch_size=batch_size)
        time.sleep(0.5)

    for n in sizes:
        texts = _make_texts(n)
        t0 = time.perf_counter()
        embed(texts, batch_size=batch_size)
        elapsed = time.perf_counter() - t0
        rate = n / elapsed if elapsed > 0 else 0
        results.append((n, elapsed, rate))

    return results


def format_eta(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f} s"
    if seconds < 3600:
        return f"{seconds / 60:.1f} min"
    return f"{seconds / 3600:.2f} hr"


def main() -> None:
    p = argparse.ArgumentParser(description="Benchmark embedding throughput")
    p.add_argument(
        "--sizes",
        type=int,
        nargs="+",
        default=[100, 500, 1000, 5000, 10000],
        help="Sample sizes to benchmark (default: 100 500 1000 5000 10000)",
    )
    p.add_argument(
        "--batch-size",
        type=int,
        default=64,
        help="Batch size for encode (default: 64)",
    )
    p.add_argument(
        "--warmup",
        type=int,
        default=50,
        help="Warmup batch size (default: 50)",
    )
    p.add_argument(
        "--extrapolate",
        type=int,
        nargs="+",
        default=[100_000, 500_000, 1_000_000],
        help="Dataset sizes to estimate time for (default: 100000 500000 1000000)",
    )
    args = p.parse_args()

    sizes = sorted(args.sizes)
    print(f"Benchmark sizes: {sizes}  (batch_size={args.batch_size}, warmup={args.warmup})\n")

    results = run_benchmark(
        sizes=sizes,
        batch_size=args.batch_size,
        warmup_size=args.warmup,
    )

    print("Results:")
    print("-" * 60)
    print(f"{'N':>10}  {'Time':>12}  {'Texts/sec':>12}")
    print("-" * 60)
    for n, elapsed, rate in results:
        print(f"{n:>10}  {elapsed:>10.2f} s  {rate:>10.1f}")
    print("-" * 60)

    # Use median throughput (middle size) for extrapolation to avoid cold start / small-N noise
    mid = len(results) // 2
    _, _, rate = results[mid]
    if rate <= 0:
        print("No valid throughput; skipping extrapolation.")
        return

    print(f"\nUsing throughput: {rate:.1f} texts/sec (from N={results[mid][0]})")
    print("\nEstimated time for large datasets:")
    for n in args.extrapolate:
        sec = n / rate
        print(f"  {n:>12,} texts  →  {format_eta(sec)}")


if __name__ == "__main__":
    main()
