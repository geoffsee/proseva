#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DIST_SERVER_DIR="$REPO_ROOT/dist-server"
NODE_MODULES_DIR="$REPO_ROOT/node_modules"

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
  cd "$REPO_ROOT"
  bun install --frozen-lockfile
}

get_bun_compile_target() {
  local platform="$1"
  case "$platform" in
    macos-latest:arm64)  echo "bun-darwin-arm64"  ;;
    macos-latest:x64)    echo "bun-darwin-x64"    ;;
    ubuntu-latest:x64)   echo "bun-linux-x64"     ;;
    windows-latest:x64)  echo "bun-windows-x64"   ;;
    *) echo "Unsupported compile target: $platform" >&2; exit 1 ;;
  esac
}

run_bundler() {
  local platform="$1"
  local compile_target
  compile_target="$(get_bun_compile_target "$platform")"
  cd "$SERVER_DIR"
  mkdir -p "$DIST_SERVER_DIR"

  # Compile standalone server executable
  bun build \
    --compile \
    --target "$compile_target" \
    src/index.ts \
    --outfile "$DIST_SERVER_DIR/proseva-server"

  # Bundle the in-process server module (for ELECTRON_INPROC_SERVER mode)
  bun build \
    --target bun \
    src/index.server.ts \
    --outdir="$DIST_SERVER_DIR"
}

build_explorer() {
  local platform="$1"
  local compile_target
  compile_target="$(get_bun_compile_target "$platform")"
  local explorer_entry="$REPO_ROOT/packages/embeddings/explorer/server.ts"

  echo "Building explorer binary..."
  bun build \
    --compile \
    --target "$compile_target" \
    "$explorer_entry" \
    --outfile "$DIST_SERVER_DIR/proseva-explorer"
}

copy_runtime_assets() {
  cp "$NODE_MODULES_DIR/wasm-similarity/wasm_similarity_bg.wasm" "$DIST_SERVER_DIR/"
  cp "$NODE_MODULES_DIR/wasm-pqc-subtle/wasm_pqc_subtle_bg.wasm" "$DIST_SERVER_DIR/"

  # Use "_modules" instead of "node_modules" so electron-builder does not
  # strip the directory from extraResources.
  mkdir -p "$DIST_SERVER_DIR/_modules"
}

main() {
  local platform="${1:-auto}"
  if [[ "$platform" == "auto" ]]; then
    platform="$(detect_platform)"
  fi

  validate_platform "$platform"
  install_server_deps
  run_bundler "$platform"
  build_explorer "$platform"
  copy_runtime_assets
}

main "$@"
