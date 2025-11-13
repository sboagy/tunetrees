````instructions
---
description: "Playwright E2E test instructions for TuneTrees SolidJS PWA"
applyTo: "e2e/tests/**/*.spec.ts"
---

# Playwright E2E Test Guidelines (TuneTrees PWA)

This document defines the standard structure and expectations for Playwright E2E tests in the TuneTrees SolidJS PWA. All tests must follow these guidelines for consistency, reliability, and maintainability.

## Core Testing Philosophy

1. **Single Input State**: Tests must have ONE clear input state. No conditional branches in test code.
2. **Resilience First**: Tests must be extremely resilient to timing issues, especially in CI/CD (GitHub Actions).
3. **DRY Principles**: Leverage shared page objects (`e2e/page-objects/TuneTreesPage.ts`) and helpers (`e2e/helpers/practice-scenarios.ts`).
4. **Emulate Existing Patterns**: Follow established test structure (see `e2e/tests/topnav-001-playlist-dropdown.spec.ts`).
5. **PR Validation**: All new tests must pass in PR before merge.

## Testing Stack

- **Framework**: Playwright (E2E browser testing)
- **Database**: Supabase PostgreSQL (local via Docker)
- **Storage**: SQLite WASM (browser-based, syncs with Supabase)
- **CI/CD**: GitHub Actions with automatic database seeding
- **Test Users**: Parallel-safe dedicated test accounts (alice, bob, charlie)

## Test File Structure

### File Naming & Location

- **Location**: `e2e/tests/` or subdirectories
- **Naming**: `<feature>-<number>-<description>.spec.ts` (e.g., `topnav-001-playlist-dropdown.spec.ts`)
- **Page Objects**: `e2e/page-objects/` with `.ts` suffix (e.g., `TuneTreesPage.ts`)
- **Helpers**: `e2e/helpers/` with `.ts` suffix (e.g., `practice-scenarios.ts`, `test-fixture.ts`)
- **Auth Files**: `e2e/.auth/*.json` (auto-generated, gitignored)

### Standard Test Template

```typescript
import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * FEATURE-NNN: Test Suite Title
 * Priority: Critical/High/Medium/Low
 *
 * Brief description of what this test suite validates.
 */

let ttPage: TuneTreesPage;
let currentTestUser: TestUser;

test.describe("FEATURE-NNN: Test Suite Name", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    // Set up clean test state
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [], // Or specific tune IDs
    });
  });

  test("should perform specific user action", async ({ page }) => {
    // ARRANGE: Navigate to feature
    await ttPage.practiceTab.click();
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });

    // ACT: Perform user action
    await ttPage.submitEvaluationsButton.click();

    // ASSERT: Verify expected outcome
    await expect(page.getByText(/Success/i)).toBeVisible({ timeout: 5000 });
  });
});
```

## Critical Rules

### 1. Single Input State - NO BRANCHING

❌ **WRONG:**
```typescript
test("conditionally checks state", async ({ page }) => {
  if (await element.isVisible()) {
    await element.click(); // BRANCHING - DON'T DO THIS
  } else {
    await otherElement.click();
  }
});
```

✅ **CORRECT:**
```typescript
test("element is visible and clickable", async ({ page }) => {
  await expect(element).toBeVisible(); // Assert state first
  await element.click(); // Then act
});

test("other element is visible and clickable", async ({ page }) => {
  await expect(otherElement).toBeVisible();
  await otherElement.click();
});
```

### 2. Timing Resilience

Always use Playwright's auto-waiting features with generous timeouts:

```typescript
// ✅ GOOD: Explicit timeout, auto-retry
await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });

// ✅ GOOD: Wait for network idle after mutations
await page.waitForLoadState("networkidle", { timeout: 15000 });

// ⚠️  USE SPARINGLY: Fixed waits (only for animations)
await page.waitForTimeout(500);

// ❌ BAD: No timeout, will flake
await expect(element).toBeVisible();
```

### 3. DRY Principles - Use Page Objects

❌ **WRONG:**
```typescript
test("test 1", async ({ page }) => {
  await page.getByTestId("submit-button").click();
});

test("test 2", async ({ page }) => {
  await page.getByTestId("submit-button").click(); // DUPLICATED
});
```

✅ **CORRECT:**
```typescript
// In e2e/page-objects/TuneTreesPage.ts
readonly submitEvaluationsButton: Locator;

constructor(page: Page) {
  this.submitEvaluationsButton = page.getByTestId("submit-evaluations-button");
}

// In test
test("test 1", async ({ page }) => {
  await ttPage.submitEvaluationsButton.click();
});
```

### 4. Use Test Fixture for Parallel Safety

The `test` fixture from `e2e/helpers/test-fixture.ts` automatically assigns dedicated test users to each worker:

