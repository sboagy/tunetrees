# Proposal: `verifyDbIntegrity()` Helper

Date: 2025-11-24  
Status: Draft (For future consideration)  
Author: Copilot (assistant)  
Related Areas: Offline DB (sql.js), Drizzle ORM, IndexedDB persistence, Sync, Scheduling

## 1. Motivation
Intermittent initialization issues and silent schema drift are difficult to diagnose once the app is loaded. A lightweight integrity check run after `initializeDb()` (and optionally on demand) provides immediate feedback about structural soundness, schema/version alignment, and core business invariants. This improves developer confidence, speeds regression detection, and gives a stable point-in-time diagnostic snapshot without requiring deep interactive debugging.

## 2. Goals & Non‑Goals
**Goals:**
- Fast (<100ms typical) structural and invariant validation of the local SQLite WASM database.
- Structured result object for programmatic use (debug panel, automated QA hooks, logs).
- Zero writes / side effects; purely read-only introspection.
- Configurable depth (cheap core checks by default; heavier checks opt-in).

**Non‑Goals:**
- Full data consistency auditing (e.g., cross-table deep referential scanning of entire dataset).
- Replacement for migration logic or sync conflict resolution.
- Performance profiling beyond simple elapsed time measurement.

## 3. Scope of Checks
| Category | Purpose | Default | Notes |
|----------|---------|---------|-------|
| Version Alignment | Detect mismatch between `CURRENT_DB_VERSION`, IndexedDB stored version, and migration tracker | Yes | Compares DB blob version byte + local schema version functions |
| Essential Tables | Ensure required tables exist (`tune`, `playlist`, `playlist_tune`, `practice_record`, `sync_queue`, etc.) | Yes | Uses `PRAGMA table_info` presence |
| Views Presence | Confirm critical views compile (`practice_list_staged`, `view_playlist_joined`, `view_daily_practice_queue_readable`) | Yes | Executes `SELECT 1 FROM view LIMIT 1` |
| Foreign Key Health | Check for violations via `PRAGMA foreign_key_check` | Yes (if pragma enabled) | Warn if foreign_keys disabled |
| Business Invariants | Simple duplicate / invalid state checks (e.g., duplicate active practice_record for same tune/day) | Yes | Tune for high‑value invariants only |
| Sync Queue Sanity | Validate statuses and error field consistency | Yes | Status ∈ {pending,syncing,synced,failed} |
| Soft Delete Consistency | Detect live references to deleted rows (spot checks) | Optional | Can be enabled in strict mode |
| Persistence Roundtrip | Export, reopen in temp DB, compare selected table counts | Optional | Similar to existing persist verification; heavier |
| Index / Performance Anomalies | Spot missing expected indexes (`PRAGMA index_list`) | Optional | Future enhancement |

## 4. Result Structure
```ts
interface DbIntegrityResult {
  ok: boolean;                // true if no critical failures
  elapsedMs: number;          // total time for the check
  version: {
    current: number;          // CURRENT_DB_VERSION constant
    stored: number;           // byte from IndexedDB version store (or 0 if missing)
    localSchema: number | null; // getLocalSchemaVersion()
    migrationTarget: number;  // getCurrentSchemaVersion()
    mismatch: boolean;        // any discrepancy worth highlighting
  };
  tables: {
    missing: string[];
  };
  views: {
    errored: string[];        // views that threw during SELECT test
  };
  foreignKeys: {
    enabled: boolean;
    issues: Array<{ table: string; rowid: number; parent: string }>;
  };
  invariants: {
    practiceDuplicates: number;      // duplicates violating (tuneId, date)
    softDeleteBrokenRefs?: number;   // optional strict mode count
  };
  syncQueue: {
    invalidStatuses: number;
    failedWithoutError: number;
    total: number;
  };
  warnings: string[];          // non-fatal messages (e.g., foreign_keys off)
  errors: string[];            // structural failures
}
```

## 5. Function Signature
```ts
interface VerifyOptions {
  strict?: boolean;            // throw on failure or include optional heavier checks
  checkSoftDeletes?: boolean;  // enable soft-delete reference scan
  checkPersistence?: boolean;  // perform export/reopen count comparison
  timeoutMs?: number;          // abort if exceeds threshold (defaults 300ms)
  log?: boolean;               // emit structured console output
}

async function verifyDbIntegrity(options?: VerifyOptions): Promise<DbIntegrityResult>;
```

