/**
 * E2E Test: Row Selection Persistence
 *
 * Bug #2: Row selections in Catalog and Repertoire tabs should persist
 * across tab switches and browser sessions (stored in localStorage).
 *
 * Test scenarios:
 * 1. Catalog: Select tunes, switch tabs, return → verify selections intact
 * 2. Repertoire: Select tunes, switch tabs, return → verify selections intact
 * 3. Clear selections, switch tabs → verify selections cleared
 * 4. Select tunes, refresh browser → verify selections persist
 */

import { expect, type Page } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { waitForSyncComplete } from "../helpers/local-db-lifecycle";
import {
  setupForCatalogTestsParallel,
  setupForRepertoireTestsParallel,
} from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

async function openCatalogSync(page: Page, ttPage: TuneTreesPage) {
  await ttPage.userMenuButton.click();
  await page.waitForTimeout(500);
  await ttPage.userSettingsButton.click();
  await page.waitForTimeout(1500);

  // Only run the mobile menu toggle on Mobile Chrome
  const ua = await page.evaluate(() => navigator.userAgent);
  const isMobileChrome = /Android.*Chrome\/\d+/i.test(ua);
  if (isMobileChrome) {
    await page.waitForTimeout(800);
    await ttPage.settingsMenuToggle.click();
  }

  await page.waitForTimeout(500);
  await ttPage.userSettingsCatalogSyncButton.click();
  await page.waitForTimeout(500);

  // Close mobile sidebar overlay after navigation
  if (isMobileChrome) {
    const { innerWidth, innerHeight } = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    }));
    await page.mouse.click(innerWidth - 5, Math.floor(innerHeight / 2));
    await page.waitForTimeout(300);
  }
}

