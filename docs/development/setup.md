# Development Setup Guide

Get TuneTrees running locally for development.

## Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** or **pnpm**
- **Git**

## Quick Start

```bash
# Clone repository
git clone https://github.com/sboagy/tunetrees.git
cd tunetrees

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials (see below)

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Environment Variables

Create `.env.local` with:

```env
# Supabase Configuration (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Worker URL for sync (production only)
VITE_WORKER_URL=https://tunetrees-sync-worker.workers.dev
```

### Getting Supabase Credentials

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → API
4. Copy "Project URL" and "anon public" key

## Development Commands

```bash
# Development
npm run dev           # Start dev server (http://localhost:5173)
npm run build         # Production build
npm run preview       # Preview production build

# Code Quality
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
npm run format        # Prettier formatting

# Testing
npm run test          # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
npm run test:e2e:headed  # E2E tests with browser UI
```

## Project Structure

```
tunetrees/
├── src/
│   ├── components/     # SolidJS components
│   ├── routes/         # Page components (file-based routing)
│   ├── lib/
│   │   ├── auth/       # Authentication context
│   │   ├── db/         # Database client & queries
│   │   ├── sync/       # Sync engine
│   │   └── services/   # Business logic
│   └── assets/         # Static assets
├── drizzle/            # Database schema
├── e2e/                # E2E tests (Playwright)
├── tests/              # Unit tests (Vitest)
├── worker/             # Cloudflare Worker (sync API)
└── docs/               # Documentation
```

## Database Setup

TuneTrees uses two databases:
- **SQLite WASM** (browser) - Local offline storage
- **PostgreSQL** (Supabase) - Cloud sync & backup

### Local Development

The app uses SQLite WASM in the browser. No local database setup needed!

On first load:
1. Empty SQLite database created in memory
2. Schema applied via Drizzle migrations
3. Data synced from Supabase (if logged in)
4. Persisted to IndexedDB

### Reset Local Database

In browser DevTools console:
```javascript
indexedDB.deleteDatabase('tunetrees-storage')
```

Then refresh the page.

## Running Tests

### Unit Tests

```bash
npm run test           # Run once
npm run test -- --watch  # Watch mode
```

### E2E Tests

```bash
# Headless
npm run test:e2e

# With browser UI
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

E2E tests require the dev server running (`npm run dev`).

## Code Style

- **TypeScript:** Strict mode, no `any` types
- **Components:** SolidJS (not React!)
- **Formatting:** Prettier (auto-format on save)
- **Linting:** ESLint with SolidJS rules

### Pre-commit Checklist

```bash
npm run typecheck && npm run lint && npm run format && npm run test
```

## Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules
npm install
```

### Port 5173 in use
```bash
# Kill existing process
lsof -ti:5173 | xargs kill
# Or use different port
npm run dev -- --port 3000
```

### TypeScript errors after schema change
```bash
npm run db:generate  # Regenerate Drizzle types
```

---

See [Architecture](architecture.md) for system design details.
