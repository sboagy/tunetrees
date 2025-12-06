# Testing Guide

TuneTrees uses two testing frameworks:
- **Vitest** - Unit tests
- **Playwright** - End-to-end (E2E) tests

## Unit Tests (Vitest)

### Running Tests

```bash
npm run test           # Run once
npm run test -- --watch  # Watch mode
npm run test -- --ui    # Interactive UI
```

### Test Location

Tests live in `tests/` directory, mirroring the source structure:

```
tests/
├── db/               # Database query tests
├── services/         # Service logic tests
└── components/       # Component tests
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../helpers/test-db";

describe("tuneService", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("creates a tune with all fields", async () => {
    const tune = await createTune(db, { title: "Morrison's Jig" });
    expect(tune.title).toBe("Morrison's Jig");
  });
});
```

### Test Database

Unit tests use an in-memory SQLite database initialized fresh for each test. See `tests/helpers/test-db.ts`.

## E2E Tests (Playwright)

### Running Tests

```bash
# Start dev server first (in separate terminal)
npm run dev

# Run tests
npm run test:e2e                 # Headless
npm run test:e2e:headed          # With browser UI
npm run test:e2e:debug           # Debug mode
npm run test:e2e:chromium        # Chromium only
```

### Test Location

E2E tests live in `e2e/tests/`:

```
e2e/
├── tests/
│   ├── auth-*.spec.ts       # Authentication flows
│   ├── catalog-*.spec.ts    # Catalog page tests
│   ├── practice-*.spec.ts   # Practice page tests
│   └── repertoire-*.spec.ts # Repertoire page tests
├── helpers/                  # Test utilities
└── pages/                    # Page objects (if used)
```

### Writing E2E Tests

```typescript
import { test, expect } from "@playwright/test";

test("user can log in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();
  
  await expect(page).toHaveURL("/practice");
});
```

### Test Data

E2E tests use a clean test database. Reset with:

```bash
npm run db:test:reset
```

### Best Practices

1. **One state per test** - Each test should have clear input/output
2. **No conditionals** - Tests should be deterministic
3. **Use data-testid** - For reliable element selection
4. **Wait for elements** - Use Playwright's auto-waiting

## Coverage

Run unit tests with coverage:

```bash
npm run test -- --coverage
```

Coverage report generated in `coverage/` directory.

## CI/CD

Tests run automatically on push via GitHub Actions:

1. **Unit tests** - Must pass
2. **TypeScript** - Must compile
3. **Lint** - Must pass
4. **E2E tests** - Must pass (Chromium + Firefox)

See `.github/workflows/ci.yml` for configuration.

## Debugging

### Playwright Debug Mode

```bash
npm run test:e2e:debug
```

This opens the Playwright Inspector for step-by-step debugging.

### Playwright Trace Viewer

Failed tests save traces. View with:

```bash
npx playwright show-trace test-results/*/trace.zip
```

### VS Code Integration

Install the Playwright VS Code extension for:
- Running tests from the editor
- Debugging with breakpoints
- Viewing test results inline

---

See [AGENTS.md](../../tests/AGENTS.md) for testing conventions and rules.
