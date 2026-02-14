# issue 412 (playlist -> repertoire) Playbook (Supervised, Low-Risk) (restart)

This plan addresses issue https://github.com/sboagy/tunetrees/issues/412 .  Please read this PR and review.  

This plan is a complete restart of PR 413, which is now closed, unmerged.

Goal: redo `playlist -> repertoire` as a controlled, mechanical rename with minimal behavior drift.

Strategy: 
* implement in supervised slices: schema/migrations → generated artifacts → runtime code → tests/E2E.
* Enforce strict scope per slice (“rename-only, no behavior changes”) and run checks after each slice.
* Each slice should be a commit once verified.

Clarifications:
1. We do not have to worry about local SQLite WASM backawards compatibility, since the app is not yet Alpha, and I'm the only user.  When we deploy to production, it's ok to start with fresh local storage and IndexedDB.
2. All e2e tests pass in this branch (though there are 4 flakes).  This work should only focus on renaming, and should not be doing any work to change logic, etc.  This should be a pure renaming refactor.
3. By the time the PR is done, "playlist" should be essentially non-existent in the repo, except in migrations and in historical documents in the `_notes` directory.
4. The oosync sublibrary currently has some direct references to the app or app semantics or structure, which is a bug which will be fixed in a future PR.  Try not to make this any worse.

## Work in supervised slices (stacked Commits)

### Slice A — Database rename foundation only
Scope:
- SQL migrations for table/column/view/function names
- Drizzle schema names
- Generated schema metadata regenerated

Checks:
```bash
npm run codegen:schema
npm run codegen:schema:check
npm run lint
```

Commit:
```bash
git add -A
git commit -m "rename playlist->repertoire in db schema/migrations/codegen"
```

### Slice B — Sync contract + worker only
Scope:
- `oosync` protocol/types
- worker filters/collections/field mapping
- no UI changes

Checks:
```bash
npm run lint
npm run test -- oosync
```

Commit:
```bash
git add -A
git commit -m "rename playlist->repertoire in sync contracts and worker"
```

### Slice C — App DB query/runtime layer only
Scope:
- `src/lib/db/**` query params, result fields, table refs
- no UI wording changes yet

Checks:
```bash
npm run lint
npm run test:unit
```

Commit:
```bash
git add -A
git commit -m "rename playlist->repertoire in app db/runtime queries"
```

### Slice D — UI/routes/type imports only
Scope:
- component props/state names
- route/query-param names
- remove deprecated aliases only if no callsites remain

Checks:
```bash
npm run lint
npm run test:unit
```

Commit:
```bash
git add -A
git commit -m "rename playlist->repertoire in UI/routes/types"
```

### Slice E — Tests + fixtures + E2E only
Scope:
- `tests/**`, `e2e/**`, test-api helpers, fixture constants/selectors
- keep test behavior equivalent unless required by rename

Checks:
```bash
npm run db:local:reset
npm run test:unit
npm run test:e2e
```

Commit:
```bash
git add -A
git commit -m "rename playlist->repertoire in tests and fixtures"
```

---

## 3) Guardrails to prevent scope drift

Run this before each commit to catch non-rename edits in staged hunks:

```bash
git diff --cached -U0 | rg -n -P '^[+-](?!\+\+\+|---)' | rg -vi 'playlist|repertoire'
```

Expected: mostly empty output. If non-empty, review each line and either:
- keep only if absolutely required for compile/runtime correctness, or
- revert that hunk to keep rename-only scope.

