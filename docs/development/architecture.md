# TuneTrees Architecture

## Overview

TuneTrees is an **offline-first Progressive Web App** built with SolidJS. All user operations happen instantly against a local SQLite database, with changes synced to Supabase PostgreSQL in the background.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   SolidJS UI ←──────── Reactive Signals                 │
│       │                                                  │
│       ▼                                                  │
│   Drizzle ORM ────────► SQLite WASM (sql.js)            │
│       │                      │                           │
│       │                      ▼                           │
│       │               IndexedDB (persistence)            │
│       │                                                  │
│       ▼                                                  │
│   Sync Queue ─────────► Sync Engine                     │
│                              │                           │
└──────────────────────────────┼───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│                    Cloud (Supabase)                      │
├──────────────────────────────────────────────────────────┤
│   PostgreSQL ◄────── Auth ◄────── Realtime              │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI Framework | SolidJS 1.8+ |
| Routing | @solidjs/router |
| UI Components | shadcn-solid, @kobalte/core |
| Styling | Tailwind CSS 4.x |
| Local Database | SQLite WASM (sql.js) |
| ORM | Drizzle ORM |
| Cloud Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Realtime | Supabase Realtime |
| PWA | vite-plugin-pwa + Workbox |
| Build | Vite 5.x |
| Deployment | Cloudflare Pages |

## Data Flow

### Write Path (User Action → Cloud)

```
1. User taps "Good" on a tune
2. UI updates immediately (optimistic)
3. Write to local SQLite
4. Queue sync item
5. Persist to IndexedDB
6. Background: Upload to Supabase
```

### Read Path (Cloud → UI)

```
1. Page loads
2. Check IndexedDB for persisted SQLite
3. Load into memory
4. Query via Drizzle ORM
5. Render via SolidJS signals
6. Background: Sync down remote changes
```

## Key Components

### 1. Database Layer (`src/lib/db/`)

- **client-sqlite.ts** - SQLite WASM initialization & Drizzle client
- **queries/** - Type-safe database queries
- **init-views.ts** - SQL VIEW definitions

### 2. Sync Layer (`src/lib/sync/`)

- **queue.ts** - Sync queue management
- **engine.ts** - Upload/download logic
- **service.ts** - High-level sync orchestration
- **realtime.ts** - Supabase Realtime subscriptions

### 3. Auth Layer (`src/lib/auth/`)

- **AuthContext.tsx** - Global auth state, database initialization, sync signals

### 4. Services (`src/lib/services/`)

- **practice-queue.ts** - Daily practice queue generation
- **practice-staging.ts** - FSRS preview calculations
- **practice-recording.ts** - Commit evaluations

## Offline-First Principles

1. **Local-first writes:** All database writes go to SQLite immediately
2. **Async sync:** Changes queue for background upload
3. **Sync-before-download:** Always upload pending changes before pulling remote
4. **Conflict resolution:** Last-write-wins (based on timestamp)
5. **Graceful degradation:** App fully functional when offline

## Spaced Repetition

TuneTrees uses the **FSRS algorithm** (ts-fsrs library):

```
User rates tune → FSRS calculates → Next review date stored
       ↓
  Again (1) → Short interval (1 day)
  Hard  (2) → Medium interval
  Good  (3) → Scheduled interval
  Easy  (4) → Long interval (2x normal)
```

Key tables:
- `practice_record` - Historical practice events (immutable)
- `repertoire_tune` - Current scheduling state
- `daily_practice_queue` - Frozen daily snapshot

## Security

- **Authentication:** Supabase Auth (JWT-based)
- **Row Level Security:** PostgreSQL RLS policies per-user
- **API:** Supabase client with anon key + user JWT

---

For detailed sync internals, see [reference/sync.md](../reference/sync.md).
