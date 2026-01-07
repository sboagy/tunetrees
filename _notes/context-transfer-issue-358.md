# Context Transfer: Issue #358 - Sync Engine Migration to oosync

**Date**: January 7, 2026  
**Status**: Ready to implement  
**Branch**: `feat/i355-schema-agnostic-oosync` (or new branch off this)  
**Related Issues**: #357 (completed), #358 (this scope)

---

## Executive Summary

We are consolidating the sync layer from `src/lib/sync/*` into `oosync/src/sync/` to create a clean boundary between application code and the schema-agnostic sync infrastructure. This enables reusability and aligns with the long-term vision of extracting `oosync` as a standalone library (see `scratch.md`).

**Predecessor**: #357 (E2E lifecycle centralization) has been merged and provides a clean foundation for this work.

**Plan**: See [issue-358-sync-to-oosync-migration-plan.md](issue-358-sync-to-oosync-migration-plan.md) for detailed 6-phase implementation.

---

## What's Done

### #357: E2E Lifecycle Centralization (Merged)

- ✅ Created `e2e/helpers/local-db-lifecycle.ts` — canonical sync/reset helpers
- ✅ Added `public/e2e-origin.html` — same-origin static page for cleanup (avoids init/clear races)
- ✅ Refactored fixture teardown to use canonical cleanup
- ✅ Updated scenario helpers to call `resetLocalDbAndResync()` instead of scattered patterns
- ✅ E2E result: 552 passed / 60 skipped (no errors)

**Impact**: Eliminated "clearDb during initialization" race condition spam and improved E2E stability.

---

## What's Next (Issue #358)

### Migration: Move sync engine to oosync boundary

**Current state:**
```
src/lib/sync/
├── engine.ts
├── adapters/ (drizzle.ts, supabase.ts)
├── table-meta.ts
├── types.ts
└── utils.ts
```

**Target state:**
```
oosync/src/sync/                    ← moved here
├── engine.ts
├── adapters/
├── table-meta.ts
├── types.ts
└── utils.ts

src/lib/sync/index.ts               ← re-export layer (backward compat)
```

### Why

1. **Boundary clarity**: Sync is explicitly schema-agnostic and "outside" app
2. **Reusability**: Can be tested independently (no SolidJS context)
3. **Future packaging**: Aligns with "oosync as independent library" vision (scratch.md)
4. **No breaking changes**: Re-export layer maintains app API

---

## Architecture Context

### Sync Boundary Philosophy

Per `AGENTS.md` (global) + `oosync/AGENTS.md`:

- **Sync engine** (engine.ts, adapters, types) is **schema-agnostic** — works with any table/column meta
- **App code** (AuthContext, UI) uses sync but doesn't own it
- **Code generator** (oosync.codegen) produces table meta; sync consumes it

Moving sync to `oosync/` makes this boundary explicit.

### E2E Architecture (from #357)

```
Test Fixture Teardown
  → gotoE2eOrigin(page)          [navigate to /e2e-origin.html]
    → clearTunetreesClientStorage()  [delete IndexedDB, clear transient storage]
      → (app unloaded; IndexedDB clear is same-origin, fast, safe)
```

**Key result**: No more "clearDb during initialization" overlaps because the app is unloaded before clearing IndexedDB.

---

## File Map

### Key Directories

```
src/lib/sync/                      ← current (will be moved)
src/lib/auth/
src/lib/db/                        ← schema, client, init

oosync/                            ← schema-agnostic infrastructure
├── src/sync/                      ← will receive migrated files
├── src/index.ts                   ← public API (will export sync)
├── AGENTS.md                       ← schema-agnostic rules
└── oosync.codegen.config.json     ← code generator config

tests/lib/sync/                    ← unit tests (will need import updates)

e2e/helpers/local-db-lifecycle.ts  ← canonical sync/reset helpers (from #357)
e2e/helpers/test-fixture.ts        ← uses local-db-lifecycle (from #357)
```

### Import Patterns (Current)

```typescript
// App code
import { SyncEngine } from '@/lib/sync/engine';
import { waitForSyncComplete } from '@/e2e/helpers/local-db-lifecycle'; // for E2E only

// Test code
import { SyncEngine } from '@/lib/sync/engine';
```

### Import Patterns (Target)

