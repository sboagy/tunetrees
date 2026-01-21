# Plugin extensibility handoff (QuickJS + CodeMirror)

## Context
This handoff captures where the PR left off so local Copilot can continue implementation.

## Completed work (commit 6d80d64)
- Added Supabase migration: `supabase/migrations/20260120220000_add_plugins.sql`
  - New `plugin` table with `is_public`, `enabled`, `capabilities` (text JSON), `script`, sync fields.
  - RLS policies allow **public** or **owned** reads, owned writes.
- Added SQLite migration: `drizzle/migrations/sqlite/0009_add_plugins.sql`.
- Wired migration into `src/lib/db/client-sqlite.ts` and bumped `CURRENT_DB_VERSION` to 8.
- Added `tableToSchemaKeyOverrides.plugin` in `oosync.codegen.config.json` (for codegen).

## Known issues
- `npx supabase start` failed locally in this environment (docker/supabase error during startup). Codegen not run yet.
- `npm run lint` fails due to unrelated existing warnings/errors (pre-existing).

## Open design items to handle locally
1) **Public plugins + sync**
   - Sync engine currently filters pull by user ownership (user_ref). Public rows won’t sync to other users.
   - Options:
     - Change plugin model to allow `user_ref` NULL for public rows, then use the existing `orNullEqUserId` pull rule.
     - Or add a new pull rule in worker sync schema to include `is_public = true OR user_ref = auth.uid()`.
   - Update worker pull config in `oosync.codegen.config.json` + worker logic if needed.

2) **Open proxy policy**
   - Need an open proxy endpoint (random URLs) with:
     - timeout + max response size
     - admin blacklist (env-based?)
   - Existing proxy at `functions/api/proxy/thesession.ts` is host-restricted; new generic proxy required.

## Next steps (suggested order)
1. **Bring up local Supabase**
   - `npx supabase start`
   - If it fails, rerun with `--debug` or restart Docker.
   - Apply migrations: `supabase db reset`.

2. **Regenerate sync artifacts**
   - `npm run codegen:schema`
   - Verify generated files include `plugin` in:
     - `shared/generated/sync/table-meta.generated.ts`
     - `shared/table-meta.ts`
     - `worker/src/generated/schema-postgres.generated.ts`
     - `drizzle/schema-sqlite.generated.ts`

3. **Add QuickJS + CodeMirror deps**
   - Likely: `quickjs-emscripten`, `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark` (or similar).
   - **Run gh-advisory-database** check before adding deps (required by copilot rules).

4. **Plugin runtime (worker sandbox)**
   - Create `src/lib/plugins/quickjs-worker.ts` + a host wrapper.
   - Dynamic import QuickJS and run scripts in a Web Worker.
   - Expose functions: `parseImport(payload, meta)` and `scheduleGoal(input)`.
   - Inject safe helpers (`fetchUrl`, `parseCsv`, `parseJson`, log).

5. **Open proxy function**
   - Add `/functions/api/proxy/index.ts` or similar.
   - Enforce:
     - timeout (e.g., 10s)
     - max size (e.g., 2–5MB)
     - blacklist from env (comma list)

6. **Plugins UI (settings tab)**
   - Add `/user-settings/plugins` tab in settings dialog.
   - Dynamic import CodeMirror + QuickJS on this route only.
   - CRUD UI + template script + test-runner.

7. **Integrations**
   - Import flow: add a plugin option in `AddTuneDialog`.
   - Scheduling: integrate plugin into `evaluatePractice` (return same `NextReviewSchedule` shape or convert from plugin output).

8. **Docs**
   - Add migration steps & plugin usage notes.

## Files touched so far
- `supabase/migrations/20260120220000_add_plugins.sql`
- `drizzle/migrations/sqlite/0009_add_plugins.sql`
- `src/lib/db/client-sqlite.ts`
- `oosync.codegen.config.json`