test.describe
  .serial("Row Selection Persistence", () => {
    let ttPage: TuneTreesPage;

    test.slow();

    test.beforeEach(async ({ page, testUser }) => {
      // Setup: Seed several tunes in repertoire for selection testing
      // Using known valid tune IDs: testUserPrivateTune1 (Banish Misfortune), TEST_TUNE_MORRISON_ID (Morrison's Jig)
      // Start on catalog tab since most tests begin there
      const { privateTune1Id } = getPrivateTuneIds(testUser.userId);
      await setupForRepertoireTestsParallel(page, testUser, {
        repertoireTunes: [privateTune1Id, TEST_TUNE_MORRISON_ID], // Only 2 tunes that we know exist
        scheduleTunes: false,
      });

      ttPage = new TuneTreesPage(page);

      console.debug("Row Selection Persistence: setup complete");
    });

    test("Catalog: selections persist across tab switches", async ({
      page,
    }) => {
      // Navigate to Catalog tab
      await ttPage.navigateToTab("catalog");
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Select first 3 tunes using checkboxes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]'
      );
      await checkboxes.nth(1).check(); // Skip header checkbox, select row 1
      await checkboxes.nth(2).check();
      await checkboxes.nth(3).check();

      // Verify selection summary shows "3 tunes selected"
      await expect(page.locator("text=3 tunes selected")).toBeVisible();

      // Switch to Practice tab
      await page.click('button:has-text("Practice")');
      await page.waitForTimeout(500);

      // Switch back to Catalog tab
      await page.click('button:has-text("Catalog")');
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Verify selections are still intact
      await expect(page.locator("text=3 tunes selected")).toBeVisible();
      await expect(checkboxes.nth(1)).toBeChecked();
      await expect(checkboxes.nth(2)).toBeChecked();
      await expect(checkboxes.nth(3)).toBeChecked();
    });

    test("Repertoire: selections persist across tab switches", async ({
      page,
    }) => {
      // Navigate to Repertoire tab
      await ttPage.navigateToTab("repertoire");

      // Ensure grid is hydrated and checkboxes are rendered: header + 2 rows (>= 3 checkboxes)
      await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
        timeout: 10000,
      });
      await page.waitForFunction(
        (sel) => document.querySelectorAll(sel).length >= 3,
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
      );

      // Select first 2 tunes using checkboxes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
      );
      await checkboxes.nth(1).check(); // Skip header checkbox, select row 1
      // Take a visual snapshot for debugging / CI artifacts
      await page.screenshot({
        path: `e2e/artifacts/repertoire-selection-mid-${Date.now()}.png`,
        fullPage: false,
      });
      await page.waitForTimeout(250);
      await checkboxes.nth(2).check();

      // Verify selection summary shows "2 tunes selected"
      await expect(page.locator("text=2 tunes selected")).toBeVisible();

      // Switch to Catalog tab
      await page.click('button:has-text("Catalog")');
      await page.waitForTimeout(500);

      // Switch back to Repertoire tab
      await page.click('button:has-text("Repertoire")');
      await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
        timeout: 5000,
      });

      // Ensure checkboxes are still present
      await page.waitForFunction(
        (sel) => document.querySelectorAll(sel).length >= 2,
        '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
      );

      // Verify selections are still intact
      await expect(page.locator("text=2 tunes selected")).toBeVisible();
      await expect(checkboxes.nth(1)).toBeChecked();
      await expect(checkboxes.nth(2)).toBeChecked();
    });

    test("Catalog: clearing selections persists across tab switches", async ({
      page,
    }) => {
      // Navigate to Catalog tab
      await ttPage.navigateToTab("catalog");
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Select 2 tunes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]'
      );
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();
      await expect(page.locator("text=2 tunes selected")).toBeVisible();

      // Clear selection using "Clear selection" button
      await page.click('button:has-text("Clear selection")');
      await expect(page.locator("text=2 tunes selected")).not.toBeVisible();

      // Switch tabs and return
      await page.click('button:has-text("Practice")');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Catalog")');
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Verify no selections remain
      await expect(page.locator("text=tunes selected")).not.toBeVisible();
      await expect(checkboxes.nth(1)).not.toBeChecked();
      await expect(checkboxes.nth(2)).not.toBeChecked();
    });

    test("Catalog: selections and catalog list STAY THE SAME after browser refresh", async ({
      page,
    }) => {
      // Navigate to Catalog tab
      ttPage.navigateToTab("catalog");
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Select 3 tunes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]'
      );
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();
      await checkboxes.nth(3).check();
      await expect(page.locator("text=3 tunes selected")).toBeVisible();

      // Refresh the page (simulates browser refresh)
      await page.reload();
      await page.waitForTimeout(2000); // Wait for sync after reload

      // Navigate back to Catalog tab
      await page.click('button:has-text("Catalog")');
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Verify selections persisted through refresh (from localStorage)
      await expect(page.locator("text=3 tunes selected")).toBeVisible();
      const checkboxesAfterReload = page.locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]'
      );
      await expect(checkboxesAfterReload.nth(1)).toBeChecked();
      await expect(checkboxesAfterReload.nth(2)).toBeChecked();
      await expect(checkboxesAfterReload.nth(3)).toBeChecked();
    });

    test("Catalog: selections persist after browser refresh", async ({
      page,
    }) => {
      // Navigate to Catalog tab
      await ttPage.navigateToTab("catalog");
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Select 3 tunes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]'
      );
      const checkbox1 = checkboxes.nth(1);
      const checkbox2 = checkboxes.nth(2);
      const checkbox3 = checkboxes.nth(3);

      await checkbox1.check();
      await checkbox2.check();
      await checkbox3.check();
      await expect(page.locator("text=3 tunes selected")).toBeVisible();

      const label1 = await checkbox1.getAttribute("aria-label");
      const label2 = await checkbox2.getAttribute("aria-label");
      const label3 = await checkbox3.getAttribute("aria-label");

      expect(label1).toBeTruthy();
      expect(label2).toBeTruthy();
      expect(label3).toBeTruthy();

      const tuneId1 = label1?.replace(/^Select row\s*/i, "").trim();
      const tuneId2 = label2?.replace(/^Select row\s*/i, "").trim();
      const tuneId3 = label3?.replace(/^Select row\s*/i, "").trim();

      expect(tuneId1).toBeTruthy();
      expect(tuneId2).toBeTruthy();
      expect(tuneId3).toBeTruthy();

      // Refresh the page (simulates browser refresh)
      await page.reload();
      await page.waitForTimeout(2000); // Wait for sync after reload

      // Navigate back to Catalog tab
      await ttPage.navigateToTab("catalog");

      // Verify selections persisted through refresh (from localStorage)
      await expect(page.locator("text=3 tunes selected")).toBeVisible();
      const checkboxAfterReload1 = page.locator(
        `[data-testid="tunes-grid-catalog"] input[type="checkbox"][aria-label="Select row ${tuneId1}"]`
      );
      const checkboxAfterReload2 = page.locator(
        `[data-testid="tunes-grid-catalog"] input[type="checkbox"][aria-label="Select row ${tuneId2}"]`
      );
      const checkboxAfterReload3 = page.locator(
        `[data-testid="tunes-grid-catalog"] input[type="checkbox"][aria-label="Select row ${tuneId3}"]`
      );

      await expect(checkboxAfterReload1).toBeChecked({ timeout: 10000 });
      await expect(checkboxAfterReload2).toBeChecked({ timeout: 10000 });
      await expect(checkboxAfterReload3).toBeChecked({ timeout: 10000 });
    });

    test("Repertoire: selections persist after browser refresh", async ({
      page,
    }) => {
      // Navigate to Repertoire tab
      await ttPage.navigateToTab("repertoire");

      // Ensure checkboxes are rendered: header + 2 rows (>= 3 checkboxes)
      await page.waitForFunction(
        (sel) => document.querySelectorAll(sel).length >= 3,
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
      );

      // Select 2 tunes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
      );
      await expect(checkboxes.nth(1)).toBeEnabled({ timeout: 10000 });
      await checkboxes.nth(1).scrollIntoViewIfNeeded();
      await checkboxes.nth(1).check({ force: true });
      await page.waitForTimeout(250);
      await expect(checkboxes.nth(1)).toBeChecked();

      // Take a visual snapshot for debugging / CI artifacts
      await page.screenshot({
        path: `e2e/artifacts/repertoire-selection-before-second-${Date.now()}.png`,
        fullPage: false,
      });
      await expect(checkboxes.nth(2)).toBeEnabled({ timeout: 10000 });
      await checkboxes.nth(2).scrollIntoViewIfNeeded();
      await checkboxes.nth(2).check({ force: true });
      await page.waitForTimeout(250);
      await expect(checkboxes.nth(2)).toBeChecked();

      await expect(page.locator("text=2 tunes selected")).toBeVisible();

      // Refresh the page
      await page.reload();
      await page.waitForTimeout(2000); // Wait for sync after reload

      // Navigate back to Repertoire tab
      await page.click('button:has-text("Repertoire")');
      await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
        timeout: 5000,
      });

      // Verify selections persisted through refresh
      await expect(page.locator("text=2 tunes selected")).toBeVisible();
      const checkboxesAfterReload = page.locator(
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
      );
      await expect(checkboxesAfterReload.nth(1)).toBeChecked();
      await expect(checkboxesAfterReload.nth(2)).toBeChecked();
    });
  });

