import { expect, type Page } from "@playwright/test";
import type { TuneTreesPage } from "../page-objects/TuneTreesPage";

export type TestHookName =
  | "__forceSyncDownForTest"
  | "__forceSyncUpForTest"
  | "__persistDbForTest";

/**
 * Wait for a browser test hook to exist after reload/navigation, then invoke it.
 *
 * The practice specs use these hooks to force sync up/down or persist the local
 * database. After a reload, the app may need a short time to re-register the hook
 * on `window`, so callers should not invoke it blindly.
 */
export async function runTestHook(
  page: Page,
  hookName: TestHookName
): Promise<void> {
  await expect
    .poll(
      async () => {
        return await page.evaluate((name) => {
          return typeof (window as any)[name] === "function";
        }, hookName);
      },
      {
        timeout: 10000,
        intervals: [100, 250, 500, 1000],
        message: `${hookName} did not become available`,
      }
    )
    .toBe(true);

  await page.evaluate(async (name) => {
    const hook = (window as any)[name];
    if (typeof hook !== "function") {
      throw new Error(`${name} is not available`);
    }
    await hook();
  }, hookName);
}

/**
 * Wait for the practice page to leave its transient loading state and settle into
 * either a visible scheduled grid or the "All Caught Up!" empty state.
 *
 * This is used instead of fixed sleeps after reloads/submits so the test continues
 * as soon as the practice view is actually ready.
 */
export async function waitForPracticeViewSettled(
  page: Page,
  ttPage: TuneTreesPage,
  opts: {
    expectRows?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<number> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const expectRows = opts.expectRows ?? false;
  const loadingMessage = page.getByText("Loading practice queue...");
  const emptyState = page.getByText("All Caught Up!");
  const practiceRows = ttPage.getRows("scheduled");
  let latestRowCount = 0;

  await expect(ttPage.practiceColumnsButton).toBeVisible({
    timeout: timeoutMs,
  });

  await expect
    .poll(
      async () => {
        const [loadingVisible, gridVisible, emptyVisible] = await Promise.all([
          loadingMessage.isVisible().catch(() => false),
          ttPage.practiceGrid.isVisible().catch(() => false),
          emptyState.isVisible().catch(() => false),
        ]);

        if (loadingVisible) {
          return false;
        }

        if (gridVisible) {
          latestRowCount = await practiceRows.count();
          return !expectRows || latestRowCount > 0;
        }

        latestRowCount = 0;
        return emptyVisible && !expectRows;
      },
      {
        timeout: timeoutMs,
        intervals: [200, 500, 1000],
        message: expectRows
          ? "Practice view did not settle with scheduled rows in time"
          : "Practice view did not settle in time",
      }
    )
    .toBe(true);

  return latestRowCount;
}

/**
 * Submit staged evaluations and wait until the practice view reflects the result.
 *
 * In practice this means the submit button has reset back to zero pending items
 * and the practice grid/empty state has settled after any reactive refresh.
 */
export async function submitAndWaitForPracticeSettled(
  page: Page,
  ttPage: TuneTreesPage,
  timeoutMs = 15000
): Promise<void> {
  await ttPage.submitEvaluations({ timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  await expect(ttPage.submitEvaluationsButton).toBeDisabled({
    timeout: timeoutMs,
  });
  await expect(ttPage.submitEvaluationsButton).toHaveAttribute(
    "title",
    /Submit 0 practice evaluations/i,
    { timeout: timeoutMs }
  );
  await waitForPracticeViewSettled(page, ttPage, { timeoutMs });
}
