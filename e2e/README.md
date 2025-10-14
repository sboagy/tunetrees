# E2E Tests for TuneTrees

This directory contains end-to-end tests for the TuneTrees application using Playwright.

## Test Coverage

Tests are based on the comprehensive test plan in `_notes/test-plan-alice-signin.md`.

### Test Scenarios (8 Total)

1. **AUTH-001** - User Authentication (`auth-001-signin.spec.ts`)
2. **TOPNAV-001** - Playlist Dropdown (`topnav-001-playlist-dropdown.spec.ts`)
3. **REPERTOIRE-001** - Repertoire Tab (`repertoire-001-tunes-display.spec.ts`)
4. **CATALOG-001** - Catalog Tab (`catalog-001-all-tunes.spec.ts`)
5. **PRACTICE-001** - Practice Tab (`practice-001-empty-state.spec.ts`)
6. **TOPNAV-002** - Database Status (`topnav-002-database-status.spec.ts`)
7. **TOPNAV-003** - User Menu (`topnav-003-user-menu.spec.ts`)

## Structure

```
e2e/
├── .auth/
│   └── alice.json                       # Saved auth state (gitignored)
├── setup/
│   └── auth.setup.ts                    # Setup project (runs first, resets DB)
├── tests/                               # Test files (see above)
│   ├── auth-001-signin.spec.ts
│   ├── topnav-001-playlist-dropdown.spec.ts
│   ├── repertoire-001-tunes-display.spec.ts
│   ├── catalog-001-all-tunes.spec.ts
│   ├── practice-001-empty-state.spec.ts
│   ├── topnav-002-database-status.spec.ts
│   └── topnav-003-user-menu.spec.ts
├── helpers/                             # Test utilities (legacy)
├── global-setup.ts                      # Global setup
└── global-teardown.ts                   # Global teardown
```

## Prerequisites

1. **Supabase Local** running: `supabase start`
2. **Dev Server** running: `npm run dev`
3. **Playwright** installed: `npx playwright install`

## Running Tests

```bash
# Run all tests (includes setup project)
npx playwright test

# Run with UI mode (recommended)
npx playwright test --ui

# Run specific test
npx playwright test e2e/tests/auth-001-signin.spec.ts

# Run specific browser
npx playwright test --project=chromium

# Debug mode
npm run playwright:install

# Run all E2E tests (headless)
npm run test:e2e

# Run tests with browser UI visible
npm run test:e2e:headed

# Run tests with Playwright UI for debugging
npm run test:e2e:ui

# Debug specific test
npm run test:e2e:debug -- catalog.spec.ts
```

## Test Configuration

- **Base URL**: `http://localhost:5173` (automatically starts dev server)
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Timeouts**: 10s action, 30s navigation
- **Artifacts**: Screenshots on failure, videos on failure, traces on retry

## Writing Tests

### Page Object Pattern

Use the `TuneTreesPage` class for common interactions:

```typescript
import { test, expect } from "@playwright/test";
import { TuneTreesPage } from "../helpers/page-objects";

test("my test", async ({ page }) => {
  const tuneTreesPage = new TuneTreesPage(page);
  await tuneTreesPage.gotoCatalog();
  await tuneTreesPage.openFilterDropdown();
  // ... test logic
});
```

### Best Practices

1. **No timeouts**: Use `waitFor()` and `expect()` instead of `waitForTimeout()`
2. **Data attributes**: Use `data-testid` for reliable element selection
3. **Page objects**: Encapsulate common functionality in page objects
4. **Meaningful assertions**: Test user-visible behavior, not implementation details

### Test Data

Currently using local SQLite WASM with seed data. In the future, tests will:

- Use isolated test database
- Reset state between tests
- Mock external services

## Debugging

- Screenshots saved to `test-results/` on failure
- Use `page.pause()` to debug interactively
- Console logs captured in test output
- Playwright trace viewer for detailed debugging

## CI/CD

Tests run in GitHub Actions with:

- Headless mode
- Retry on failure (2x)
- Parallel execution disabled for stability
- Artifact collection (screenshots, videos, traces)
