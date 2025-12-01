# Serverless Sync Implementation Plan

**Status:** Proposed  
**Architecture:** Hybrid Local-First (SQLite WASM + Cloudflare Workers)  
**Authored:** November 30, 2025  
**Context:** [Issue #300 Refactor](issue-300-sync-refactor-implementation-plan.md) | [Original Proposal](proposal-server-worker.md)

---

## 1. Executive Summary

This plan details the migration of the synchronization engine from a browser-side "Smart Client" to a "Serverless Hybrid" model.

**Core Architecture:**
1.  **Client:** "Dumb" sync. Collects dirty rows from `sync_outbox`, sends batch to Worker, applies response.
2.  **Worker:** "Smart" sync. Handles authentication, conflict resolution, and transactional writes to PostgreSQL via Hyperdrive.
3.  **Realtime:** "Signal-to-Sync". Supabase Realtime events trigger the Client to call the Worker (debounced), ensuring a single, validated write path.
4.  **Schema:** Dual-schema (SQLite/Postgres) synchronized via **Shared Constants**.

---

## 2. Directory Structure & Shared Code

To support the "Shared Constants" pattern and code sharing, we will introduce a `shared/` directory.

```text
tunetrees/
├── shared/                 # NEW: Code shared between Client and Worker
│   ├── db-constants.ts     # Table/Column names (Single Source of Truth)
│   └── sync-types.ts       # API Request/Response interfaces
├── src/                    # Client (Vite/SolidJS)
│   ├── lib/db/
│   │   └── schema-sqlite.ts # Imports from shared/db-constants.ts
│   └── ...
├── worker/                 # NEW: Cloudflare Worker
│   ├── src/
│   │   ├── index.ts
│   │   └── schema-postgres.ts # Imports from shared/db-constants.ts
│   ├── wrangler.toml
│   └── package.json
└── ...
```

---

## 3. Implementation Phases

### Phase 1: Shared Infrastructure (The "Drift Prevention" Layer) (Completed)

**Goal:** Decouple schema definitions from string literals to ensure SQLite and Postgres schemas remain compatible.

1.  **Create `shared/db-constants.ts`:** (Done)
    *   Define enums/constants for all table names.
    *   Define constants for column names.
    *   *Example:* `export const TBL = { TUNE: 'tune', ... }; export const COL = { ID: 'id', ... };`

2.  **Refactor `drizzle/schema-sqlite.ts`:** (Done)
    *   Update existing schema to use constants.
    *   *Check:* `npm run typecheck` must pass.

3.  **Create `worker/src/schema-postgres.ts`:** (Done)
    *   Define the PostgreSQL equivalent of the schema.
    *   Use the same constants from `shared/db-constants.ts`.
    *   Map types: `text` -> `text`, `integer` (boolean) -> `boolean`, `integer` (timestamp) -> `timestamp`.

### Phase 2: Worker Setup (Next)

**Goal:** Initialize the serverless environment.

1.  **Initialize Worker:**
    *   Create `worker/` directory.
    *   Configure `wrangler.toml` with **Hyperdrive** binding (`HYPERDRIVE`) and Supabase secrets (`SUPABASE_URL`, `SUPABASE_JWT_SECRET`).
2.  **Dependencies:**
    *   Install `drizzle-orm`, `postgres`, `@supabase/supabase-js` (or `jsonwebtoken` for lighter auth).
3.  **Database Connection:**
    *   Setup Drizzle with `postgres` driver using the Hyperdrive connection string.

### Phase 3: The Sync Endpoint (`POST /api/sync`)

**Goal:** Implement the transactional sync logic.

**Logic Flow:**

1.  **Authentication:**
    *   Extract Bearer token.
    *   Verify JWT signature using `SUPABASE_JWT_SECRET`.
    *   Extract `sub` (User ID).

2.  **Transaction Start (The "Sandwich"):**
    *   **Layer 1: Push (Client -> Server)**
        *   Iterate through `payload.changes`.
        *   For each row:
            *   Fetch current server row (lock if possible).
            *   **Conflict Resolution:** If `client.last_modified_at > server.last_modified_at`, write to DB. Else, ignore.
            *   **Soft Deletes (Critical):**
                *   If `operation === 'DELETE'`, execute `UPDATE table SET deleted = TRUE, last_modified_at = NOW() WHERE id = ?`.
                *   Do *not* execute SQL `DELETE`. This ensures other clients receive the "tombstone" during their Pull phase.
            *   *Note:* Use `ON CONFLICT` clauses where appropriate, but application-level checks may be needed for complex logic.
    *   **Layer 2: Pull (Server -> Client)**
        *   Query all tables for rows where `last_modified_at > payload.lastSyncAt`.
        *   Filter by `user_id` (enforce RLS logic manually or via Postgres policies if using a session-based connection).
    *   **Commit Transaction.**

3.  **Response:**
    *   Return `{ changes: { ... }, timestamp: <server_now> }`.

### Phase 4: Client Integration

**Goal:** Refactor `SyncEngine` to use the Worker.

1.  **Update `SyncEngine.ts`:**
    *   **Method:** `syncWithWorker()`.
    *   **Step 1:** Read all rows from `sync_outbox`.
    *   **Step 2:** Transform to `snake_case` (using existing adapters).
    *   **Step 3:** `POST` to Worker.
    *   **Step 4:** On success:
        *   Delete sent rows from `sync_outbox`.
        *   Transform response rows to `camelCase`.
        *   Batch insert/update to local SQLite.
        *   Update `last_sync_timestamp`.

2.  **Realtime Integration ("Signal-to-Sync"):**
    *   Subscribe to Supabase Realtime channels (as before).
    *   **On Event:** Do NOT process the payload.
    *   **Action:** Trigger a debounced call to `syncWithWorker()`.
    *   *Debounce:* e.g., Wait 2 seconds after last event before syncing.
    *   **Client-Side Deletion:** When the Client receives a record with `deleted = true` (from the Worker response), it must execute a local `DELETE` (or soft-delete if local schema supports it) to remove the item from the UI.

### Phase 5: Deployment & Cutover

1.  **Deploy Worker:** `npx wrangler deploy`.
2.  **Feature Flag:** Add `useWorkerSync` flag in Client.
3.  **Testing:**
    *   **Data Integrity:** Verify `shared/db-constants.ts` prevents schema mismatch.
    *   **Conflict:** Test "Last Write Wins" scenarios.
    *   **Realtime:** Verify that a change on Device A triggers a "Signal" on Device B, which then pulls data via Worker.

---

## 4. Clarifying Questions / Risks

1.  **RLS in Worker:** Since the Worker connects via a connection pool (Hyperdrive) usually with a service role or a single shared user, standard Supabase RLS (which relies on `auth.uid()`) might not work automatically.
    *   *Mitigation:* We may need to manually enforce `WHERE user_id = ?` in our Drizzle queries within the Worker, OR set the configuration parameter `request.jwt.claim.sub` for the transaction if using the transaction-scoped config pattern.
    *   *Decision Needed:* Will we rely on manual `WHERE` clauses (safer/explicit in code) or try to impersonate the user at the DB level? **Recommendation: Manual WHERE clauses for Phase 1.**

2.  **Shared Code Bundling:**
    *   Ensuring `wrangler` correctly bundles code from `../shared` might require specific `tsconfig.json` paths or a build step.
    *   *Solution:* Configure `worker/tsconfig.json` with explicit paths:
        ```json
        {
          "compilerOptions": {
            "baseUrl": ".",
            "paths": { "@shared/*": ["../shared/*"] }
          }
        }
        ```
    *   We will verify this during Phase 2.
