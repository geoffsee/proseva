#!/bin/bash

# Quick reset script - clears all data and starts fresh
# Use this when you want a clean slate

DUCKDB_FILE="server/data/db.duckdb"
LEGACY_JSON_FILE="server/data/db.json"
BACKUP_DIR="server/data/backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

timestamp=$(date +"%Y%m%d_%H%M%S")

backup_and_remove() {
    local source_file="$1"
    local suffix="$2"
    local backup_file="$BACKUP_DIR/db_backup_${timestamp}.${suffix}"
    cp "$source_file" "$backup_file"
    echo "✓ Database backed up to: $backup_file"
    rm "$source_file"
    echo "✓ Removed: $source_file"
}

if [ -f "$DUCKDB_FILE" ]; then
    backup_and_remove "$DUCKDB_FILE" "duckdb"
fi

if [ -f "$LEGACY_JSON_FILE" ]; then
    backup_and_remove "$LEGACY_JSON_FILE" "json"
fi

echo "✓ Database reset successfully!"
echo "✓ All data cleared - fresh database will be created on next startup"
echo ""
echo "Start the servers to begin using the app:"
echo "  1. Backend:  bun run dev:server"
echo "  2. Frontend: bun run dev:frontend"
