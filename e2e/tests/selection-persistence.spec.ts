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

import { expect, test } from "@playwright/test";
import { setupForRepertoireTests } from "../helpers/practice-scenarios";

test.use({ storageState: "e2e/.auth/alice.json" });

test.describe("Row Selection Persistence", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Seed several tunes in repertoire for selection testing
    // Using known valid tune IDs: 9001 (Banish Misfortune), 3497 (Morrison's Jig)
    // Start on catalog tab since most tests begin there
    await setupForRepertoireTests(page, {
      repertoireTunes: [9001, 3497], // Only 2 tunes that we know exist
      scheduleTunes: false,
    });

    // Navigate to catalog tab for tests that start there
    await page.click('button:has-text("Catalog")');
    await page.waitForTimeout(500);
  });

  test("Catalog: selections persist across tab switches", async ({ page }) => {
    // Navigate to Catalog tab
    await page.click('button:has-text("Catalog")');
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
    const repertoireTabSelector = page.getByTestId("tab-repertoire");
    await repertoireTabSelector.isVisible();
    repertoireTabSelector.click();

    // Select first 2 tunes using checkboxes
    const checkboxes = page.locator(
      '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
    );
    await checkboxes.nth(1).isVisible();
    await checkboxes.nth(1).check(); // Skip header checkbox, select row 1
    await checkboxes.nth(2).isVisible();
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

    // Verify selections are still intact
    await expect(page.locator("text=2 tunes selected")).toBeVisible();
    await expect(checkboxes.nth(1)).toBeChecked();
    await expect(checkboxes.nth(2)).toBeChecked();
  });

  test("Catalog: clearing selections persists across tab switches", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await page.click('button:has-text("Catalog")');
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

  test("Catalog: selections persist after browser refresh", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await page.click('button:has-text("Catalog")');
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

  test("Repertoire: selections persist after browser refresh", async ({
    page,
  }) => {
    // Navigate to Repertoire tab
    await page.click('button:has-text("Repertoire")');
    await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
      timeout: 5000,
    });

    // Select 2 tunes
    const checkboxes = page.locator(
      '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
    );
    await checkboxes.nth(1).check();
    await page.waitForTimeout(250);
    await expect(checkboxes.nth(1)).toBeChecked();

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
      '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
    );
    await expect(checkboxesAfterReload.nth(1)).toBeChecked();
    await expect(checkboxesAfterReload.nth(2)).toBeChecked();
  });
});