```typescript
// App code (no change due to re-export)
import { SyncEngine } from '@/lib/sync/engine';  // still works (re-export from oosync)

// Test code (can update or keep re-export)
import { SyncEngine } from 'oosync/src/sync/engine';  // new path
// or keep old path via re-export layer
```

---

## Implementation Phases

See [issue-358-sync-to-oosync-migration-plan.md](issue-358-sync-to-oosync-migration-plan.md) for detailed checklist.

### Phase 1: Preparation
- Review current imports (`grep -r "from.*src/lib/sync" src/ tests/ e2e/`)
- Create `oosync/src/sync/` directory structure
- Check for env/config dependencies

### Phase 2: Move & Re-exports
- Move files from `src/lib/sync/` to `oosync/src/sync/`
- Fix internal imports within moved files
- Update `oosync/src/index.ts` to export sync API
- Create re-export layer at `src/lib/sync/index.ts`

### Phase 3: Update Imports
- App code: no changes (re-export handles it)
- Test code: update to `oosync/src/sync/*` (or keep re-export)
- Codegen scripts: verify paths

### Phase 4: TypeScript & Linting
- `npm run typecheck` – should pass
- `npm run lint` – should pass
- Update tsconfig aliases if needed

### Phase 5: Testing
- Unit tests: `npm run test` (focus on `tests/lib/sync/`)
- E2E tests: `npm run test:e2e` (should pass; inherits #357 cleanup)
- Manual: `npm run dev` + verify sync works

### Phase 6: Cleanup
- Delete old `src/lib/sync/` (after verification)
- Document re-export layer with TODO
- Update architecture docs

---

## Testing Strategy

### Unit Tests
- Location: `tests/lib/sync/`
- Current: Import from `@/lib/sync/engine`, etc.
- After: Update to `oosync/src/sync/engine` (or keep re-export)
- Command: `npm run test`

### E2E Tests
- Location: `e2e/tests/`
- Already set up: E2E helpers use canonical `local-db-lifecycle.ts` (from #357)
- No engine imports in tests themselves
- Command: `npm run test:e2e`
- Expected: All tests pass (inherit #357 cleanup fixes)

### Manual
- `npm run dev` – verify sync engine initializes normally
- Practice tab, add tunes, check sync works
- Browser DevTools: inspect IndexedDB (tunetrees-storage) before/after sync

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking imports | Re-export layer maintains backward compat |
| Circular deps | Check for cycles when moving (graph imports within sync/) |
| Missing env/config in new location | Verify no `import.meta.env` in moved files; or re-export from parent |
| Test failures due to paths | Run `npm run test` early and often |
| Codegen references old paths | Check `oosync.codegen.config.json` and any scripts |

---

## Success Criteria

- [ ] All sync files moved to `oosync/src/sync/`
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (unit tests)
- [ ] `npm run test:e2e` passes (E2E; inherits #357)
- [ ] No product UX changes
- [ ] Re-export layer documented with TODO

---

## Related Documents

- **Detailed Plan**: [issue-358-sync-to-oosync-migration-plan.md](issue-358-sync-to-oosync-migration-plan.md)
- **Long-term Vision**: `scratch.md` ("Sync as Independent Library")
- **Architecture**: `AGENTS.md` (global), `oosync/AGENTS.md`
- **E2E Setup**: `e2e/AGENTS.md`
- **Predecessor**: #357 (E2E lifecycle centralization — already merged)

---

## Quick Start

1. **Read the plan**: Open [issue-358-sync-to-oosync-migration-plan.md](issue-358-sync-to-oosync-migration-plan.md)
2. **Phase 1 – Preparation**: Run `grep -r "from.*src/lib/sync" src/ tests/ e2e/` to see import usage
3. **Phase 2 – Move**: Start moving files from `src/lib/sync/` to `oosync/src/sync/`
4. **Phase 3-4**: Update imports and run `npm run typecheck && npm run lint`
5. **Phase 5**: Run tests (`npm run test`, `npm run test:e2e`)
6. **Phase 6**: Delete old directory, document re-export layer, commit

---

## Notes for New Session

- This is a **well-defined, bounded refactor** with a clear plan
- **No new features** — purely structural reorganization
- **Re-export strategy** means you can do this incrementally without breaking anything
- **E2E tests are solid** from #357, so focus on unit tests for verification
- **Future**: Once stable, consider extracting `oosync/` as separate npm module

**Good luck! 🚀**
