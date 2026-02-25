#!/usr/bin/env python3
"""
Populate embeddings.sqlite.db from virginia.db using Octen SentenceTransformer.

Workflow:
1) Build graph-only DB via Rust (`--skip-embeddings`)
2) Run this script to fill the `embeddings` table
"""

from __future__ import annotations

import argparse
import sqlite3
import time
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

import numpy as np

import main as embed_main

MODEL_NAME = embed_main.MODEL_NAME


@dataclass
class NodeRow:
    node_id: int
    node_type: str


class _HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def get_text(self) -> str:
        return " ".join(self.parts)


def normalize_whitespace(text: str) -> str:
    return " ".join(text.split())


def strip_html(input_text: str) -> str:
    if not input_text:
        return ""

    if "<" not in input_text:
        return normalize_whitespace(input_text)

    parser = _HTMLTextExtractor()
    parser.feed(input_text)
    parser.close()
    text = unescape(parser.get_text())
    return normalize_whitespace(text)


def approx_token_count(text: str) -> int:
    return len(text.split())


def split_sentences(text: str) -> list[str]:
    sentences: list[str] = []
    current: list[str] = []

    for ch in text:
        current.append(ch)
        if ch in ".?!" and len(current) > 1:
            trimmed = "".join(current).strip()
            if trimmed:
                sentences.append(trimmed)
            current = []

    trimmed = "".join(current).strip()
    if trimmed:
        sentences.append(trimmed)

    return sentences


def chunk_text(text: str, max_tokens: int = 500, overlap_tokens: int = 50) -> list[str]:
    if approx_token_count(text) <= max_tokens:
        return [text]

    sentences = split_sentences(text)
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_len = 0

    for sentence in sentences:
        sent_len = approx_token_count(sentence)

        if sent_len > max_tokens:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_len = 0
            chunks.append(sentence)
            continue

        if current_len + sent_len > max_tokens and current_chunk:
            chunks.append(" ".join(current_chunk))

            overlap_chunk: list[str] = []
            overlap_len = 0
            for s in reversed(current_chunk):
                s_len = approx_token_count(s)
                if overlap_len + s_len > overlap_tokens:
                    break
                overlap_chunk.append(s)
                overlap_len += s_len
            overlap_chunk.reverse()

            current_chunk = overlap_chunk
            current_len = overlap_len

        current_chunk.append(sentence)
        current_len += sent_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def iter_non_synthetic_nodes(output_conn: sqlite3.Connection) -> list[NodeRow]:
    rows = output_conn.execute(
        """
        SELECT id, node_type
        FROM nodes
        WHERE node_type NOT IN ('title', 'chapter', 'article')
        ORDER BY id
        """
    ).fetchall()
    return [NodeRow(node_id=row[0], node_type=row[1]) for row in rows]


def build_expected_non_synthetic_records(
    input_conn: sqlite3.Connection,
) -> list[tuple[str, str]]:
    records: list[tuple[str, str]] = []

    # sections
    for section, title, body in input_conn.execute(
        """
        SELECT COALESCE(section,''), COALESCE(title,''), COALESCE(body,'')
        FROM virginia_code
        """
    ):
        if not section:
            continue
        text = normalize_whitespace(f"{strip_html(title)} {strip_html(body)}")
        records.append(("section", text))

    # constitution sections
    for section_name, section_title, section_text in input_conn.execute(
        """
        SELECT COALESCE(section_name,''), COALESCE(section_title,''), COALESCE(section_text,'')
        FROM constitution
        """
    ):
        text = normalize_whitespace(
            f"{strip_html(section_name)} {strip_html(section_title)} {strip_html(section_text)}"
        )
        records.append(("constitution_section", text))

    # authorities
    for short_name, title, body in input_conn.execute(
        """
        SELECT COALESCE(short_name,''), COALESCE(title,''), COALESCE(body,'')
        FROM authorities
        """
    ):
        if not short_name:
            continue
        combined = normalize_whitespace(f"{strip_html(title)} {strip_html(body)}")
        if approx_token_count(combined) > 512:
            chunks = chunk_text(combined, 500, 50)
            for chunk in chunks:
                records.append(("authority", chunk))
        else:
            records.append(("authority", combined))

    # courts
    for name, locality, court_type, district, city in input_conn.execute(
        """
        SELECT COALESCE(name,''), COALESCE(locality,''), COALESCE(type,''),
               COALESCE(district,''), COALESCE(city,'')
        FROM courts
        """
    ):
        text = normalize_whitespace(f"{name} {locality} {court_type} {district} {city}")
        text = strip_html(text)
        records.append(("court", text))

    # popular names
    for name, body in input_conn.execute(
        """
        SELECT COALESCE(name,''), COALESCE(body,'')
        FROM popular_names
        """
    ):
        if not name:
            continue
        text = normalize_whitespace(f"{strip_html(name)} {strip_html(body)}")
        records.append(("popular_name", text))

    # documents
    for filename, title, content in input_conn.execute(
        """
        SELECT COALESCE(filename,''), COALESCE(title,''), COALESCE(content,'')
        FROM documents
        """
    ):
        if not filename:
            continue
        combined = normalize_whitespace(f"{strip_html(title)} {strip_html(content)}")
        for chunk in chunk_text(combined, 500, 50):
            records.append(("manual_chunk", chunk))

    return records


