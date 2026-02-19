import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BrowserContext,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { CATALOG_TUNE_ID_MAP } from "../../src/lib/db/catalog-tune-ids";
import {
  advanceDays,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import { queryLatestPracticeRecord } from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

// 10 DISTINCT catalog tunes for testing
const EASY_TUNES = [
  CATALOG_TUNE_ID_MAP[482]!, // Wicklow Hornpipe
];

const GOOD_TUNES = [
  CATALOG_TUNE_ID_MAP[420]!, // Crosses of Annagh
];

const HARD_TUNES = [
  CATALOG_TUNE_ID_MAP[1961]!, // Touch me if you Dare
];

const AGAIN_TUNES = [
  CATALOG_TUNE_ID_MAP[221]!, // Brendan Tonra's
];

const ALL_TUNES = [...EASY_TUNES, ...GOOD_TUNES, ...HARD_TUNES, ...AGAIN_TUNES];

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

const resolveSeedSqlFilePath = (): string => {
  const preferredPath = resolve(
    currentDirPath,
    "backup_20260216_191328Z_data.sql"
  );
  if (existsSync(preferredPath)) {
    return preferredPath;
  }

  const fallbackPath = resolve(currentDirPath, "20260216_191328Z_data.sql");
  if (existsSync(fallbackPath)) {
    return fallbackPath;
  }

  throw new Error(
    `Could not locate seed SQL file in ${currentDirPath}. Expected backup_20260216_191328Z_data.sql or 20260216_191328Z_data.sql`
  );
};

const resetSupabaseAndLoadSeed = (): void => {
  const sqlFilePath = resolveSeedSqlFilePath();
  execSync("supabase stop", { stdio: "inherit" });
  execSync("supabase start", { stdio: "inherit" });
  execSync("supabase db reset --local --no-seed", { stdio: "inherit" });
  execSync(
    `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f "${sqlFilePath}"`,
    { stdio: "inherit" }
  );
};

test.describe("SCHEDULING-004: Mixed Evaluation Patterns", () => {
  let ttPage: TuneTreesPage;
  let currentDate: Date;
  let testUser: TestUser;

  const SBOAG_START_TEST_DATE = "2026-02-16T14:00:00.000Z";

  test.beforeEach(
    async (
      {
        page,
        context,
      }: {
        page: Page;
        context: BrowserContext;
      },
      testInfo: TestInfo
    ): Promise<void> => {
      // Extend timeout for all tests running this hook by 3x.
      test.setTimeout(testInfo.timeout * 3);
      ttPage = new TuneTreesPage(page);

      resetSupabaseAndLoadSeed();

      page.on("console", (msg) => {
        const text = msg.text();
        if (
          text.startsWith("[SyncDiag]") ||
          text.includes("Running initial syncDown") ||
          text.includes("Initial syncDown failed")
        ) {
          console.log(`[E2EConsole] ${text}`);
        }
      });

      await context.clearCookies();

      // Set stable starting date before first navigation so app timers
      // are initialized under the controlled clock.
      currentDate = new Date(SBOAG_START_TEST_DATE);
      await setStableDate(context, currentDate);

      await page.goto("/"); // Navigate to app root

      // Clear local/session storage to ensure clean state
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto("/"); // Navigate to app root again after clearing storage, ensuring clean state

      // await page.reload({ waitUntil: "networkidle" });

      await verifyClockFrozen(
        page,
        currentDate,
        undefined,
        test.info().project.name
      );

      testUser = {
        email: process.env.TEST_USER_SBOAGY_USERNAME || "",
        name: "sboagy",
        userId: process.env.TEST_USER_SBOAGY_ID || "",
        repertoireId: process.env.TEST_USER_SBOAGY_REPERTOIRE_ID || "",
      };

      // Wait for URL to be /login
      await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });

      // Wait for login form to be visible and interactive
      await expect(page.getByLabel("Email")).toBeVisible({ timeout: 10000 });

      // Fill in Alice's credentials
      await page.getByLabel("Email").fill(testUser.email);

      if (!testUser.email) {
        throw new Error(
          "TEST_USER_SBOAGY_PASSWORD environment variable is not set; please set TEST_USER_SBOAGY_PASSWORD to the test user's password before running E2E tests."
        );
      }

      await page
        .locator("input#password")
        .fill(process.env.TEST_USER_SBOAGY_PASSWORD || "");

      // Click Sign In button
      await page.getByRole("button", { name: "Sign In" }).click();

      // Wait for redirect away from login page
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 10000,
      });

      // Wait for user email to appear in TopNav (confirms logged in)
      await expect(page.getByText(testUser.email)).toBeVisible({
        timeout: 10000,
      });

      // // This suite controls time via Playwright clock.
      // // Disable background auto-sync timers to prevent periodic timer churn,
      // // then rely on explicit __forceSync*ForTest hooks in each test.
      // await stopBackgroundAutoSync(page);

      // // Run one explicit sync pass so each test starts from a stable baseline.
      // await page.evaluate(() => (window as any).__forceSyncDownForTest?.());
      // await page.waitForLoadState("networkidle", { timeout: 15000 });

      // Verify we remain authenticated after setup.
      await expect(page).not.toHaveURL(/.*\/login/, { timeout: 5000 });
    }
  );

  test("[WIP] Production snapshot experimental", async ({ page, context }) => {
    test.setTimeout(45 * 60000); // Extend timeout for this test to 15 minutes for debugging
    console.log("\n=== SBOAGY-001: QUEUE HANDLING ===");
    console.log(`  Test date: ${currentDate.toISOString().split("T")[0]}`);

    // === DAY 1: Practice all 10 tunes with different ratings ===
    console.log("\n=== Day 1: Initial Evaluations ===");

    // For debugging
    // await page.waitForTimeout(45 * 60000);

    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

    const rows = ttPage.practiceGrid.locator("tbody tr[data-index]");
    await expect
      .poll(async () => await rows.count(), {
        timeout: 20000,
        message: "Practice queue did not reach expected size in time",
      })
      .toBeGreaterThan(2);

    page.waitForTimeout(1000);

    // Verify all tunes are in queue
    const initialRowCount = await rows.count();
    console.log(`  Initial queue size: ${initialRowCount} tunes`);

    const row1 = ttPage.getRows("scheduled").first();
    await ttPage.setRowEvaluation(row1, "easy", 500);

    const row2 = ttPage.getRows("scheduled").nth(1);
    await ttPage.setRowEvaluation(row2, "good", 500);

    const row4 = ttPage.getRows("scheduled").nth(3);
    await ttPage.setRowEvaluation(row4, "hard", 500);

    // // Map tune IDs to their expected ratings
    // const tuneRatings = new Map<string, "easy" | "good" | "hard" | "again">();
    // for (const tuneId of EASY_TUNES) tuneRatings.set(tuneId, "easy");
    // for (const tuneId of GOOD_TUNES) tuneRatings.set(tuneId, "good");
    // for (const tuneId of HARD_TUNES) tuneRatings.set(tuneId, "hard");
    // // for (const tuneId of AGAIN_TUNES) tuneRatings.set(tuneId, "again");

    // // // Evaluate each tune based on its assigned rating
    // // // NOTE: Grid order may differ from ALL_TUNES order, so we extract tune ID from each row
    // const rowCount = await rows.count();
    // for (let i = 0; i < rowCount; i++) {
    //   const row = ttPage.practiceGrid.locator(`tbody tr[data-index='${i}']`);
    //   await expect(row).toBeVisible({ timeout: 10000 });

    //   // Extract tune ID from the eval dropdown's data-testid (format: recall-eval-{uuid})
    //   const evalDropdown = row.locator("[data-testid^='recall-eval-']");
    //   await expect(evalDropdown).toBeVisible({ timeout: 5000 });
    //   const tuneId = ttPage.parseTuneIdFromRecallEvalTestId(
    //     await evalDropdown.getAttribute("data-testid")
    //   );
    //   if (!tuneId) {
    //     throw new Error(
    //       "Expected tuneId to be present on recall evaluation dropdown"
    //     );
    //   }

    //   // Get the rating for this tune ID
    //   const rating = tuneRatings.get(tuneId);
    //   if (!rating) {
    //     continue; // Tune not in our test set, leave it unevaluated
    //     // throw new Error("Expected tuneId to be present in tuneRatings");
    //   }

    //   await ttPage.setRowEvaluation(row, rating, 500);
    // }

    // // // Submit all evaluations
    await ttPage.submitEvaluations();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // // // Force sync (?)
    // // await page.evaluate(() => (window as any).__forceSyncUpForTest?.());
    // await page.waitForLoadState("networkidle", { timeout: 15000 });

    // // // === VERIFY: Interval ordering ===
    // console.log("\n=== Validating Interval Ordering ===");

    // // // Query practice records for all tunes
    // const easyRecords = await Promise.all(
    //   EASY_TUNES.map((tuneId) =>
    //     queryLatestPracticeRecord(page, tuneId, testUser.repertoireId)
    //   )
    // );
    // const goodRecords = await Promise.all(
    //   GOOD_TUNES.map((tuneId) =>
    //     queryLatestPracticeRecord(page, tuneId, testUser.repertoireId)
    //   )
    // );
    // const hardRecords = await Promise.all(
    //   HARD_TUNES.map((tuneId) =>
    //     queryLatestPracticeRecord(page, tuneId, testUser.repertoireId)
    //   )
    // );
    // const againRecords = await Promise.all(
    //   AGAIN_TUNES.map((tuneId) =>
    //     queryLatestPracticeRecord(page, tuneId, testUser.repertoireId)
    //   )
    // );

    // // // Calculate average intervals for each rating group
    // const avgEasyInterval =
    //   easyRecords.reduce((sum, r) => sum + (r?.interval ?? 0), 0) /
    //   easyRecords.length;
    // const avgGoodInterval =
    //   goodRecords.reduce((sum, r) => sum + (r?.interval ?? 0), 0) /
    //   goodRecords.length;
    // const avgHardInterval =
    //   hardRecords.reduce((sum, r) => sum + (r?.interval ?? 0), 0) /
    //   hardRecords.length;
    // const avgAgainInterval =
    //   againRecords.reduce((sum, r) => sum + (r?.interval ?? 0), 0) /
    //   againRecords.length;

    // console.log(`  Avg Easy interval: ${avgEasyInterval.toFixed(1)} days`);
    // console.log(`  Avg Good interval: ${avgGoodInterval.toFixed(1)} days`);
    // console.log(`  Avg Hard interval: ${avgHardInterval.toFixed(1)} days`);
    // console.log(`  Avg Again interval: ${avgAgainInterval.toFixed(1)} days`);

    // // NOTE: For FIRST evaluations (NEW state), FSRS interval ordering is NOT
    // // the traditional Again < Hard < Good < Easy. Instead:
    // // - "Easy" graduates immediately to Review but may have short first interval
    // // - "Good" progresses through learning steps
    // // The ordering Again < Hard < Good < Easy applies to REVIEW state cards.
    // //
    // // What we CAN validate:
    // // 1. All intervals >= 1 day (minimum interval enforced)
    // // 2. "Again" should have interval >= 1 day (relearning)
    // // 3. All intervals are positive numbers

    // // All intervals should be >= 1 day
    // expect(avgEasyInterval).toBeGreaterThanOrEqual(1);
    // expect(avgGoodInterval).toBeGreaterThanOrEqual(1);
    // expect(avgHardInterval).toBeGreaterThanOrEqual(1);
    // expect(avgAgainInterval).toBeGreaterThanOrEqual(1);

    // // Validate that "Again" produces reasonable learning interval
    // // Again restarts learning, so interval should be short (1-2 days typically)
    // expect(avgAgainInterval).toBeLessThanOrEqual(5);

    // console.log("  ✓ All intervals are >= 1 day (minimum interval enforced)");

    // // // === VERIFY: All due dates in future ===
    // console.log("\n=== Validating All Due Dates in Future ===");

    // const allRecords = [
    //   ...easyRecords,
    //   ...goodRecords,
    //   ...hardRecords,
    //   ...againRecords,
    // ].filter((r) => r !== null);

    // for (const record of allRecords) {
    //   const dueDate = new Date(record!.due);
    //   const diff = dueDate.getTime() - currentDate.getTime();
    //   expect(diff).toBeGreaterThan(0); // Due date must be in future
    // }

    // console.log(`  ✓ All ${allRecords.length} tunes have future due dates`);

    // // === VERIFY: FSRS state transitions ===
    // console.log("\n=== Validating FSRS State Transitions ===");

    // // Easy should go directly to Review (state 2)
    // for (const record of easyRecords) {
    //   expect(record).not.toBeNull();
    //   console.log(
    //     `  Easy tune: quality=${record!.quality}, state=${record!.state}, interval=${record!.interval}d, stability=${record!.stability}`
    //   );
    //   // Easy (quality=4) should go to Review (state=2)
    //   expect(record!.quality).toBe(4); // Verify it was recorded as Easy
    //   expect(record!.state).toBe(2); // Review
    // }

    // // Good should be in Learning (state 1) or Review (state 2)
    // for (const record of goodRecords) {
    //   expect(record).not.toBeNull();
    //   expect([1, 2]).toContain(record!.state); // Learning or Review
    //   console.log(
    //     `  Good tune: state=${record!.state}, interval=${record!.interval}d`
    //   );
    // }

    // // Hard should be in Learning (state 1)
    // for (const record of hardRecords) {
    //   expect(record).not.toBeNull();
    //   expect([1, 2]).toContain(record!.state); // Learning or Review
    //   console.log(
    //     `  Hard tune: state=${record!.state}, interval=${record!.interval}d`
    //   );
    // }

    // // Again should be in Learning (state 1) with lapses
    // for (const record of againRecords) {
    //   expect(record).not.toBeNull();
    //   expect(record!.state).toBe(3); // Relearning
    //   console.log(
    //     `  Again tune: state=${record!.state}, lapses=${record!.lapses}, interval=${record!.interval}d`
    //   );
    // }

    console.log("\n✓ Day 1 evaluations validated successfully!");

    // === ADVANCE TO DAY 2 ===
    console.log("\n=== Advancing to Day 2 ===");

    // Persist and reload with new date
    // await page.evaluate(() => (window as any).__persistDbForTest?.());

    const day2 = await advanceDays(context, 1, currentDate);
    console.log(`  Day 2 date: ${day2.toISOString().split("T")[0]}`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    console.log("\n=== On Day 2 ===");
    // page.waitForTimeout(45 * 60000); // For debugging
  });
});
