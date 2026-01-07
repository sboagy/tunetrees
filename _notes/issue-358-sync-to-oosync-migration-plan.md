# Issue #358: Move src/lib/sync into oosync boundary

**Objective**: Consolidate the sync layer into the schema-agnostic `oosync/` module for cleaner separation of concerns and reusability.

**Related**: 
- #357: E2E lifecycle centralization (completed; provides foundation)
- `scratch.md`: Long-term vision for "oosync" as independent library

---

## Summary

Currently `src/lib/sync/*` mixes application and infrastructure concerns. Moving it into `oosync/src/sync/` makes the boundary explicit and enables future packaging as a standalone library (aligning with the "oosync" vision in scratch.md).

### What Gets Moved

```
src/lib/sync/
├── engine.ts              → oosync/src/sync/engine.ts
├── adapters/
│   ├── drizzle.ts        → oosync/src/sync/adapters/drizzle.ts
│   └── supabase.ts       → oosync/src/sync/adapters/supabase.ts
├── table-meta.ts         → oosync/src/sync/table-meta.ts
├── types.ts              → oosync/src/sync/types.ts
└── utils.ts              → oosync/src/sync/utils.ts
```

### What Gets Created

- `oosync/src/sync/` – New module directory
- `oosync/src/index.ts` – Updated with sync exports
- `src/lib/sync/index.ts` – Re-export layer (temporary; backward compat)

---

## Implementation Plan

### Phase 1: Preparation

- [ ] **Review current imports** in `src/lib/sync/` (document which app/test files depend on it)
  - Command: `grep -r "from.*src/lib/sync" src/ tests/ e2e/`
- [ ] **Create oosync/src/sync/ structure**
  - Create directory: `oosync/src/sync/adapters/`
- [ ] **Identify any env/config dependencies** (check if engine/adapters reference `import.meta.env`)
  - Ensure files can be moved without breaking due to Vite imports

### Phase 2: Move & Set Up Re-exports

- [ ] **Move files** from `src/lib/sync/` to `oosync/src/sync/`
  - Keep file contents unchanged (imports will be fixed in Phase 3)
- [ ] **Update internal imports** within moved files
  - Example: `import { SyncRow } from './types'` → `import { SyncRow } from '../types'`
  - Example: `import { drizzleAdapter } from './adapters/drizzle'` → `import { drizzleAdapter } from './adapters/drizzle'`
- [ ] **Update oosync/src/index.ts** to export sync API
  - ```ts
    export { SyncEngine } from './sync/engine';
    export * from './sync/adapters';
    export * from './sync/types';
    export * from './sync/utils';
    ```
- [ ] **Create re-export layer** at `src/lib/sync/index.ts`
  - ```ts
    // Temporary re-export layer for backward compat
    // TODO: Remove after all imports migrated to oosync
    export * from '../../oosync/src/sync';
    ```

### Phase 3: Update Imports

#### App Code
- [ ] Update imports in `src/lib/auth/AuthContext.tsx` (if it uses sync)
  - Option A: No change (if using re-export)
  - Option B: Update to `import { ... } from 'oosync'` (if oosync is packaged/aliased)

#### Test Code
- [ ] Update `tests/lib/sync/*.test.ts`
  - Change: `from '@/lib/sync/engine'` → `from 'oosync/src/sync/engine'`
  - Or: keep using re-export if simpler for now

#### Codegen Scripts
- [ ] Check `oosync.codegen.config.json` and codegen scripts
  - Verify they don't hardcode `src/lib/sync/` paths
  - Update if necessary

### Phase 4: TypeScript & Linting

- [ ] Run `npm run typecheck` – ensure no import/path errors
- [ ] Run `npm run lint` – ensure Biome is happy
- [ ] Update any tsconfig path aliases if needed (e.g., `paths: { '@sync/*': ['oosync/src/sync/*'] }`)

### Phase 5: Testing

- [ ] Run unit tests: `npm run test` (focus on `tests/lib/sync/`)
  - Should pass with new import paths
- [ ] Run E2E tests: `npm run test:e2e`
  - Should pass (inherits cleanup from #357)
- [ ] Local manual test: Confirm sync behavior in dev server (`npm run dev`)

### Phase 6: Cleanup & Documentation

- [ ] Delete old `src/lib/sync/` directory (once all imports verified)
- [ ] Add a note to `src/lib/sync/index.ts` explaining it's a temporary re-export layer
  - Include TODO: "Remove after all imports migrated to oosync"
- [ ] Update `AGENTS.md` if needed (clarify that sync is now in oosync)
- [ ] Update README or architecture docs to reflect new module layout

---

## Acceptance Criteria

- [ ] All sync files successfully moved to `oosync/src/sync/`
- [ ] App imports work (via re-export or direct oosync import)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (unit tests)
- [ ] `npm run test:e2e` passes (E2E; inherits from #357)
- [ ] No product UX changes
- [ ] Re-export layer documented with TODO for future removal

---

## Migration Strategy

### For App Code
**No immediate changes required** — re-export layer maintains compatibility.

### For Tests
**Update imports to `oosync/src/sync/*`** (or keep re-export for now).

### For Future
Once migration is solid:
- Remove re-export layer and update remaining imports
- Consider packaging `oosync/` as separate npm module (aligns with scratch.md vision)

---

## Notes

- **E2E already set up**: E2E helpers (`e2e/helpers/local-db-lifecycle.ts`) don't import engine directly; they use canonical sync wait/reset helpers (from #357). No E2E changes needed.
- **No breaking changes for users**: Re-export layer preserves API.
- **Future: separate package**: Once this move is stable, `oosync/` can be extracted and published as `@tunetrees/oosync` or similar.

---

## Related Context

- `scratch.md`: "Sync as Independent Library" — long-term vision for oosync
- `AGENTS.md` (global): Sync boundary principle
- `oosync/AGENTS.md`: Schema-agnostic rules for oosync code
- #357: E2E lifecycle centralization (predecessor; enables this move)