## 6. Algorithm Outline
1. Start timer.
2. Read version byte from IndexedDB (`loadFromIndexedDB(DB_VERSION_KEY)`).
3. Collect essential table names and iterate `PRAGMA table_info(name)` to determine presence.
4. For each critical view, run `SELECT 1 FROM view LIMIT 1` inside try/catch.
5. Foreign key checks:
   - Query `PRAGMA foreign_keys;` → enabled?
   - If enabled: `PRAGMA foreign_key_check;` gather rows.
6. Invariants:
   - Practice duplicates: `SELECT tune_ref, practice_date, COUNT(*) c FROM practice_record WHERE deleted=0 GROUP BY tune_ref, practice_date HAVING c>1` count rows.
   - (Optional) Soft delete references: sample `playlist_tune` pointing to deleted `playlist`.
7. Sync queue: `SELECT status, last_error, COUNT(*) c FROM sync_queue GROUP BY status, last_error` aggregate to compute invalid statuses and missing error info.
8. (Optional) Persistence roundtrip:
   - Export DB blob → instantiate temporary `new SQL.Database(blob)`.
   - Compare counts of a small subset of tables (`tune`, `playlist`, `sync_queue`).
9. Compile warnings/errors and set `ok` flag.
10. If `strict && !ok`: throw with summarized error list.
11. Log structured summary if `log` true.
12. Return `DbIntegrityResult`.

## 7. Performance Considerations
- Queries restricted to counts and existence checks (no large scans).
- Optional features guarded by flags to avoid cost in default development path.
- Early abort logic if timer exceeds `timeoutMs` (skips remaining heavy optional steps, appends warning).

## 8. Usage Patterns
**After Initialization (Dev):**
```ts
await initializeDb();
const integrity = await verifyDbIntegrity({ log: true });
if (!integrity.ok) console.warn("DB integrity issues detected", integrity);
```
**Pre-Migration:** Capture snapshot before destructive changes.
**QA/E2E Harness:** Expose helper on `window.__verifyDbIntegrity()` for Playwright to assert readiness.
**Debug Panel:** Render summary (tables missing, foreign key issues, invariant counts).

## 9. Rollout Plan
1. Implement minimal version (tables + views + version + FK) — Phase A.
2. Add invariants + sync queue checks — Phase B.
3. Introduce optional persistence roundtrip + soft delete scan — Phase C.
4. Wire to development entrypoint (only in non‑production builds) and export test hook.
5. Add a Vitest unit using a seeded in-memory DB to validate result structure.

## 10. Future Extensions
- Index presence & expected index coverage.
- Data size thresholds (warn if blob > X MB or if table row count unexpectedly large).
- Historical snapshots with diff (previous run vs current run).
- Integration with lighthouse/performance test to capture DB footprint.
- Tagging integrity result with user/session info for remote diagnostics.

## 11. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Overhead on large datasets | Slow startup | Keep default checks O(number_of_tables + number_of_key_views) |
| False positives due to intentional duplicates | Noise | Scope invariants to well-defined uniqueness rules only |
| Foreign key check disabled silently | Missed violations | Emit explicit warning when pragma off |
| HMR instability for temporary DB in persistence test | Spurious errors | Gate persistence roundtrip behind explicit flag |

## 12. Acceptance Criteria (for initial merge)
- Function exists, returns `DbIntegrityResult` with populated version/tables/views/foreignKeys fields.
- Executes in <100ms on dev sample database (<10k rows).
- Does not throw unless `strict` enabled.
- Logs one concise summary line when `log: true`.
- Unit test: Creates minimal schema, runs helper, asserts `ok === true`.*

(* Note: For initial version test does not cover persistence roundtrip.)

## 13. Open Questions
- Should we persist last integrity result for later comparison? (Not initially.)
- Should practice duplicate detection consider only a subset of statuses? (Yes: exclude deleted/archived.)
- Is soft-delete reference scanning needed immediately? (Probably defer to Phase C.)

## 14. Implementation Notes
- Leverage existing `sqliteDb` instance directly; avoid Drizzle for lowest overhead on existence checks.
- Keep helper colocated in `client-sqlite.ts` or create `verify.ts` under `src/lib/db/` to keep primary client file lean.
- `verifyDbIntegrity` should early-return if `sqliteDb` is null with `ok=false` and error message.

---
**Decision Placeholder:** Pending maintainers' review. No code changes executed yet.
