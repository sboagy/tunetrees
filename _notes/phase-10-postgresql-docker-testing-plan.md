# Phase 10: PostgreSQL Docker Testing Plan

**Created:** October 8, 2025  
**Status:** 📋 **PLANNED** - Comprehensive CI/CD testing strategy  
**Priority:** 🟡 **MEDIUM** - Post-Phase 8 completion

---

## 🎯 Overview

**Goal:** Implement a two-tier testing strategy using PostgreSQL Docker for CI/CD integration tests while keeping fast SQLite-based unit tests.

**Why PostgreSQL Docker?**

- ✅ No Supabase test instance needed (cost, cleanup, parallel test issues)
- ✅ Tests real PostgreSQL features (DISTINCT ON, STRING_AGG, etc.)
- ✅ Full sync cycle testing (SQLite WASM ↔ PostgreSQL)
- ✅ GitHub Actions native Docker support
- ✅ Easy cleanup (destroy container after tests)
- ✅ Reuses existing migration script for seeding

**Why NOT Supabase Test Instance?**

- ❌ Cleanup complexity between test runs
- ❌ Parallel CI jobs conflict (multiple PRs)
- ❌ Rate limits (even free tier)
- ❌ Secrets management overhead
- ❌ Cost tracking difficulty

---

## 📊 Two-Tier Testing Strategy

### **Tier 1: Unit Tests (Fast Feedback)**

**Tool:** Vitest + `@solidjs/testing-library`  
**Database:** SQLite WASM (in-memory or test file)  
**Speed:** Milliseconds  
**Run Frequency:** Every commit (local + CI)  
**Focus:** Logic, not integration

**What Gets Tested:**

- ✅ Sync queue logic (batching, retry, error handling)
- ✅ Conflict detection algorithms
- ✅ FSRS scheduling calculations
- ✅ UI component rendering (snapshots)
- ✅ Database query functions (mocked or in-memory SQLite)
- ✅ Form validation logic
- ✅ Utility functions

**Example Test:**

```typescript
// src/lib/sync/conflicts.test.ts
import { describe, it, expect } from "vitest";
import { detectConflict, resolveConflict } from "./conflicts";

describe("Conflict Detection", () => {
  it("detects conflict when sync_version differs", () => {
    const local = { sync_version: 5, last_modified_at: new Date("2025-01-01") };
    const remote = {
      sync_version: 6,
      last_modified_at: new Date("2025-01-02"),
    };

    const conflict = detectConflict(local, remote);
    expect(conflict).toBe(true);
  });

  it("resolves conflict with last-write-wins", () => {
    const local = { data: "old", last_modified_at: new Date("2025-01-01") };
    const remote = { data: "new", last_modified_at: new Date("2025-01-02") };

    const resolved = resolveConflict(local, remote);
    expect(resolved.data).toBe("new"); // Remote is newer
  });
});
```

---

### **Tier 2: Integration Tests (High Confidence)**

**Tool:** Playwright (E2E)  
**Database:** PostgreSQL Docker + SQLite WASM  
**Speed:** Minutes  
**Run Frequency:** Pull requests + main branch  
**Focus:** Full system behavior

**What Gets Tested:**

- ✅ Full sync cycle: Local SQLite → PostgreSQL → Local SQLite
- ✅ Multi-device sync scenarios (Device A updates, Device B syncs)
- ✅ Conflict resolution with real PostgreSQL timestamps
- ✅ Offline → Online sync workflow
- ✅ Data integrity (foreign keys, constraints)
- ✅ PostgreSQL-specific SQL (DISTINCT ON, STRING_AGG)
- ✅ Migration script robustness
- ✅ E2E user workflows (login, practice, edit tune, sync)

**Example Test:**

