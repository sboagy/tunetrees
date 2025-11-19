import { expect, test } from "@playwright/test";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";
import { getStorageState } from "@/test-scripts/storage-state";
import {
  logBrowserContextStart,
  logTestStart,
} from "@/test-scripts/test-logging";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";

// Use storage state for auth
test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
});

// Standard logging hooks
// NOTE: We purposely avoid navigation inside beforeEach; tests control navigation flow
// to allow distinct scenarios (tab switch vs full reload).
test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

async function getScrollTop(
  page: import("@playwright/test").Page,
): Promise<number> {
  const val = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="tunes-grid-scroll-container"]',
    );
    return el ? (el as HTMLElement).scrollTop : -1;
  });
  return Number(val);
}

async function scrollGrid(
  page: import("@playwright/test").Page,
  targetScroll: number,
) {
  await page.evaluate((y: number) => {
    const el = document.querySelector(
      '[data-testid="tunes-grid-scroll-container"]',
    );
    if (el) (el as HTMLElement).scrollTo({ top: y });
  }, targetScroll);
}

// Helper: ensure we have enough rows loaded (wait for > 50 rows for meaningful scroll)
async function waitForRowCount(
  page: import("@playwright/test").Page,
  minRows = 10,
): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    // up to 60s
    const count = await page.locator('[data-testid="tunes-grid"] tr').count();
    if (count >= minRows) return count;
    await page.waitForTimeout(500);
  }
  return await page.locator('[data-testid="tunes-grid"] tr').count();
}

// Core scenario: navigate to Practice tab, scroll, switch to Repertoire and back, expect scroll restored
// We choose tab switch rather than full reload to avoid conflating with initial mount heuristics.
test.skip("scroll position persists across tab switch (Repertoire)", async ({
  page,
}) => {
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.navigateToRepertoireTab();
  await waitForRowCount(page, 10);

  const scrollHeight = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="tunes-grid-scroll-container"]',
    );
    return el ? (el as HTMLElement).scrollHeight : 0;
  });
  const targetScroll = Math.min(Math.floor(scrollHeight * 0.6), 1600);
  await scrollGrid(page, targetScroll);
  await page.waitForTimeout(600);

  const recorded = await getScrollTop(page);
  expect(recorded).toBeGreaterThan(800);

  // Switch away (to Practice) then back to Repertoire
  await ttPO.practiceTabTrigger.click();
  await ttPO.practiceTab.waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  await ttPO.repertoireTabTrigger.click();
  await ttPO.repertoireTab.waitFor({ state: "visible" });
  await page.waitForTimeout(900);

  const restored = await getScrollTop(page);
  expect(Math.abs(restored - recorded)).toBeLessThanOrEqual(350);
});

// Secondary scenario: full page reload after scroll retains position (persisted state + restore event)
// This ensures the initial event-dispatch path restores correctly.
// TODO: Debug and fix this test.
test.skip("scroll position persists after reload (Repertoire)", async ({
  page,
}) => {
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.navigateToRepertoireTab();
  await waitForRowCount(page, 10);
  const scrollHeight = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="tunes-grid-scroll-container"]',
    );
    return el ? (el as HTMLElement).scrollHeight : 0;
  });
  const targetScroll = Math.min(Math.floor(scrollHeight * 0.7), 2000);
  await scrollGrid(page, targetScroll);
  await page.waitForTimeout(700);
  const recorded = await getScrollTop(page);
  expect(recorded).toBeGreaterThan(1000);

  await page.reload();
  // After reload, default tab might be Repertoire again (depends on app). Ensure it's visible.
  await ttPO.repertoireTab.waitFor({ state: "visible" });
  await waitForRowCount(page, 300);
  await page.waitForTimeout(1300);
  const restored = await getScrollTop(page);
  expect(Math.abs(restored - recorded)).toBeLessThanOrEqual(400);
});
