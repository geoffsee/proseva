#!/bin/sh

HOOK_DIR="$(git rev-parse --show-toplevel)/.git/hooks"

cat > "$HOOK_DIR/pre-commit" << 'EOF'
#!/bin/sh

echo "Running pre-commit checks..."

echo "=> bun run build"
bun run build || { echo "Build failed"; exit 1; }

echo "=> bun run typecheck"
bun run typecheck || { echo "Typecheck failed"; exit 1; }

echo "=> bun run test"
bun run test || { echo "Tests failed"; exit 1; }

echo "All pre-commit checks passed."
EOF

chmod +x "$HOOK_DIR/pre-commit"
echo "Git hooks installed."
