# Pro Se VA (proseva)

[![Tests](https://github.com/geoffsee/proseva/actions/workflows/test.yml/badge.svg)](https://github.com/geoffsee/proseva/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

> This software is without warranty or guarantee of any kind. Designed for educational and personal legal case management purposes. Users are responsible for legal accuracy and compliance with Virginia state laws. Always consult a legal professional.

AI-powered legal case management for self-represented litigants in Virginia. Manage cases, deadlines, filings, evidence, finances, and documents with post-quantum encryption and AI assistance.

## 1. Features

- **Case & deadline tracking** with Virginia-specific court rules and automatic calculations
- **Document management** with AI-powered PDF ingestion, full-text search, and semantic search
- **AI assistant** with access to case data, report generation, and document analysis (requires OpenAI API key)
- **Financial & evidence tracking** with organized records and timeline visualization
- **Post-quantum encryption** using ML-KEM-1024 + AES-256-GCM for all data at rest

## 2. Quick Start

```bash
# Install dependencies
bun install

# Start frontend (port 5173) and backend (port 3001)
bun run dev
```

Set `OPENAI_API_KEY` in a `.env` file to enable AI features.

## 3. Tech Stack

| Layer    | Technology                                          |
| -------- | --------------------------------------------------- |
| Frontend | React 19, MobX State Tree, Chakra UI, Vite          |
| Backend  | Bun, Itty Router, JSON file DB                      |
| Security | ML-KEM-1024 + AES-256-GCM, bcrypt passphrase auth   |
| Testing  | Vitest, React Testing Library, 70% coverage target   |

## 4. Scripts

```bash
bun run dev            # Start frontend + backend
bun run build          # Production build
bun run test           # Run frontend tests
bun run test:server    # Run backend tests
bun run lint           # Lint code
./reset-db.sh          # Reset database
./manage-db.sh         # Database management menu
```

## 5. License

MIT - see [LICENSE.md](./LICENSE.md)

Copyright 2026 Seemueller
