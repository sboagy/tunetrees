---
description: "Playwright and unit test instructions for TuneTrees frontend tests"
applyTo: "frontend/tests/**/*.spec.ts"
---

# Playwright Test Guidelines (TuneTrees)

This document describes the standard structure and expectations for Playwright integration tests in this repository. Additions are encouraged but changes should be minimal and consistent across tests.

## Testing Philosophy

- **User-Centric**: Tests should be written from the user's perspective, focusing on the most important user journeys.
- **Fast Feedback**: Aim for quick test execution to provide rapid feedback to developers.
- **Maintainability**: Write tests that are easy to understand and maintain, with clear structure and naming.

## Golden rules

- Tests must be deterministic and isolated.
- Use the shared test-scripts helpers for setup, storage state, network throttling and logging.
- Do not rely on tests running against a developer machine or an external local server. Tests should reset/seed the DB using the provided helpers.

### Testing Strategy

- **Backend**: pytest in `tests/` directory with GitHub Actions CI
- **Frontend**: Playwright E2E tests in `frontend/tests/` with GitHub Actions CI
- **CI**: Automated testing on push/PR via GitHub Actions

## Playwright File Naming & Location

- Place tests in `frontend/tests/` or subdirectories.
- Use `.spec.ts` suffix for test files (e.g. `example.spec.ts`).
- Test files must be prefixed with "test-"
- Group related tests in the same file or subdirectory.
- Page Object files should go in `frontend/test-scripts/` with `.po.ts` suffix.
- Helper scripts should go in `frontend/test-scripts/` with `.ts` suffix.

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

## Adding New Tests: Checklist

When creating new tests, ensure:

- [ ] Uses `getStorageState("STORAGE_STATE_TEST1")` for authentication
- [ ] Includes proper logging in beforeEach/afterEach
- [ ] Uses `TuneTreesPageObject` or `TuneEditorPageObject`
- [ ] Calls `ttPO.gotoMainPage()` first
- [ ] Uses existing Page Object locators when possible
- [ ] Adds new locators to Page Objects if needed (with proper TypeScript types)
- [ ] **Adds `data-testid` attributes to new UI elements** (recommended for reliability)
- [ ] **Uses `data-testid` selectors via `page.getByTestId()` for new elements** (preferred approach)
- [ ] Includes proper error handling and timeouts
- [ ] Follows DRY principles (no repeated selectors)
- [ ] Includes meaningful console.log statements for debugging

## Defensive Testing

```typescript
// Always check visibility before interaction
const element = ttPO.sortButton;
if (await element.isVisible()) {
  await element.click();
} else {
  console.log("Element not visible, taking alternative action");
}

// Use proper timeouts
await expect(ttPO.tunesGrid).toBeVisible({ timeout: 15000 });
```

## Debugging Output

```typescript
// Use console.log for debugging
console.log("Current URL:", page.url());
console.log("Element count:", await ttPO.tunesGridRows.count());

// Take screenshots for debugging
await page.screenshot({ path: "debug-screenshot.png" });
```

## Test Data and State Management\*\*

**Database State**: Tests automatically use clean database via `restartBackend()`

**Test Isolation**: Each test starts with fresh backend state

**Storage State**: Authentication persists across tests in same file

## Performance and Reliability

**Timeouts**: Use appropriate timeouts based on operation:

- Page loads: 15-30 seconds
- Element visibility: 5-10 seconds
- Quick actions: 1-2 seconds

**Wait Strategies**

```typescript
// Preferred: Wait for specific conditions
await expect(ttPO.tunesGrid).toBeVisible();

// Avoid: Fixed timeouts unless necessary
await page.waitForTimeout(500); // Only for animations/transitions
```
