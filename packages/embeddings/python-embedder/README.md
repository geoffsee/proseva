# embed-exp

Fast Python embedding path for `Octen/Octen-Embedding-0.6B` (MPS/CUDA).

## Setup

```bash
uv sync
```

## Embed the VA database into `embeddings.sqlite.db`

1) Build graph-only output DB from Rust:

```bash
cd /Users/williamseemueller/workspace/proseva/packages/embeddings
cargo run --release -- \
  --input ../datasets/data/virginia.db \
  --output ../datasets/data/embeddings.sqlite.db \
  --skip-embeddings
```

2) Fill the `embeddings` table from Python:

```bash
cd /Users/williamseemueller/workspace/proseva/packages/embeddings/python-embedder/src
uv run python embed_va_db.py \
  --input-db ../../../datasets/data/virginia.db \
  --output-db ../../../datasets/data/embeddings.sqlite.db \
  --batch-size 64 \
  --max-seq-length 512
```

## Optional benchmark

```bash
uv run python benchmark.py
```

## Optional API server

```bash
uv run python server.py
```
