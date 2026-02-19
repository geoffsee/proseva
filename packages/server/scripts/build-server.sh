#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"

EXTERNAL_FLAGS=(
  "--external" "@duckdb/node-bindings"
  "--external" "@duckdb/node-bindings-linux-x64"
  "--external" "@duckdb/node-bindings-linux-arm64"
  "--external" "@duckdb/node-bindings-darwin-x64"
  "--external" "@duckdb/node-bindings-darwin-arm64"
  "--external" "@duckdb/node-bindings-win32-x64"
)

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os:$arch" in
    Darwin:arm64) echo "macos-latest:arm64" ;;
    Darwin:x86_64) echo "macos-latest:x64" ;;
    Linux:x86_64) echo "ubuntu-latest:x64" ;;
    *) echo "Unsupported host platform: $os/$arch" >&2; exit 1 ;;
  esac
}

validate_platform() {
  local platform="$1"
  case "$platform" in
    macos-latest:arm64) ;;
    macos-latest:x64) ;;
    windows-latest:arm64) ;;
    windows-latest:x64) ;;
    ubuntu-latest:x64) ;;
    *) echo "Unsupported platform: $platform" >&2; exit 1 ;;
  esac
}

install_server_deps() {
  cd "$SERVER_DIR"
  bun install --frozen-lockfile
}

run_bundler() {
  local _platform="$1"
  cd "$SERVER_DIR"
  bun build \
    --target node \
    src/index.ts src/index.server.ts \
    "${EXTERNAL_FLAGS[@]}" \
    --outdir=../dist-server
}

copy_runtime_assets() {
  cd "$SERVER_DIR"
  cp node_modules/wasm-similarity/wasm_similarity_bg.wasm ../dist-server/
  cp node_modules/wasm-pqc-subtle/wasm_pqc_subtle_bg.wasm ../dist-server/

  mkdir -p ../dist-server/node_modules
  rm -rf ../dist-server/node_modules/@duckdb
  cp -R node_modules/@duckdb ../dist-server/node_modules/
}

main() {
  local platform="${1:-auto}"
  if [[ "$platform" == "auto" ]]; then
    platform="$(detect_platform)"
  fi

  validate_platform "$platform"
  install_server_deps
  run_bundler "$platform"
  copy_runtime_assets
}

main "$@"
