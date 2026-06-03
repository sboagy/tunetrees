# Instructions

- Following Playwright test regressed, caused by the current changes.
- Explain why, be concise, respect Playwright best practices.
- Make the fix, if possible.

# Test info

- Name: tests/annotations-filter-001-rpc-genre-sync.spec.ts >> ANNOTATIONS-FILTER-001: RPC-Based Genre Filtering >> D: Private tunes sync annotations regardless of genre filter
- Location: e2e/tests/annotations-filter-001-rpc-genre-sync.spec.ts:362:3

# Error details

```
Error: page.evaluate: DrizzleError: Failed to run the query '
          INSERT INTO tune (
            id,
            title,
            genre,
            private_for,
            deleted,
            sync_version,
            last_modified_at
          ) VALUES (
            ?,
            ?,
            ?,
            ?,
            0,
            1,
            ?
          )
        '
    at SQLJsSession.run (http://localhost:5173/node_modules/.vite/deps/sqlite-core-BgDwAOw8.js?v=73196bbf:2842:10)
    at BaseSQLiteDatabase.run (http://localhost:5173/node_modules/.vite/deps/sqlite-core-BgDwAOw8.js?v=73196bbf:2670:23)
    at Object.findOrCreatePrivateTune (http://localhost:5173/src/test/test-api.ts:829:8)
    at async eval (eval at evaluate (:302:30), <anonymous>:4:14)
    at async <anonymous>:328:30
```

# Page snapshot

```yaml
- main [ref=e2]:
  - heading "TuneTrees E2E Origin" [level=1] [ref=e3]
  - paragraph [ref=e4]: This page exists to give Playwright a same-origin context for clearing storage without booting the app.
```