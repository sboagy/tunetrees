# Testing Infrastructure Complete Setup Guide

## Overview

This guide documents the complete Playwright testing infrastructure for TuneTrees PWA.

---

## Local Development Testing

### Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npm run playwright:install

# 3. Ensure Supabase is running
supabase start

# 4. Reset database to clean seed state
supabase db reset
```

### Running Tests Locally

```bash
# Headless mode (CI-like)
npm run test:e2e

# Headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug

# UI mode (interactive test explorer)
npm run test:e2e:ui

# Generate HTML report
npm run test:e2e:report
```

### Before Running Tests

1. **Start dev server:**

   ```bash
   npm run dev
   ```

   This runs on http://localhost:5173

2. **Ensure database is fresh:**
   ```bash
   supabase db reset
   ```

---

## CI/CD Setup (GitHub Actions)

### Workflow File

Located at `.github/workflows/ci.yml`

### Triggers

- Push to `main` or `feat/pwa1` branches
- Pull requests targeting `main`

### What It Does

1. **Checks out code**
2. **Installs Node.js 20**
3. **Installs dependencies** (`npm ci`)
4. **Installs Supabase CLI**
5. **Starts Supabase local stack** (Docker Postgres + services)
6. **Resets database** with `supabase/seed.sql`
7. **Installs Playwright browsers**
8. **Builds application**
9. **Starts dev server** (background)
10. **Waits for server** to be ready
11. **Runs Playwright tests**
12. **Uploads test artifacts** (reports, screenshots, videos)
13. **Cleans up** Supabase

### Environment Variables

The CI workflow uses:

- `VITE_SUPABASE_URL`: `http://127.0.0.1:54321` (local Supabase)
- `VITE_SUPABASE_ANON_KEY`: Default demo key (public, safe)
- `DATABASE_URL`: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### Artifacts

- **Playwright Report**: Full HTML report with test results (kept 30 days)
- **Test Results**: Screenshots/videos of failures (kept 7 days)

---

## Test Database (Seed Data)

### Location

`supabase/seed.sql`

### Contents

- **Auth users**: Real user accounts from dump
- **Test users** (to be added): alice.test@tunetrees.test, bob.test@tunetrees.test, charlie.test@tunetrees.test
- **Tunes**: Real tune data
- **Playlists**: User playlists with tune assignments
- **Practice records**: Historical practice data with FSRS scheduling

### Resetting Database

```bash
# Local
supabase db reset

# This runs automatically in CI before tests
```

### Seed File Size

- **5,667 lines** of SQL
- Comprehensive real-world data
- Includes auth audit logs (can be trimmed if needed)

---

## Test Users (To Be Added)

See `_notes/test-users.md` for detailed test user specifications.

### Quick Reference

| User    | Email                       | Password               | Purpose                      |
| ------- | --------------------------- | ---------------------- | ---------------------------- |
| Alice   | alice.test@tunetrees.test   | SomePasswordForTesting | Primary test user, full data |
| Bob     | bob.test@tunetrees.test     | SomePasswordForTesting | Secondary user, catalog only |
| Charlie | charlie.test@tunetrees.test | SomePasswordForTesting | Edge cases, empty account    |

---

## Test Structure

### Directory Layout

```
tests/
├── auth.setup.ts          # Authentication setup for test users
├── practice.spec.ts       # Practice tab tests
├── repertoire.spec.ts     # Repertoire tab tests
├── catalog.spec.ts        # Catalog tab tests
├── navigation.spec.ts     # Navigation and routing tests
└── .auth/                 # Stored auth states (gitignored)
    ├── alice.json
    ├── bob.json
    └── charlie.json
```

### Playwright Config

`playwright.config.ts`:

- **Base URL**: http://localhost:5173
- **Test timeout**: 30 seconds
- **Screenshot on failure**: Yes
- **Video**: On first retry
- **Retries**: 2 (CI), 0 (local)

---

## Writing Tests

### Authentication Pattern

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/.auth/alice.json" });

test("user can view practice queue", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
});
```

### Database State Pattern

```typescript
test.beforeEach(async () => {
  // Database is already reset by CI
  // Or manually run: supabase db reset
});

test("user can add tune to repertoire", async ({ page }) => {
  await page.goto("/catalog");
  // Test assumes clean seed state
});
```

### Common Test Patterns

1. **Navigate** → **Interact** → **Assert**
2. **Use data-testid** for reliable selectors
3. **Wait for network idle** after mutations
4. **Use page objects** for complex UIs

---

## Debugging Tests

### Local Debugging

```bash
# Opens Playwright Inspector
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/practice.spec.ts

# Run specific test by name
npx playwright test -g "user can submit practice evaluations"
```

### CI Debugging

1. **Check workflow logs** in GitHub Actions
2. **Download artifacts**:
   - Playwright HTML report
   - Test screenshots/videos
3. **Reproduce locally**:
   ```bash
   supabase db reset
   npm run test:e2e
   ```

---

## Performance Considerations

### Test Execution Speed

- **Parallel execution**: Playwright runs tests in parallel (default 50% of CPUs)
- **Headless mode**: Faster than headed
- **Database resets**: Only once per test run (not per test)

### Optimizing CI

- **Cache Node modules**: Uses `actions/setup-node` cache
- **Reuse Playwright browsers**: Installed once per workflow run
- **Concurrency**: Cancels in-progress runs on new commit

---

## Maintenance

### Updating Seed Data

```bash
# 1. Make changes in local Supabase
# 2. Dump current state
supabase db dump --data-only > supabase/seed.sql

# 3. Manually add test users to seed.sql (see test-users.md)

# 4. Test reset works
supabase db reset

# 5. Commit seed.sql
git add supabase/seed.sql
git commit -m "chore: Update test seed data"
```

### Adding New Tests

1. **Create test file** in `tests/`
2. **Use existing auth setup** (alice, bob, charlie)
3. **Follow naming convention**: `<feature>.spec.ts`
4. **Run locally first**: `npm run test:e2e:headed`
5. **Verify in CI**: Push and check GitHub Actions

### Updating Playwright

```bash
npm install -D @playwright/test@latest
npm run playwright:install
```

---

## Troubleshooting

### "Database not found"

```bash
# Solution: Start Supabase
supabase start
supabase db reset
```

### "Port 5173 already in use"

```bash
# Solution: Kill existing dev server
pkill -f "vite"
npm run dev
```

### "Test timeout"

- Increase timeout in `playwright.config.ts`
- Check if server is actually running
- Verify database is accessible

### "Flaky tests"

- Add `await page.waitForLoadState('networkidle')`
- Use `toBeVisible()` instead of `toHaveText()` for loading states
- Increase retries for CI only

---

## Next Steps

1. ✅ GitHub Actions CI workflow created
2. ✅ Test users documented
3. ⏳ Add test users to `supabase/seed.sql`
4. ⏳ Generate test plan with MCP playwright-test planner
5. ⏳ Generate baseline tests with MCP playwright-test generator
6. ⏳ Run tests locally and verify
7. ⏳ Push and verify CI passes

---

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [TuneTrees Testing Instructions](.github/instructions/testing.instructions.md)