```typescript
// tests/sync-integration.spec.ts
import { test, expect } from "@playwright/test";

test("sync cycle: local → postgres → local", async ({ page, context }) => {
  // Device A: Create tune
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Add Tune" }).click();
  await page.getByLabel("Title").fill("Test Tune");
  await page.getByRole("button", { name: "Save" }).click();

  // Wait for sync to complete
  await page.waitForSelector('[data-sync-status="synced"]');

  // Device B: Open in new context (simulates different device)
  const deviceB = await context.newPage();
  await deviceB.goto("/catalog");

  // Verify tune appears on Device B
  await expect(deviceB.getByText("Test Tune")).toBeVisible();
});

test("conflict resolution: last-write-wins", async ({ page, context }) => {
  // Device A: Edit tune offline
  await page.goto("/catalog/1/edit");
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then((reg) =>
      reg.active?.postMessage({ type: "GO_OFFLINE" })
    )
  );
  await page.getByLabel("Title").fill("Device A Version");
  await page.getByRole("button", { name: "Save" }).click();

  // Device B: Edit same tune (online)
  const deviceB = await context.newPage();
  await deviceB.goto("/catalog/1/edit");
  await deviceB.getByLabel("Title").fill("Device B Version");
  await deviceB.getByRole("button", { name: "Save" }).click();

  // Device A: Go online and sync
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then((reg) =>
      reg.active?.postMessage({ type: "GO_ONLINE" })
    )
  );
  await page.waitForSelector('[data-sync-status="synced"]');

  // Verify last-write-wins (Device B should win if it saved later)
  await page.reload();
  await expect(page.getByLabel("Title")).toHaveValue(/Device [AB] Version/);
});
```

---

## 🐳 GitHub Actions Docker Setup

### **PostgreSQL Service Configuration**

Add to `.github/workflows/playwright.yml`:

```yaml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 60

    # Add PostgreSQL Docker service
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: tunetrees_test
          POSTGRES_PASSWORD: test_password_123
          POSTGRES_DB: tunetrees_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Seed PostgreSQL with test data
        run: npm run seed:test-db
        env:
          DATABASE_URL: postgresql://tunetrees_test:test_password_123@localhost:5432/tunetrees_test
          VITE_SUPABASE_URL: http://localhost:54321 # Mock URL (not used in tests)
          SUPABASE_SERVICE_ROLE_KEY: mock-key-for-migration-script

      - name: Run Playwright integration tests
        run: npx playwright test --project=chromium
        env:
          DATABASE_URL: postgresql://tunetrees_test:test_password_123@localhost:5432/tunetrees_test
          CI: true

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## 📝 Implementation Tasks

### **Task 1: Create Test Seed Script** ✅ READY

**Goal:** Reuse migration script to seed PostgreSQL Docker with test data

**Script:** `scripts/seed-test-database.ts`

```typescript
import { config } from "dotenv";
import postgres from "postgres";
import BetterSqlite3 from "better-sqlite3";
import { migrateDatabase } from "./migrate-production-to-supabase";

config();

// Use environment variable or default to local Docker instance
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://tunetrees_test:test_password_123@localhost:5432/tunetrees_test";

// Use test database file (smaller than production)
const SQLITE_DB_PATH = "./tunetrees_test_clean.sqlite3";

async function seedTestDatabase() {
  console.log("🌱 Seeding PostgreSQL test database...");
  console.log(`📁 Source: ${SQLITE_DB_PATH}`);
  console.log(`🐘 Target: ${DATABASE_URL.replace(/:[^:]*@/, ":***@")}`);

  // Reuse existing migration logic
  await migrateDatabase(SQLITE_DB_PATH, DATABASE_URL);

  console.log("✅ Test database seeded successfully!");
}

