# Pro Se VA (proseva) - AI Legal Case Management Software

[![Tests](https://github.com/geoffsee/proseva/actions/workflows/test.yml/badge.svg)](https://github.com/geoffsee/proseva/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

> This software is without warranty or guarantee of any kind. This project is designed for educational and personal legal case management purposes. Users are responsible for legal accuracy and compliance with Virginia state laws. Always consult a legal professional.

AI case management software designed to help self-represented litigants (pro se) in Virginia manage custody cases, deadlines, filings, evidence, and finances. Features AI-powered document analysis, deadline tracking, and intelligent chat assistance.

## Key Features

### 📋 Case Management

- **Deadline Tracking** - Automatic deadline calculation with Virginia-specific rules
- **Filing Records** - Track case filings and document submissions
- **Calendar View** - Visual calendar interface for case events
- **Evidence Organization** - Organize and tag evidence with full-text search
- **Financial Tracking** - Track case-related expenses and income
- **Contact Management** - Manage attorneys, court contacts, and parties
- **Timeline Visualization** - Interactive timeline of case events
- **Task Board** - Kanban-style task management for case activities

### 📄 Document Management

- **Document Generation** - Generate legal documents from templates
- **Document Ingestion** - Automatic AI-powered extraction from uploaded PDFs
- **Full-Text Search** - Search across all documents and notes
- **Note Taking** - Rich notes organized by category

### 🤖 AI Features

- **AI Chat Assistant** - Intelligent chatbot with access to case data
- **Report Generation** - AI-powered case summaries, evidence analysis, and chronologies
- **Knowledge RAG** - Semantic search across document embeddings
- **Deadline Evaluation** - Automated evaluation of upcoming deadlines
- **Smart Document Processing** - Auto-populate case fields from documents

### ⚖️ Legal Specialization

- **Virginia-Specific Rules** - Custody calculations and legal rules for Virginia
- **Legal Resources** - Glossary, statutes, and court information
- **Estate Planning** - Asset and beneficiary tracking for estate management
- **App Settings** - Customizable legal settings and preferences

### 🔔 Notifications

- **Device Token Management** - Register devices for push notifications
- **SMS Recipients** - Send SMS notifications to multiple recipients
- **Scheduled Notifications** - Automated deadline and event reminders

## Tech Stack

### Frontend

- **Framework**: React 19 with React Router 7
- **State Management**: MobX State Tree (MST) with localStorage persistence
- **UI Components**: Chakra UI
- **Styling**: Emotion CSS-in-JS
- **Build Tool**: Vite
- **Development Server**: Port 5173 (proxies /api to :3001)

### Backend

- **Runtime**: Bun
- **Framework**: Itty Router (lightweight HTTP routing)
- **Database**: JSON file-based (`server/data/db.json`)
- **Port**: 3001
- **AI Integration**: OpenAI API (optional, for reports and document analysis)

### Testing

- **Framework**: Vitest
- **DOM Environment**: Happy DOM
- **React Testing**: React Testing Library
- **Coverage Target**: 70% lines, functions, branches, statements

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- Node.js 18+ (optional, as Bun is recommended)

### Installation

```bash
# Install dependencies
bun install

# Create initial database files
./manage-db.sh
```

### Development

```bash
# Start both frontend and backend
bun run dev

# Or start them separately:
bun run dev:frontend  # Frontend only (port 5173)
bun run dev:server    # Backend only (port 3001)
```

The frontend will be available at `http://localhost:5173` and automatically proxies API requests to the backend.

### Loading Data

```bash
# Load your real case data (recommended first step)
./load-my-data.sh

# Reset database to empty state
./reset-db.sh

# Interactive database management
./manage-db.sh

# Interactive data entry
./load-data.sh
```

## Project Structure

```
proseva/
├── src/                          # Frontend (React)
│   ├── pages/                    # Top-level page components
│   ├── components/               # Reusable UI components
│   ├── store/                    # MobX State Tree stores
│   ├── lib/                      # Utilities & helpers
│   │   ├── api.ts               # API client
│   │   ├── dateUtils.ts         # Date utilities
│   │   └── virginia/            # VA-specific legal rules
│   ├── types/                    # TypeScript definitions
│   └── App.tsx                   # Main app component
│
├── server/                       # Backend (Bun/Itty Router)
│   ├── src/
│   │   ├── index.ts             # Main API server
│   │   ├── db.ts                # Database types & structure
│   │   ├── ingest.ts            # PDF text extraction
│   │   ├── ingestion-agent.ts   # AI document processing
│   │   ├── reports.ts           # AI report generation
│   │   ├── search.ts            # Semantic search
│   │   ├── scheduler.ts         # Cron job scheduling
│   │   ├── evaluator.ts         # Deadline evaluation
│   │   └── notifications/       # Push & SMS notifications
│   └── data/
│       ├── db.json              # Main database file
│       ├── embeddings-database.json  # Document embeddings
│       └── backups/             # Automated backups
│
├── e2e/                          # End-to-end tests
├── public/                       # Static assets
├── vite.config.ts               # Vite configuration
├── vitest.config.ts             # Vitest configuration
├── capabilities.md              # Feature list
└── README.md                     # This file
```

## Key Files

### Frontend

- **src/App.tsx** - React Router setup and authentication
- **src/store/RootStore.ts** - Central MobX store with localStorage sync
- **src/lib/api.ts** - HTTP client for API communication
- **src/pages/** - Full-page components (Dashboard, CaseTracker, Reports, etc.)

### Backend

- **server/src/index.ts** - API routes and server setup
- **server/src/db.ts** - Database schema and types
- **server/src/reports.ts** - OpenAI integration for report generation
- **server/src/notifications/** - Firebase and Twilio integrations

## API Endpoints

| Method   | Endpoint                | Description                |
| -------- | ----------------------- | -------------------------- |
| GET/POST | `/api/cases`            | Case CRUD operations       |
| GET/POST | `/api/deadlines`        | Deadline management        |
| GET/POST | `/api/contacts`         | Contact management         |
| GET/POST | `/api/filings`          | Filing records             |
| GET/POST | `/api/evidence`         | Evidence organization      |
| GET/POST | `/api/finances`         | Financial tracking         |
| GET/POST | `/api/documents`        | Document management        |
| POST     | `/api/documents/ingest` | PDF ingestion & extraction |
| POST     | `/api/search`           | Semantic document search   |
| POST     | `/api/reports`          | Generate AI reports        |
| POST     | `/api/chat`             | AI chat with tool use      |
| GET      | `/api/config`           | App configuration          |

## Development

### Running Tests

```bash
# Run all tests
bun run test

# Run tests with coverage report
bun run test:coverage

# Run tests in watch mode
bun run test -- --watch

# Run a specific test file
bun run test src/pages/Dashboard.test.tsx
```

### Linting

```bash
# Lint all code
bun run lint

# Fix linting issues
bun run lint --fix
```

### Building

```bash
# Build for production
bun run build

# Preview production build locally
bun run preview
```

## State Management

The app uses **MobX State Tree (MST)** for state management:

- **Observable state** - Automatic change tracking
- **localStorage persistence** - Automatic saving via `onSnapshot()`
- **Type-safe stores** - Full TypeScript support
- **Computed values** - Derived state and reactions

### Key Stores

- **CaseStore** - Case CRUD operations
- **DeadlineStore** - Deadline management and evaluation
- **EvidenceStore** - Evidence organization
- **FinanceStore** - Financial tracking
- **DocumentStore** - Document management
- **ChatStore** - Chat messages and AI interaction
- **ContactStore** - Contact management
- **NoteStore** - Note storage and organization

## Database

### Storage Strategy

- **Frontend**: localStorage (automatic via MST snapshots)
- **Backend**: JSON file (`server/data/db.json`)
- **Backups**: Automated backups in `server/data/backups/`
- **Embeddings**: Semantic search vectors in `server/data/embeddings-database.json`

### Persistence

- Frontend changes → localStorage → MST snapshot
- Backend mutations → in-memory → JSON file write
- Optional at-rest encryption for `db.json` (via runtime recovery key)
- Middleware triggers persistence on non-GET requests

## Configuration

### Environment Variables

Environment variables can be set in a `.env` file in the project root or passed to the runtime. The app uses a priority system: **Database Config > Environment Variables**.

This means values can be configured either via environment variables or through the API/Settings UI, with database values taking precedence.

#### AI & Report Generation

| Variable          | Required | Default        | Description                                                          |
| ----------------- | -------- | -------------- | -------------------------------------------------------------------- |
| `OPENAI_API_KEY`  | ✅ Yes   | -              | OpenAI API key for report generation, document analysis, and AI chat |
| `OPENAI_ENDPOINT` | ❌ No    | OpenAI default | Custom OpenAI endpoint (for Azure OpenAI or compatible services)     |

#### Firebase Push Notifications

| Variable                | Required | Default | Description                                 |
| ----------------------- | -------- | ------- | ------------------------------------------- |
| `FIREBASE_PROJECT_ID`   | ❌ No    | -       | Firebase project ID for push notifications  |
| `FIREBASE_PRIVATE_KEY`  | ❌ No    | -       | Firebase private key (JSON service account) |
| `FIREBASE_CLIENT_EMAIL` | ❌ No    | -       | Firebase client email from service account  |

#### Twilio SMS Notifications

| Variable              | Required | Default | Description                                                |
| --------------------- | -------- | ------- | ---------------------------------------------------------- |
| `TWILIO_ACCOUNT_SID`  | ❌ No    | -       | Twilio account SID for SMS notifications                   |
| `TWILIO_AUTH_TOKEN`   | ❌ No    | -       | Twilio authentication token                                |
| `TWILIO_PHONE_NUMBER` | ❌ No    | -       | Twilio phone number to send SMS from (format: +1234567890) |

#### Scheduler & Evaluations

| Variable              | Required | Default         | Description                                                                 |
| --------------------- | -------- | --------------- | --------------------------------------------------------------------------- |
| `EVALUATION_ENABLED`  | ❌ No    | `true`          | Enable/disable automatic deadline evaluations (set to `"false"` to disable) |
| `EVALUATION_TIMEZONE` | ❌ No    | System timezone | Timezone for scheduling evaluations (e.g., `America/New_York`)              |

#### Auto-Ingestion

| Variable          | Required | Default | Description                                              |
| ----------------- | -------- | ------- | -------------------------------------------------------- |
| `AUTO_INGEST_DIR` | ❌ No    | -       | Directory path to watch for automatic document ingestion |

#### Database Encryption

| Variable                      | Required | Default | Description                                                                         |
| ----------------------------- | -------- | ------- | ----------------------------------------------------------------------------------- |
| `PROSEVA_DB_ENCRYPTION_KEY`   | ❌ No    | -       | Optional startup key for decrypting/encrypting `db.json` (AES-256-GCM + PBKDF2).   |

If `PROSEVA_DB_ENCRYPTION_KEY` is not set, the app can still be unlocked by entering a recovery key in the Settings page or startup unlock prompt.

#### Example `.env` File

```env
# AI Features (required for full functionality)
OPENAI_API_KEY=sk-proj-abc123...

# Push Notifications (optional)
FIREBASE_PROJECT_ID=my-project
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@my-project.iam.gserviceaccount.com

# SMS Notifications (optional)
TWILIO_ACCOUNT_SID=AC123456789abcdef
TWILIO_AUTH_TOKEN=auth_token_here
TWILIO_PHONE_NUMBER=+15551234567

# Scheduler (optional)
EVALUATION_ENABLED=true
EVALUATION_TIMEZONE=America/New_York

# Auto-Ingestion (optional)
AUTO_INGEST_DIR=/path/to/documents/folder

# Optional startup DB encryption key
PROSEVA_DB_ENCRYPTION_KEY=your-recovery-key
```

### Configuration Priority

The app checks configuration in this order:

1. **Database Config** - Values stored in `server/data/db.json` via the API/UI (highest priority)
2. **Environment Variables** - Values from `.env` file or runtime environment
3. **Default Values** - Built-in defaults if neither above is set

To update config via the API:

```bash
POST /api/config
{
  "firebase": { "projectId": "...", "privateKey": "...", "clientEmail": "..." },
  "twilio": { "accountSid": "...", "authToken": "...", "phoneNumber": "..." },
  "scheduler": { "enabled": true, "timezone": "America/New_York" },
  "ai": { "openaiApiKey": "...", "openaiEndpoint": "..." },
  "autoIngest": { "directory": "..." }
}
```

### App Settings

Configure legal settings, notification preferences, and layout options through the Settings page in the app. These include:

- Default timezone and date format
- Notification delivery preferences
- Case template defaults
- UI theme and layout preferences

## AI Features

### Document Analysis

- Automatic PDF text extraction
- Field auto-population from documents
- Entity recognition (parties, dates, case numbers)

### Report Generation

- Case summaries
- Evidence analysis and organization
- Financial reports and breakdowns
- Case chronologies and timelines

### Chat Assistant

The AI chat has access to:

- Case deadlines
- Contact information
- Financial records
- Document library
- Case timeline
- Knowledge base (document embeddings)

Tools available to the AI:

- `get_deadlines` - Retrieve upcoming deadlines
- `get_contacts` - Search contacts
- `get_finances` - View financial data
- `search_timeline` - Search case events
- `search_knowledge` - Semantic document search
- `analyze_case_graph` - Graph-based relationship and connectivity analysis across case records

## Virginia-Specific Features

- **Custody Formulas** - Guidelines for custody calculations
- **Support Calculations** - Child/spousal support guidelines
- **Deadline Rules** - VA-specific court deadlines and rules
- **Legal Resources** - Virginia courts, statutes, and procedures

Located in `src/lib/virginia/` and `src/pages/LegalResources.tsx`

## Common Tasks

### Adding a New Page

1. Create component in `src/pages/YourPage.tsx`
2. Add route in `src/App.tsx`
3. Create test in `src/pages/YourPage.test.tsx`
4. Add navigation link in `src/components/layout/`

### Adding a New Store

1. Create store in `src/store/YourStore.ts` using MST
2. Add to `RootStore` in `src/store/RootStore.ts`
3. Add localStorage key and onSnapshot watcher
4. Use via `useStore()` context hook

### Adding API Endpoints

1. Add route handler in `server/src/index.ts`
2. Update database types in `server/src/db.ts` if needed
3. Add client method in `src/lib/api.ts`
4. Call from store action or component

### Debugging

- **Store state** - Access via `useStore()` in components
- **API calls** - Check DevTools Network tab; all calls to `/api`
- **localStorage** - Inspect via DevTools > Application > Local Storage
- **Database** - View/edit directly at `server/data/db.json`

## Performance

### Frontend Optimization

- Vite for fast HMR during development
- Code splitting with React Router
- MobX reactions for efficient re-renders
- localStorage for instant offline access

### Backend Optimization

- Lightweight Itty Router (minimal overhead)
- JSON file database (sufficient for single-user)
- Semantic search with embeddings (fast similarity queries)
- Scheduled tasks via Croner (efficient job scheduling)

## Testing Strategy

- **Unit Tests** - Store and utility function tests
- **Component Tests** - React Testing Library tests
- **Page Tests** - Full page component tests with store mocking
- **E2E Tests** - End-to-end user flows
- **Coverage Target** - 70% across all metrics

Test files are colocated with source (`*.test.tsx` or `*.test.ts`)

## Deployment

### Building for Production

```bash
bun run build
```

Outputs:

- Frontend build: `dist/`
- Ready for static hosting (Vercel, Netlify, AWS S3, etc.)
- Backend: Can be deployed separately or alongside

### Environment Setup

1. Set `OPENAI_API_KEY` for AI features
2. Set Firebase/Twilio credentials if using notifications
3. Configure database backup strategy
4. Set up automated data export if needed

## Contributing

### Code Style

- ESLint configuration enforced
- TypeScript for type safety
- Prettier for code formatting

### Git Workflow

1. Create a feature branch
2. Make changes and commit
3. Run tests: `bun run test`
4. Run linter: `bun run lint`
5. Create pull request to `main`

### Quality Standards

- All tests must pass
- Coverage must meet 70% threshold
- No linting errors
- TypeScript strict mode

## Troubleshooting

### Tests Failing

- Clear node_modules and reinstall: `rm -rf node_modules && bun install`
- Check for missing dependencies
- Review CLAUDE.md for test setup requirements

### API Connection Issues

- Ensure backend is running: `bun run dev:server`
- Check proxy settings in vite.config.ts
- Verify API base URL in `src/lib/api.ts`

### Database Issues

- Check `server/data/db.json` is readable/writable
- Reset database: `./reset-db.sh`
- Verify backups exist in `server/data/backups/`

### localStorage Issues

- Check browser's localStorage is enabled
- Clear localStorage and reload: DevTools > Application > Clear Storage
- Verify localStorage keys in `RootStore.ts` STORAGE_KEYS

## Resources
- [capabilities.md](./capabilities.md) - Feature list and capabilities
- [Vite Documentation](https://vitejs.dev)
- [React Documentation](https://react.dev)
- [MobX State Tree Documentation](https://mobx-state-tree.js.org)
- [Chakra UI Documentation](https://chakra-ui.com)
- [Bun Documentation](https://bun.sh/docs)

## Support

For issues, questions, or feature requests:

1. Check existing documentation
2. Review code comments and type definitions
3. Check test files for usage examples
4. Report issues with detailed reproduction steps

## License

MIT [LICENSE.md](./LICENSE.md)

Copyright © 2026 Seemueller
