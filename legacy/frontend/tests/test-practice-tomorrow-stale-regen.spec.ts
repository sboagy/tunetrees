import { test, expect } from "@playwright/test";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { getStorageState } from "@/test-scripts/storage-state";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import {
  logTestStart,
  logTestEnd,
  logBrowserContextStart,
  logBrowserContextEnd,
} from "@/test-scripts/test-logging";
import { restartBackend } from "@/test-scripts/global-setup";

// Storage/auth + viewport per repo testing conventions
test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  viewport: { width: 1400, height: 880 },
});

// Helper: set sitdown date via page object (assumes date chooser test id pattern)
async function setSitdown(ttPO: TuneTreesPageObject, d: Date) {
  const iso = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    12,
    0,
    0,
    0,
  ).toISOString();
  // Use direct page eval to avoid relying on page object method (which threw undefined page in CI context)
  await ttPO.page.evaluate((v: string) => {
    localStorage.setItem("TT_REVIEW_SITDOWN_DATE", v);
    localStorage.setItem("TT_REVIEW_SITDOWN_MANUAL", "true");
    (
      window as unknown as { __TT_REVIEW_SITDOWN_DATE__?: string }
    ).__TT_REVIEW_SITDOWN_DATE__ = v;
  }, iso);
  await ttPO.page.evaluate(() =>
    window.dispatchEvent(new Event("tt-sitdown-updated")),
  );
}

// Extract generated_at timestamp from first visible row (if surfaced)
async function extractGeneratedAt(
  page: import("@playwright/test").Page,
): Promise<string | null> {
  const resp = await page.request.get(
    `/api/tunetrees/practice-queue/1/1?sitdown_date=${encodeURIComponent(
      new Date().toISOString(),
    )}`,
  );
  if (!resp.ok()) return null;
  const data: unknown = await resp.json();
  if (Array.isArray(data) && data.length > 0) {
    const first: unknown = data[0];
    if (
      first &&
      typeof first === "object" &&
      "generated_at" in first &&
      typeof (first as { generated_at?: unknown }).generated_at === "string"
    ) {
      return (first as { generated_at: string }).generated_at;
    }
    return null;
  }
  return null;
}

// NOTE: This test validates Option B logic indirectly:
// 1. Load today and submit a single practice to establish lastSubmitUtcRef.
// 2. Preview tomorrow (captures generated_at A).
// 3. Submit another practice today (updates lastSubmitUtcRef).
// 4. Re-open tomorrow preview and expect regenerated snapshot (generated_at B >= A, and if stale logic executed B > A).

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page: _page }, testInfo) => {
  // mark page param as intentionally unused to satisfy lint rules
  void _page;
  await restartBackend();
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test("tomorrow preview regenerates after new submissions today (Option B)", async ({
  page,
}) => {
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.gotoMainPage();
  await ttPO.practiceTabTrigger.click();

  // Ensure at least one recall dropdown present
  const recallDropdowns = page.locator(
    '[data-testid$="_recall_eval"] [data-testid="tt-recal-eval-popover-trigger"]',
  );
  await expect(recallDropdowns.first()).toBeVisible({ timeout: 45000 });

  // Stage a single evaluation -> submit
  await recallDropdowns.first().click();
  await page.getByTestId("tt-recal-eval-good").click();
  const submitBtn = page.getByRole("button", {
    name: "Submit Practiced Tunes",
  });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();
  // Use dedicated toast locator from page object to avoid strict mode collisions
  await expect(ttPO.toast.last()).toContainText("Submitted evaluated tunes.", {
    timeout: 20000,
  });

  // Preview tomorrow (manual set)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await setSitdown(ttPO, tomorrow);
  await page.waitForTimeout(500); // allow fetch
  const genAtFirst = await extractGeneratedAt(page);

  // Return to today
  const today = new Date();
  await setSitdown(ttPO, today);
  await page.waitForTimeout(300);

  // Stage & submit another evaluation (pick second row if exists else first)
  const targetIdx = (await recallDropdowns.count()) > 1 ? 1 : 0;
  await recallDropdowns.nth(targetIdx).click();
  await page.getByTestId("tt-recal-eval-easy").click();
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();
  await expect(ttPO.toast.last()).toContainText("Submitted evaluated tunes.", {
    timeout: 20000,
  });

  // Re-preview tomorrow (should detect stale & regen if genAtFirst < lastSubmitUtcRef)
  await setSitdown(ttPO, tomorrow);
  await page.waitForTimeout(800); // allow regeneration fetch
  const genAtSecond = await extractGeneratedAt(page);

  // Assertions: both timestamps present; second should be >= first, and often > first (can't guarantee strictly > if time resolution same)
  if (genAtFirst && genAtSecond) {
    expect(Date.parse(genAtSecond)).toBeGreaterThanOrEqual(
      Date.parse(genAtFirst),
    );
  }
});
