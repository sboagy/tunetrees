# E2E Tests for TuneTrees SolidJS PWA

This directory contains end-to-end tests using Playwright for the TuneTrees application.

## Structure

```
e2e/
├── tests/              # Test files
│   ├── catalog.spec.ts # Catalog page tests
│   └── auth.spec.ts    # Authentication tests (skipped until implemented)
├── helpers/            # Test utilities and page objects
│   └── page-objects.ts # Page Object Model classes
├── global-setup.ts     # Global setup (runs once before all tests)
└── global-teardown.ts  # Global teardown (runs once after all tests)
```

## Running Tests

```bash
# Install Playwright browsers (first time only)
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
