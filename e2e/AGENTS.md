# e2e/AGENTS Instructions

Scope: Playwright end-to-end tests under `e2e/**`. Complements root `AGENTS.md` and unit guidance in `tests/AGENTS.md`.

## Philosophy

1. Single input state per test; no conditional branches.
2. Timing resilience: explicit generous timeouts; leverage auto-wait.
3. DRY: use page objects (`page-objects/`) and helpers (`helpers/`).
4. Parallel safety: dedicated per-worker users; deterministic setup.

## Projects & Fixtures

- `setup`: Auth bootstrap (`setup/auth.setup.ts`).
- Browsers: `chromium`, `firefox`, `webkit`, `Mobile Chrome`.
- Fixture: `helpers/test-fixture.ts` provides `test` + `testUser` and ties into per-worker credentials (see `helpers/test-users.ts`).

## Standard Template

```ts
import { expect } from '@playwright/test';
import { setupDeterministicTestParallel } from '../helpers/practice-scenarios';
import { test } from '../helpers/test-fixture';
import { TuneTreesPage } from '../page-objects/TuneTreesPage';

let ttPage: TuneTreesPage;

test.describe('FEATURE-XXX: Suite Name', () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
  });

  test('should perform expected action', async ({ page }) => {
    await ttPage.practiceTab.click();
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });
  });
});
```

`setupDeterministicTestParallel` is the most basic of setup functions.  However, there is also `setupForPracticeTestsParallel`, `setupForRepertoireTestsParallel`, and `setupForCatalogTestsParallel` in `e2e/helpers/practice-scenarios.ts`, which may be used instead of `setupDeterministicTestParallel`.  Additional "setupXXXX" functions may be generated as needed.

## Critical Rules

- Assertions use explicit timeouts (≥ 10s for visibility).
- After mutations: `await page.waitForLoadState('networkidle', { timeout: 15000 })` before success assertions.
- Selectors priority: `data-testid` > role+name > text (assertions) > CSS (last resort).
- Provide stable `data-testid` from UI (see `src/AGENTS.md`).

## File Conventions

- Path: `e2e/tests/<feature>-<seq>-<description>.spec.ts`.
- Include JSDoc header with feature ID + priority.
- Use `page-objects/TuneTreesPage.ts` for locators; extend as needed.

## Running & Debugging

```bash
npm run db:local:reset
npm run test:e2e            # headless
npm run test:e2e:headed     # headed
npm run test:e2e:debug      # inspector
npm run test:e2e:report     # HTML report
```

- CI auto-seeds DB, runs with retries/workers per `playwright.config.ts`.
- Artifacts (report, screenshots, videos) stored under `playwright-report/` and CI artifacts.

## Test Data & Auth

- Per-worker users: bob, alice, dave, eve, frank, grace, henry, iris (see `helpers/test-users.ts`).
- Auth JSON kept in `e2e/.auth/` (gitignored); regenerate via `db:local:reset` if expired.

## Common Pitfalls (Avoid)

- Branching in tests; split scenarios instead.
- Using fragile text selectors for actions.
- Fixed `waitForTimeout` instead of auto-wait (allowed only for animations).

## References

- Root policies: `AGENTS.md`
- UI testability and IDs: `src/AGENTS.md`
- Helpers and page objects: `e2e/helpers/*`, `e2e/page-objects/*`

---
Keep this file focused on Playwright structure, resilience, and conventions.