def count_by_type(items: Iterable[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        counts[item] = counts.get(item, 0) + 1
    return counts


def to_blob_f32_le(vec: np.ndarray) -> bytes:
    return vec.astype("<f4", copy=False).tobytes()


def upsert_model_info(conn: sqlite3.Connection, model_name: str, dimensions: int) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO model_info (key, value) VALUES ('model_name', ?)",
        (model_name,),
    )
    conn.execute(
        "INSERT OR REPLACE INTO model_info (key, value) VALUES ('dimensions', ?)",
        (str(dimensions),),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Embed VA database into embeddings.sqlite.db")
    parser.add_argument("--input-db", type=Path, required=True, help="Path to virginia.db")
    parser.add_argument(
        "--output-db",
        type=Path,
        required=True,
        help="Path to embeddings.sqlite.db built with --skip-embeddings",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=64,
        help="Model encode batch size (default: 64)",
    )
    parser.add_argument(
        "--write-batch",
        type=int,
        default=2048,
        help="How many texts to process/write per chunk (default: 2048)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Embed only first N texts (debug only, default: 0 = all)",
    )
    parser.add_argument(
        "--max-seq-length",
        type=int,
        default=512,
        help="Tokenizer max sequence length for embedding (default: 512)",
    )
    parser.add_argument(
        "--keep-existing",
        action="store_true",
        help="Do not clear embeddings table before writing",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    start = time.perf_counter()

    if not args.input_db.exists():
        raise FileNotFoundError(f"Input DB not found: {args.input_db}")
    if not args.output_db.exists():
        raise FileNotFoundError(f"Output DB not found: {args.output_db}")

    input_conn = sqlite3.connect(str(args.input_db))
    output_conn = sqlite3.connect(str(args.output_db))

    try:
        output_conn.execute("PRAGMA journal_mode=WAL")
        output_conn.execute("PRAGMA synchronous=NORMAL")

        nodes = iter_non_synthetic_nodes(output_conn)
        if not nodes:
            raise RuntimeError(
                "No embeddable nodes found in output DB. Run Rust graph build first."
            )

        records = build_expected_non_synthetic_records(input_conn)

        if len(records) != len(nodes):
            node_counts = count_by_type(n.node_type for n in nodes)
            rec_counts = count_by_type(t for t, _ in records)
            raise RuntimeError(
                f"Record count mismatch: expected {len(nodes)} from output nodes, "
                f"generated {len(records)} from input DB.\n"
                f"node counts: {node_counts}\n"
                f"text counts: {rec_counts}"
            )

        if args.limit > 0:
            limit = min(args.limit, len(nodes))
            nodes = nodes[:limit]
            records = records[:limit]

        # Sanity-check type alignment
        for i, (node, (rec_type, _)) in enumerate(zip(nodes, records)):
            if node.node_type != rec_type:
                raise RuntimeError(
                    f"Node/type mismatch at index {i}: node_type={node.node_type}, "
                    f"generated_type={rec_type}, node_id={node.node_id}"
                )

        node_ids = [n.node_id for n in nodes]
        texts = [text for _, text in records]

        print(f"Embedding {len(texts):,} texts into {args.output_db}")
        print(f"Model: {MODEL_NAME}")
        print(f"Encode batch size: {args.batch_size}, write batch: {args.write_batch}")
        print(f"Max sequence length: {args.max_seq_length}")

        embed_main.model.max_seq_length = args.max_seq_length

        if not args.keep_existing:
            output_conn.execute("DELETE FROM embeddings")
            output_conn.commit()

        dims: int | None = None
        written = 0
        n_total = len(texts)

        for start_idx in range(0, n_total, args.write_batch):
            end_idx = min(start_idx + args.write_batch, n_total)
            chunk_texts = texts[start_idx:end_idx]
            chunk_node_ids = node_ids[start_idx:end_idx]

            t0 = time.perf_counter()
            tensor = embed_main.embed(
                chunk_texts,
                normalize=True,
                batch_size=args.batch_size,
            )
            arr = tensor.detach().float().cpu().numpy()
            if arr.ndim != 2:
                raise RuntimeError(f"Unexpected embedding tensor shape: {arr.shape}")

            if dims is None:
                dims = int(arr.shape[1])
                upsert_model_info(output_conn, MODEL_NAME, dims)
                output_conn.commit()

            rows: list[tuple[int, bytes]] = []
            for i in range(arr.shape[0]):
                rows.append((chunk_node_ids[i], to_blob_f32_le(arr[i])))

            output_conn.executemany(
                "INSERT OR REPLACE INTO embeddings (node_id, embedding) VALUES (?, ?)",
                rows,
            )
            output_conn.commit()

            written += len(rows)
            elapsed = time.perf_counter() - t0
            rate = len(rows) / elapsed if elapsed > 0 else 0.0
            print(
                f"  Wrote batch {start_idx // args.write_batch + 1}: "
                f"{written:,}/{n_total:,} ({rate:.1f} texts/sec)"
            )

        count = output_conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
        total_time = time.perf_counter() - start
        print(f"\nDone. embeddings rows: {count:,}, dims: {dims}, total: {total_time:.2f}s")
    finally:
        input_conn.close()
        output_conn.close()


if __name__ == "__main__":
    main()
