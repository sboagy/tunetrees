# End-to-End (E2E) Tests

This directory contains Playwright end-to-end tests for TuneTrees.

## Layout

- `e2e/tests/` — Test specs (`*.spec.ts`)
- `e2e/setup/` — One-time setup (auth bootstrap, etc.)
- `e2e/helpers/` — Deterministic setup helpers (Supabase cleanup/seed, sync waits)
- `e2e/page-objects/` — Page objects for stable locators and actions
- `e2e/.auth/` — Auth state (gitignored)

See `e2e/AGENTS.md` for conventions (parallel safety, no conditionals, generous timeouts).

## Running

From the repo root:

- `npm run db:local:reset`
- `npm run test:e2e` (headless)
- `npm run test:e2e:headed` (headed)
- `npm run test:e2e:debug` (Playwright inspector)

E2E tests require the dev server running (see `docs/development/setup.md`).

## Debugging test setup

### `E2E_TEST_SETUP_DEBUG`

When set, some helpers (notably `e2e/helpers/practice-scenarios.ts`) will print additional browser console output during deterministic setup.

Examples:

```bash
E2E_TEST_SETUP_DEBUG=true npm run test:e2e
# or
E2E_TEST_SETUP_DEBUG=1 npm run test:e2e:headed
```

This flag is intended to help diagnose test setup issues (sync timing, missing seed data, unexpected console errors) without changing test logic.

## Sync error enforcement

App tests use `helpers/test-fixture.ts` (authenticated) or `helpers/sync-test.ts`
(anonymous/custom authentication). Both automatically enforce backend/sync health
before the browser or local database is cleaned up.

Unexpected backend transport failures, HTTP 5xx responses, rejected sync responses,
and sync subsystem error logs must recover within 30 seconds of the first failure.
For a failed request, recovery requires a successful later request to the same
endpoint and a new successful application sync completion on the same page. An
empty outbox, an old success flag, or another page/test's success is insufficient.
The guard observes application retries; it does not silently force a sync to make
the test pass. `waitForSync` also requires a successful, error-free status before
accepting an empty outbox.

Intentional failures need explicit, scoped exceptions:

- Use `goOffline` / `goOnline`, or `setOfflineForTest(context, boolean)`, for offline
  phases. The exception ends when the test restores connectivity.
- For a blocked endpoint, call `expectSyncFailures(context, reason, paths)` before
  blocking it. Call the returned end function when the failure phase ends. Exact
  paths (such as `/api/sync`) or backend directory prefixes ending in `/` are
  supported. Do not exempt an entire test when only one phase needs the exception.
- Local durability tests that intentionally block sync through the end of the test
  declare that explicitly. Their exception does not cover other endpoints or
  unrelated database errors.

The guard's contract is exercised by `sync-guard-001-enforcement.spec.ts` with
mocked HTTP, and by `tests/helpers/sync-error-ledger.test.ts`. The contract tests
intentionally use raw Playwright so they can assert that enforcement rejects a
failure without making the contract test itself fail.

Teardown also waits for in-flight backend requests and response inspection within
its bounded deadline, so a late 503 cannot arrive after enforcement stops. An
exception opened during a request is retained on that request even if its failure
is reported after reconnect. Delayed transport summaries are matched to recorded
expected failures rather than exempted by a time window. Recovery requires a
finished retry and a new transport-result version (`data-sync-result-version`).
The provider publishes that result synchronously before asynchronous reconciliation;
a delayed UI refresh or a transition to idle cannot impersonate another completion.