seedTestDatabase().catch(console.error);
```

**Add to `package.json`:**

```json
{
  "scripts": {
    "seed:test-db": "tsx scripts/seed-test-database.ts"
  }
}
```

**Acceptance Criteria:**

- [ ] Script reuses `migrate-production-to-supabase.ts` logic
- [ ] Accepts `DATABASE_URL` environment variable
- [ ] Uses `tunetrees_test_clean.sqlite3` as source
- [ ] Completes in < 30 seconds
- [ ] Can run multiple times (TRUNCATE cleanup)

---

### **Task 2: Mock Supabase Client for Tests**

**Goal:** Replace Supabase Realtime with mock for CI tests

**File:** `src/lib/sync/supabase-mock.ts`

```typescript
// Mock Supabase client for testing (no Realtime)
export function createMockSupabaseClient(postgresConnectionString: string) {
  // Return a client that uses direct PostgreSQL connection
  // Skip Realtime subscriptions in CI mode
  // Use environment variable: process.env.CI === 'true'
}
```

**Usage in tests:**

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    baseURL: "http://localhost:4173",
    // Inject mock Supabase client in CI mode
    storageState: process.env.CI ? "tests/mock-auth-state.json" : undefined,
  },
});
```

**Acceptance Criteria:**

- [ ] Mock client implements same interface as real Supabase client
- [ ] Skips Realtime subscriptions (not needed for CI)
- [ ] Uses direct PostgreSQL connection via `postgres` package
- [ ] Enabled via `CI=true` environment variable

---

### **Task 3: Update Playwright Config for Docker**

**Goal:** Configure Playwright to use PostgreSQL Docker in CI mode

**File:** `playwright.config.ts`

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",

    // Inject PostgreSQL connection in CI
    extraHTTPHeaders: process.env.CI
      ? {
          "X-Database-URL": process.env.DATABASE_URL,
        }
      : {},
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
```

**Acceptance Criteria:**

- [ ] Tests run against PostgreSQL Docker in CI mode
- [ ] Tests run against local SQLite in dev mode
- [ ] `DATABASE_URL` environment variable configures connection
- [ ] Web server starts before tests run
- [ ] Parallel execution disabled in CI (avoid conflicts)

---

### **Task 4: Create Sync Integration Tests**

**Goal:** E2E tests for full sync cycle

**File:** `tests/sync-integration.spec.ts`

**Test Scenarios:**

1. **Basic Sync Cycle**

   - Create tune → Wait for sync → Verify in PostgreSQL
   - Update tune → Wait for sync → Verify changes
   - Delete tune → Wait for sync → Verify deletion

2. **Multi-Device Sync**

   - Device A creates tune → Device B sees update
   - Device B edits tune → Device A sees changes
   - Both devices offline → Both edit → Resolve conflicts

3. **Offline → Online Sync**

   - Go offline → Create 5 tunes → Go online → Verify all sync
   - Check sync queue processes in order
   - Verify retry logic on failed syncs

4. **Conflict Resolution**
   - Simultaneous edits → Last-write-wins
   - Verify conflict logs
   - Verify data integrity after resolution

**Acceptance Criteria:**

- [ ] All scenarios pass with PostgreSQL Docker
- [ ] Tests use real Playwright browser (Chromium)
- [ ] Network conditions simulated (offline/online toggle)
- [ ] Test data cleanup after each test
- [ ] Screenshots/videos on failure

---

### **Task 5: Add Unit Tests for Sync Logic**

**Goal:** Fast tests for sync algorithms (no database needed)

**File:** `src/lib/sync/engine.test.ts` (already exists, enhance)

**Additional Tests:**

- Batch processing (100 records at a time)
- Error handling (network failures, invalid data)
- Retry logic (exponential backoff)
- Change detection (local vs remote timestamps)
- Sync queue processing order (FIFO)

**Acceptance Criteria:**

- [ ] Tests run in < 1 second
- [ ] 100% code coverage for sync logic
- [ ] Uses in-memory SQLite (no Docker needed)
- [ ] Runs on every commit (fast CI step)

---

### **Task 6: Local Docker Testing Script**

**Goal:** Allow developers to test with PostgreSQL Docker locally

**Script:** `scripts/test-with-docker.sh`

```bash
#!/bin/bash
set -e

