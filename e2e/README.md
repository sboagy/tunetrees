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