```typescript
import { test } from "../helpers/test-fixture";

test.describe("My Test Suite", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // testUser is automatically assigned based on worker index
    // Worker 0 gets bob, Worker 1 gets alice, Worker 2 gets dave, etc.
    console.log(`Testing with ${testUser.email}`);
    
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
  });

  test("performs action", async ({ page, testUser }) => {
    // testUser is available in every test
    expect(testUser.email).toMatch(/@tunetrees\.test$/);
  });
});
```

## Test Data Management

### Test Users (Parallel-Safe)

Eight dedicated test users support parallel execution (up to 8 workers):

| User  | Email                     | Password           | Worker Index | Purpose                           |
| ----- | ------------------------- | ------------------ | ------------ | --------------------------------- |
| Bob   | bob.test@tunetrees.test   | TestPassword123!   | 0            | Primary test user                 |
| Alice | alice.test@tunetrees.test | TestPassword123!   | 1            | Secondary test user               |
| Dave  | dave.test@tunetrees.test  | TestPassword123!   | 2            | Multi-user scenario testing       |
| Eve   | eve.test@tunetrees.test   | TestPassword123!   | 3            | Concurrent operation testing      |
| Frank | frank.test@tunetrees.test | TestPassword123!   | 4            | Edge case testing                 |
| Grace | grace.test@tunetrees.test | TestPassword123!   | 5            | Data isolation testing            |
| Henry | henry.test@tunetrees.test | TestPassword123!   | 6            | Performance testing               |
| Iris  | iris.test@tunetrees.test  | TestPassword123!   | 7            | Stress testing, empty state cases |

### Database State

Each test should start with a clean, predictable state:

```typescript
test.beforeEach(async ({ page, testUser }) => {
  // Option 1: Clear repertoire (most tests)
  await setupDeterministicTestParallel(page, testUser, {
    clearRepertoire: true,
    seedRepertoire: [],
  });

  // Option 2: Seed specific tunes
  await setupDeterministicTestParallel(page, testUser, {
    clearRepertoire: true,
    seedRepertoire: ["tune-id-1", "tune-id-2"],
  });

  // Option 3: Keep existing state (rare)
  await setupDeterministicTestParallel(page, testUser, {
    clearRepertoire: false,
    seedRepertoire: [],
  });
});
```

### Auth State

Auth files are auto-generated and managed:

- **Location**: `e2e/.auth/alice.json`, `e2e/.auth/bob.json`, `e2e/.auth/charlie.json`
- **Regeneration**: Run `npm run db:local:reset` if auth expires
- **Lifetime**: 7 days (10080 minutes)
- **CI**: Always fresh (generated per workflow run)

## Page Object Pattern

### Using TuneTreesPage

```typescript
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

let ttPage: TuneTreesPage;

test.beforeEach(async ({ page, testUser }) => {
  ttPage = new TuneTreesPage(page);
});

test("navigates between tabs", async ({ page }) => {
  // Use page object locators
  await ttPage.catalogTab.click();
  await expect(ttPage.catalogGrid).toBeVisible();

  await ttPage.repertoireTab.click();
  await expect(ttPage.repertoireGrid).toBeVisible();
});
```

### Adding New Locators

When adding new UI elements, update the page object:

```typescript
// 1. Add data-testid to component (REQUIRED)
<button data-testid="my-new-button">Click Me</button>

// 2. Add locator to TuneTreesPage.ts
readonly myNewButton: Locator;

constructor(page: Page) {
  this.myNewButton = page.getByTestId("my-new-button");
}

// 3. Use in tests
await ttPage.myNewButton.click();
```

## Running Tests

### Local Development

```bash
# Reset database and regenerate auth (do this first!)
npm run db:local:reset

# Start dev server (required)
npm run dev

# Run all tests (headless)
npm run test:e2e

# Run all tests (headed - see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test e2e/tests/topnav-001-playlist-dropdown.spec.ts

# Run specific test by name
npx playwright test -g "should display default selected playlist"

# Debug mode (step through)
npm run test:e2e:debug

# UI mode (interactive explorer)
npm run test:e2e:ui

# Generate HTML report
npm run test:e2e:report
```

### CI/CD (GitHub Actions)

Tests run automatically on:
- Push to `main` or `feat/pwa1` branches
- Pull requests targeting `main`

**What CI Does:**
1. Checks out code
2. Installs dependencies
3. Starts Supabase (Docker PostgreSQL)
4. Resets database with `supabase/seed.sql`
5. Installs Playwright browsers
6. Builds application
7. Starts dev server
8. Runs all tests in parallel (3 workers)
9. Uploads artifacts (reports, screenshots, videos)

**Artifacts** (downloadable from GitHub Actions):
- Playwright HTML Report (30 days retention)
- Test Screenshots/Videos (7 days retention)

## Debugging

