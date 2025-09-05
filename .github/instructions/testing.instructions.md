---
description: "Playwright and unit test instructions for TuneTrees frontend tests"
applyTo: "frontend/tests/**/*.spec.ts"
---

# Playwright Test Guidelines (TuneTrees)

This document describes the standard structure and expectations for Playwright integration tests in this repository. Additions are encouraged but changes should be minimal and consistent across tests.

## Golden rules

- Tests must be deterministic and isolated.
- Use the shared test-scripts helpers for setup, storage state, network throttling and logging.
- Do not rely on tests running against a developer machine or an external local server. Tests should reset/seed the DB using the provided helpers.

## Required per-test boilerplate

Every Playwright spec should include the following boilerplate unless a test explicitly documents a reason not to (for example, login/signup tests):

```ts
test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await page.waitForTimeout(1_000);
  await restartBackend();
  await page.waitForTimeout(1_000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});
```

- `getStorageState("STORAGE_STATE_TEST1")` is the default stable storage state for tests that require an authenticated session. Tests that exercise login/signup flows should _not_ pre-set storageState.
- `restartBackend()` should revert the database to a known clean test state. See `test-scripts/setup-database.ts` for seeding and schema details.
- `setTestDefaults()` sets common viewport, timeouts, and feature flags used by the app; `applyNetworkThrottle()` simulates a realistic network.

## Test structure & best practices

- Prefer non-flaky selectors with `data-testid` where possible.
- Keep interactions minimal and assert on observable behavior and network calls where relevant.
- If a test depends on a new helper script, add it under `frontend/test-scripts/` and update this file to reference it.

## Skipping vs failing

- Tests may use `test.skip()` for genuine, temporary skips with a short comment explaining why.
- Avoid silent skips. Prefer failing loudly when a required environment variable is missing or misconfigured.

## Smoke state (future)

- A lightweight `STORAGE_STATE_SMOKE` may be added later for faster local iteration. Until then, use `STORAGE_STATE_TEST1`.

## Adding new tests

1. Copy an existing spec and apply the boilerplate above.
2. Use `data-testid` for new components if interaction is required.
3. Add or update helper scripts under `frontend/test-scripts/` when necessary.
4. Run `npm run test:ui:single path/to/spec` locally before opening a PR.

---

If you'd like me to add examples, a checklist for PRs that add tests, or an automated CI job that validates the boilerplate, tell me which and I will add it.
