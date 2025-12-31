# PR #354 — Follow-up Packaging Plan (Option A)

**Prerequisite:** Complete Phase 1.5 schema-agnostic isolation first.

- See: `_notes/pr2-i338-phase-1.5-schema-agnostic-oosync-plan.md`

**Goal (this doc):** After `oosync` no longer references any TuneTrees schema/tables, eliminate worker-bundled relative imports and enforce canonical imports by making `oosync` a real package artifact that Wrangler can resolve at bundle time.

This is a follow-up PR to PR #354, but it should happen **after** schema-agnostic isolation.

## Background / Current Limitation

- The worker implementation lives under `oosync/worker/*` and is bundled by Wrangler (esbuild).
- Wrangler/esbuild does not honor TypeScript `compilerOptions.paths` for module resolution.
- As a result, worker-bundled code currently uses **relative imports** into `oosync/src/*` and `shared/generated/*`.

## Desired End State

- Worker-bundled code imports runtime/protocol via a real package import (no TS `paths` reliance at bundle time).
- TuneTrees schema/meta lives in a separate module/package and is imported by app/worker (not by `oosync`).
- No worker-bundled file imports `../../src/...` or `../../../shared/generated/...`.
- Root app/tooling continues to use TS aliases, but worker bundling no longer depends on TS alias support.

## Approach (Option A): Build `oosync` into a package and import it as a normal dependency

### 1) Introduce a package for `oosync`
- Add `oosync/package.json` with:
  - `name`: `@tunetrees/oosync` (or `@oosync/oosync` if you prefer; pick one and stick to it)
  - `type`: `module`
  - `exports`: map to built outputs (see below)
  - `files`: include `dist/**`

### 2) Build outputs
- Add `oosync/tsconfig.json` (composite or standalone) that builds:
  - `oosync/src/**` → `oosync/dist/**`
- Ensure outputs preserve subpath structure needed for `exports`:
  - `dist/index.js` / `dist/index.d.ts`
  - `dist/shared/protocol/index.js` / types
  - `dist/shared/table-meta.js` / types
  - `dist/runtime/platform/types.js` / types

### 3) Wire root tooling to build `oosync`
- Add root npm scripts:
  - `oosync:build`: `tsc -p oosync/tsconfig.json`
  - `oosync:clean`: remove `oosync/dist`
- Update root `build` / `typecheck` flow if needed so CI builds `oosync` before bundling worker.

### 4) Package the TuneTrees schema/meta separately from `oosync`
Once schema is injected (Phase 1.5 prerequisite), keep `oosync` and schema/meta as separate artifacts.

Pick one of these:

**A1 (preferred): create a small TuneTrees schema package**
- Example name: `@tunetrees/sync-schema`.
- Exports an implementation of the `ISyncSchemaDescription` interface.

**A2: keep schema/meta repo-local but still package-like for Wrangler**
- Add a minimal package boundary around the generated schema/meta folder so Wrangler can resolve it without TS `paths`.

### 5) Update worker to import package paths
- Replace worker-bundled relative imports with package imports.
  - Example: `import { getBooleanColumns } from "@tunetrees/oosync/shared/table-meta";`
- Confirm worker wrapper still remains thin.

### 6) Keep app imports stable
- App continues to import `oosync` via TS alias or real package name.
- App/worker import TuneTrees schema/meta from the separate schema module/package.

## Implementation Steps (PR Checklist)

1. Add `oosync/package.json` + `oosync/tsconfig.json` and build output directory `oosync/dist/`.
2. Add root scripts to build `oosync`.
3. Decide how TuneTrees schema/meta is packaged (A1 vs A2).
4. Switch worker-bundled imports to package imports (no relative imports).
5. Update CI/build scripts so worker build runs after `oosync` build.
6. Verify:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `npx wrangler build --cwd worker` (and `npm --prefix worker run dev` smoke)

## Risks / Notes

- Need to choose and standardize the package name (`@tunetrees/oosync` vs `@oosync/*`).
- Worker bundling must resolve the package from a real `node_modules` location:
  - either via workspace install (npm workspaces) or `file:` dependency in `worker/package.json`.
- If we choose npm workspaces, ensure it doesn’t violate the “no monorepo toolchain” constraint (can still be minimal).

## Definition of Done

- Worker-bundled code contains **no** relative imports into `oosync/src/*`.
- Worker-bundled code resolves TuneTrees schema/meta via a package/module boundary (no relative import coupling).
- Worker uses canonical imports.
- All existing verification commands remain green.