echo "🐳 Starting PostgreSQL Docker container..."
docker run -d \
  --name tunetrees-test-postgres \
  -e POSTGRES_USER=tunetrees_test \
  -e POSTGRES_PASSWORD=test_password_123 \
  -e POSTGRES_DB=tunetrees_test \
  -p 5432:5432 \
  postgres:15-alpine

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

echo "🌱 Seeding test database..."
DATABASE_URL=postgresql://tunetrees_test:test_password_123@localhost:5432/tunetrees_test \
  npm run seed:test-db

echo "🧪 Running integration tests..."
DATABASE_URL=postgresql://tunetrees_test:test_password_123@localhost:5432/tunetrees_test \
  npx playwright test

echo "🧹 Cleaning up Docker container..."
docker stop tunetrees-test-postgres
docker rm tunetrees-test-postgres

echo "✅ Tests complete!"
```

**Usage:**

```bash
chmod +x scripts/test-with-docker.sh
./scripts/test-with-docker.sh
```

**Acceptance Criteria:**

- [ ] Starts PostgreSQL Docker container
- [ ] Seeds test data
- [ ] Runs Playwright tests
- [ ] Cleans up container on exit
- [ ] Works on macOS, Linux, Windows (Git Bash)

---

## 📊 Testing Matrix

| Test Type            | Database                        | Tool                     | Speed  | Run Frequency | CI Step    |
| -------------------- | ------------------------------- | ------------------------ | ------ | ------------- | ---------- |
| **Unit Tests**       | SQLite in-memory                | Vitest                   | 1-5s   | Every commit  | ✅ Always  |
| **Component Tests**  | None (mocked)                   | Vitest + Testing Library | 5-10s  | Every commit  | ✅ Always  |
| **Sync Logic Tests** | SQLite in-memory                | Vitest                   | 1-5s   | Every commit  | ✅ Always  |
| **E2E Integration**  | PostgreSQL Docker + SQLite WASM | Playwright               | 2-5min | PR + main     | ✅ CI only |
| **Manual Testing**   | Supabase Production             | Browser                  | N/A    | Pre-deploy    | ⏭️ Manual  |

---

## 🎯 Success Criteria

**Phase 10 Complete When:**

- ✅ Unit tests cover 80%+ of sync logic
- ✅ Integration tests cover critical user flows
- ✅ PostgreSQL Docker CI workflow working
- ✅ All tests passing on main branch
- ✅ Test seed script reuses migration logic
- ✅ Local Docker testing script available
- ✅ Playwright tests verify sync cycle
- ✅ Conflict resolution tests passing
- ✅ Performance benchmarks met (< 3s load, 60 FPS)
- ✅ Cross-browser testing complete (Chrome, Safari, Firefox)

---

## 🔗 Related Documents

- `_notes/phase-8-remote-sync-plan.md` - Sync engine implementation details
- `_notes/solidjs-pwa-migration-plan.md` - Overall migration roadmap
- `.github/workflows/playwright.yml` - Current CI workflow (to be updated)
- `scripts/migrate-production-to-supabase.ts` - Migration logic to reuse
- `.github/instructions/testing.instructions.md` - Testing guidelines

---

## 📝 Notes

### **What NOT to Test in CI**

- ❌ Supabase Realtime (mock it or skip)
- ❌ Supabase RLS policies (test manually)
- ❌ Push notifications (future feature)
- ❌ PWA install prompt (UI polish, not critical)
- ❌ Multi-browser (Chrome-only in CI, manual for others)

### **Future Enhancements**

- 🔮 Supabase local dev (full Realtime testing)
- 🔮 Visual regression testing (Percy, Chromatic)
- 🔮 Performance monitoring (Lighthouse CI)
- 🔮 Mutation testing (Stryker)
- 🔮 Load testing (k6, Artillery)

---

**Last Updated:** October 8, 2025  
**Status:** Ready for implementation (after Phase 8 testing complete)  
**Maintained By:** GitHub Copilot (per user @sboagy)
