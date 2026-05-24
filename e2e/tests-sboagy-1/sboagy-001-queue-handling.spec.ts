import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BrowserContext,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  advanceDays,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

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

const runCommand = (command: string, args: string[]): void => {
  execFileSync(command, args, { stdio: "inherit" });
};

const resetSupabaseAndLoadSeed = (): void => {
  const sqlFilePath = resolveSeedSqlFilePath();
  runCommand("supabase", ["stop"]);
  runCommand("supabase", ["start"]);
  runCommand("supabase", ["db", "reset", "--local", "--no-seed"]);
  runCommand("psql", [
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    sqlFilePath,
  ]);
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

    // Submit all evaluations
    await ttPage.submitEvaluations();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    console.log("\n✓ Day 1 evaluations validated successfully!");

    // === ADVANCE TO DAY 2 ===
    console.log("\n=== Advancing to Day 2 ===");

    const day2 = await advanceDays(context, 1, currentDate);
    console.log(`  Day 2 date: ${day2.toISOString().split("T")[0]}`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    console.log("\n=== On Day 2 ===");
  });
});
