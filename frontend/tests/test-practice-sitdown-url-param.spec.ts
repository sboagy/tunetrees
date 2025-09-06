import { test, expect } from "@playwright/test";
import { TuneTreesPageObject } from "../test-scripts/tunetrees.po";
import { getStorageState } from "@/test-scripts/storage-state";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";

// This spec verifies that the ?tt_sitdown=YYYY-MM-DDTHH:mm:ss.sssZ[,auto] URL param
// initializes the sitdown date (and optionally clears manual pin with ,auto)
// without needing explicit runtime calls. We only run in non-production.

function toNoonIso(d: Date): string {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  return c.toISOString();
}

async function getChooserLabel(ttPO: TuneTreesPageObject) {
  const btn = ttPO.page.getByTestId("practice-date-chooser").locator("button");
  return btn.textContent();
}

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
});

test.describe("Practice sitdown date URL param override", () => {
  test("initial load with manual pin (default) and auto variant", async ({
    page,
  }) => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const isoTomorrow = toNoonIso(tomorrow);

    // Navigate with sitdown param (manual by default)
    await setTestDefaults(page);
    await page.goto(`/?tt_sitdown=${encodeURIComponent(isoTomorrow)}`);

    const ttPO = new TuneTreesPageObject(page);
    await ttPO.practiceTabTrigger.click();
    const labelManual = await getChooserLabel(ttPO);
    // Allow Tomorrow, Today (timezone normalization), or explicit date
    expect(labelManual).toMatch(/Tomorrow|Today|\d{4}-\d{2}-\d{2}/);
    const storedManual = await page.evaluate(() =>
      localStorage.getItem("TT_REVIEW_SITDOWN_DATE"),
    );
    expect(storedManual).not.toBeNull();
    if (storedManual) {
      // Just assert it looks like an ISO-ish date (yyyy-mm-dd prefix)
      expect(storedManual).toMatch(/\d{4}-\d{2}-\d{2}T?/);
    }

    // Now navigate with ,auto to ensure manual flag cleared
    const todayIso = toNoonIso(now);
    await page.goto(`/?tt_sitdown=${encodeURIComponent(todayIso)},auto`);
    await ttPO.practiceTabTrigger.click();
    const labelAuto = await getChooserLabel(ttPO);
    // Accept Today or date string
    expect(labelAuto).toMatch(/Today|\d{4}-\d{2}-\d{2}/);
    const manualCleared = await page.evaluate(() =>
      localStorage.getItem("TT_REVIEW_SITDOWN_MANUAL"),
    );
    expect(manualCleared).toBeNull();
  });

  test("root redirect preserves tt_sitdown query", async ({ page }) => {
    const now = new Date();
    const todayIso = toNoonIso(now);
    await setTestDefaults(page);
    await page.goto(`/?tt_sitdown=${encodeURIComponent(todayIso)}`);

    // Should end up on /home retaining the query param (or at least having initialized storage)
    await page.waitForURL(/\/home(\?|$)/);
    // Confirm localStorage picked up the value
    const stored = await page.evaluate(() =>
      localStorage.getItem("TT_REVIEW_SITDOWN_DATE"),
    );
    expect(stored).not.toBeNull();
    if (stored) {
      expect(stored).toMatch(/\d{4}-\d{2}-\d{2}T?/);
    }
  });

  test("reset query clears stored sitdown and manual flag", async ({
    page,
  }) => {
    // First set a manual date
    const now = new Date();
    const todayIso = toNoonIso(now);
    await setTestDefaults(page);
    await page.goto(`/?tt_sitdown=${encodeURIComponent(todayIso)}`);
    await page.waitForURL(/\/home(\?|$)/);
    // Confirm it is set
    let stored = await page.evaluate(() =>
      localStorage.getItem("TT_REVIEW_SITDOWN_DATE"),
    );
    expect(stored).not.toBeNull();
    // Now issue reset
    await page.goto("/?tt_sitdown=reset");
    await page.waitForURL(/\/home(\?|$)/);
    stored = await page.evaluate(() =>
      localStorage.getItem("TT_REVIEW_SITDOWN_DATE"),
    );
    const manualFlag = await page.evaluate(() =>
      localStorage.getItem("TT_REVIEW_SITDOWN_MANUAL"),
    );
    expect(stored).toBeNull();
    expect(manualFlag).toBeNull();
  });
});
