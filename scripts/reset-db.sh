#!/bin/bash

# Quick reset script - clears all data and starts fresh
# Use this when you want a clean slate

DB_FILE="server/data/db.json"
BACKUP_DIR="server/data/backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup current database if it exists
if [ -f "$DB_FILE" ]; then
    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="$BACKUP_DIR/db_backup_$timestamp.json"
    cp "$DB_FILE" "$backup_file"
    echo "✓ Current database backed up to: $backup_file"
fi

# Create fresh empty database
cat > "$DB_FILE" << 'EOF'
{
  "cases": {},
  "contacts": {},
  "deadlines": {},
  "finances": {},
  "evidences": {}
}
EOF

echo "✓ Database reset successfully!"
echo "✓ All data cleared - ready for your own data"
echo ""
echo "Start the servers to begin using the app:"
echo "  1. Backend:  cd server && bun run dev"
echo "  2. Frontend: npm run dev"