test.describe
  .serial("Catalog genre selection refresh filter", () => {
    let ttPage: TuneTreesPage;
    let injectedUserId: string;

    test.slow();

    test.beforeEach(async ({ page, testUser }) => {
      ttPage = new TuneTreesPage(page);
      injectedUserId = testUser.userId;

      await setupForCatalogTestsParallel(page, testUser, {
        emptyRepertoire: true,
        startTab: "catalog",
      });

      await page.evaluate((userId) => {
        window.__ttTestUserId = userId;
      }, injectedUserId);
    });

    test("Catalog: selection remains filtered after refresh", async ({
      page,
    }) => {
      const ensureTestUserId = async () => {
        await expect
          .poll(
            () =>
              page.evaluate(() =>
                Boolean(
                  (window as unknown as { __ttTestApi?: unknown }).__ttTestApi
                )
              ),
            {
              timeout: 10000,
              intervals: [100, 250, 500, 1000],
            }
          )
          .toBe(true);
        await page.evaluate((userId) => {
          window.__ttTestApi?.setTestUserId(userId);
        }, injectedUserId);
      };

      await openCatalogSync(page, ttPage);

      await expect(
        page.getByRole("heading", { name: "Catalog & Sync" })
      ).toBeVisible({ timeout: 5000 });

      const selectable = page.locator(
        '[data-testid^="settings-genre-checkbox-"]:not(:disabled)'
      );
      await expect
        .poll(() => selectable.count(), {
          timeout: 15000,
          intervals: [100, 250, 500, 1000],
        })
        .toBeGreaterThan(0);

      await page.getByTestId("settings-genre-clear-all").click();

      const firstCheckbox = selectable.first();
      const testId = await firstCheckbox.getAttribute("data-testid");
      expect(testId).toBeTruthy();
      const chosenGenreId = (testId ?? "").replace(
        "settings-genre-checkbox-",
        ""
      );
      expect(chosenGenreId).not.toEqual("");

      await firstCheckbox.setChecked(true);

      const saveButton = page.getByTestId("settings-genre-save");
      await expect(saveButton).toBeEnabled({ timeout: 5000 });

      const syncVersionBefore = await page.evaluate(() => {
        const el = document.querySelector(
          "[data-auth-initialized]"
        ) as HTMLElement | null;
        const versionStr = el?.getAttribute("data-sync-version") || "0";
        return Number.parseInt(versionStr, 10) || 0;
      });

      await saveButton.click();
      await expect(saveButton).toBeDisabled({ timeout: 20000 });

      await expect
        .poll(async () => {
          return page.evaluate(() => {
            const el = document.querySelector(
              "[data-auth-initialized]"
            ) as HTMLElement | null;
            const versionStr = el?.getAttribute("data-sync-version") || "0";
            return Number.parseInt(versionStr, 10) || 0;
          });
        })
        .toBeGreaterThan(syncVersionBefore);

      await page.getByTestId("settings-close-button").click();
      await page
        .getByTestId("settings-modal")
        .waitFor({ state: "hidden", timeout: 10000 });

      await ttPage.navigateToTab("catalog");

      await ensureTestUserId();
      const diagBefore = await page.evaluate(async () => {
        return window.__ttTestApi?.getCatalogSelectionDiagnostics();
      });
      const countsBefore = await page.evaluate(async () => {
        return window.__ttTestApi?.getCatalogTuneCountsForUser();
      });

      expect(diagBefore?.selectedGenreIds ?? []).toContain(chosenGenreId);
      expect(countsBefore?.total ?? 0).toBeGreaterThan(0);
      expect(countsBefore?.filtered ?? 0).toBeGreaterThan(0);
      expect(countsBefore?.filtered ?? 0).toBeLessThanOrEqual(
        countsBefore?.total ?? 0
      );

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForSyncComplete(page);
      await page.evaluate((userId) => {
        window.__ttTestUserId = userId;
      }, injectedUserId);
      await ttPage.navigateToTab("catalog");

      await ensureTestUserId();
      const diagAfter = await page.evaluate(async () => {
        return window.__ttTestApi?.getCatalogSelectionDiagnostics();
      });
      const countsAfter = await page.evaluate(async () => {
        return window.__ttTestApi?.getCatalogTuneCountsForUser();
      });

      expect(diagAfter?.selectedGenreIds ?? []).toContain(chosenGenreId);
      expect(countsAfter?.total ?? 0).toBeGreaterThan(0);
      expect(countsAfter?.filtered ?? 0).toBeGreaterThan(0);
      expect(countsAfter?.filtered ?? 0).toBeLessThanOrEqual(
        countsAfter?.total ?? 0
      );
    });
  });
