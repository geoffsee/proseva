#!/usr/bin/env sh

bun --filter=@proseva/server \
  --filter=@proseva/gui \
  --filter=@proseva/gui \
  --filter=@proseva/scanner-server \
  --filter=@proseva/embeddings \
  --filter=@proseva/embeddings-explorer \
    run --parallel dev