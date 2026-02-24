#!/usr/bin/env bash

echo "Cleaning up build artifacts and temporary directories..."

find . -name "node_modules" -type d -prune -exec rm -rf {} \;
find . -name ".proseva-data" -type d -prune -exec rm -rf {} \;
find . -name "dist-electron" -type d -prune -exec rm -rf {} \;
find . -name "dist-server" -type d -prune -exec rm -rf {} \;
find . -name ".wrangler" -type d -prune -exec rm -rf {} \;
find . -name "dist" -type d -prune -exec rm -rf {} \;
find . -name "coverage" -type d -prune -exec rm -rf {} \;

echo "Cleanup complete!"