### Local Debugging

```bash
# Visual debugging with Playwright Inspector
npm run test:e2e:debug

# Run with console logs
DEBUG=pw:api npx playwright test

# Generate trace for specific test
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### CI Debugging

1. Go to GitHub Actions tab
2. Click failed workflow run
3. Download "playwright-report" or "test-results" artifacts
4. Open `index.html` in downloaded report
5. View screenshots/videos of failures

### Common Issues

**"Loading practice queue..." stuck:**
- Check: Is `initialSyncComplete()` signal working?
- Fix: Add logging in `AuthContext.tsx` onSyncComplete callback

**Flaky test in CI:**
- Check: Are timeouts long enough? (10s minimum for visibility checks)
- Fix: Increase timeout or add `waitForLoadState("networkidle")`

**Auth expired error:**
- Check: Are auth files fresh?
- Fix: Run `npm run db:local:reset`

**Test passes locally but fails in CI:**
- Check: Timing-dependent assertions?
- Fix: Add explicit waits, increase timeouts

## Best Practices

### Selector Strategy (Priority Order)

1. **data-testid** (most reliable):
   ```typescript
   page.getByTestId("submit-evaluations-button")
   ```

2. **Role + Name** (semantic):
   ```typescript
   page.getByRole("button", { name: /Submit/i })
   ```

3. **Text** (fragile, avoid for actions):
   ```typescript
   page.getByText(/Loading/i) // OK for assertions only
   ```

4. **CSS/XPath** (last resort):
   ```typescript
   page.locator(".submit-button") // Avoid if possible
   ```

### Assertions

```typescript
// ✅ GOOD: Specific, with timeout
await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });
await expect(page.getByText(/Success/i)).toBeVisible({ timeout: 5000 });

// ✅ GOOD: Count assertions
await expect(ttPage.practiceGrid.locator("tr")).toHaveCount(5, { timeout: 5000 });

// ⚠️  OK: Text content (can be fragile)
await expect(ttPage.evaluationsCount).toHaveText("3");

// ❌ BAD: No timeout
await expect(element).toBeVisible();
```

### Network Waits

```typescript
// ✅ GOOD: Wait for mutations to complete
await ttPage.submitEvaluationsButton.click();
await page.waitForLoadState("networkidle", { timeout: 15000 });
await expect(page.getByText(/Success/i)).toBeVisible();

// ✅ GOOD: Wait for specific request
const responsePromise = page.waitForResponse(/api\/practice/);
await ttPage.submitEvaluationsButton.click();
await responsePromise;
```

## Adding New Tests

### Checklist

- [ ] Test file named `<feature>-<number>-<description>.spec.ts`
- [ ] Uses `test` fixture from `e2e/helpers/test-fixture.ts`
- [ ] Includes `test.beforeEach` with `setupDeterministicTestParallel`
- [ ] Uses `TuneTreesPage` page object
- [ ] No conditional branches (single input state)
- [ ] All timeouts explicitly set (10s+ for visibility)
- [ ] Uses `data-testid` selectors via page object
- [ ] Follows DRY principles (no duplicate selectors)
- [ ] Includes JSDoc comment with feature ID and priority
- [ ] Passes locally in headed mode
- [ ] Passes in CI (PR validation)

### Example New Test

```typescript
import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * PRACTICE-042: Submit Evaluations Workflow
 * Priority: Critical
 *
 * Tests that users can submit practice evaluations and see success confirmation.
 */

let ttPage: TuneTreesPage;
let currentTestUser: TestUser;

test.describe("PRACTICE-042: Submit Evaluations", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: ["tune-1", "tune-2", "tune-3"],
    });
  });

  test("should submit evaluations successfully", async ({ page }) => {
    // Navigate to practice tab
    await ttPage.practiceTab.click();
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });

    // Wait for queue to load
    await expect(ttPage.practiceGrid.locator("tr")).toHaveCount(3, {
      timeout: 10000,
    });

    // Set evaluations (implementation depends on UI)
    // ... interaction steps ...

    // Submit evaluations
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify success message
    await expect(page.getByText(/Successfully submitted/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
```

## Resources

- **Playwright Docs**: https://playwright.dev
- **Supabase CLI**: https://supabase.com/docs/guides/cli
- **TuneTreesPage**: `e2e/page-objects/TuneTreesPage.ts`
- **Practice Helpers**: `e2e/helpers/practice-scenarios.ts`
- **Test Users**: `e2e/helpers/test-users.ts`
- **Test Fixture**: `e2e/helpers/test-fixture.ts`

## Summary

1. **One input state per test** - no branches
2. **Timing resilience** - generous timeouts everywhere
3. **DRY** - use page objects and helpers
4. **Emulate patterns** - follow existing test structure
5. **PR validation** - all tests must pass before merge

````
