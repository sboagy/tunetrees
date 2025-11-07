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

import { expect } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

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
      ttPage.navigateToTab("catalog");
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Select first 3 tunes using checkboxes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]',
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
      ttPage.navigateToTab("repertoire");

      // Ensure grid is hydrated and checkboxes are rendered: header + 2 rows (>= 3 checkboxes)
      await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
        timeout: 10000,
      });
      await page.waitForFunction(
        (sel) => document.querySelectorAll(sel).length >= 3,
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]',
      );

      // Select first 2 tunes using checkboxes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]',
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
        '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]',
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
      ttPage.navigateToTab("catalog");
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Select 2 tunes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]',
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

    test("Catalog: selections persist after browser refresh", async ({
      page,
    }) => {
      // Navigate to Catalog tab
      ttPage.navigateToTab("catalog");
      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 5000,
      });

      // Select 3 tunes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]',
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
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]',
      );
      await expect(checkboxesAfterReload.nth(1)).toBeChecked();
      await expect(checkboxesAfterReload.nth(2)).toBeChecked();
      await expect(checkboxesAfterReload.nth(3)).toBeChecked();
    });

    test("Repertoire: selections persist after browser refresh", async ({
      page,
    }) => {
      // Navigate to Repertoire tab
      ttPage.navigateToTab("repertoire");

      // Ensure checkboxes are rendered: header + 2 rows (>= 3 checkboxes)
      await page.waitForFunction(
        (sel) => document.querySelectorAll(sel).length >= 3,
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]',
      );

      // Select 2 tunes
      const checkboxes = page.locator(
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]',
      );
      await expect(checkboxes.nth(1)).toBeEnabled({ timeout: 10000 });
      await checkboxes.nth(1).check();
      await page.waitForTimeout(250);
      await expect(checkboxes.nth(1)).toBeChecked();

      // Take a visual snapshot for debugging / CI artifacts
      await page.screenshot({
        path: `e2e/artifacts/repertoire-selection-before-second-${Date.now()}.png`,
        fullPage: false,
      });
      await expect(checkboxes.nth(2)).toBeEnabled({ timeout: 10000 });
      await checkboxes.nth(2).check();
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
        '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]',
      );
      await expect(checkboxesAfterReload.nth(1)).toBeChecked();
      await expect(checkboxesAfterReload.nth(2)).toBeChecked();
    });
  });
