import { expect, test } from "@playwright/test";
import { checkHealth } from "@/test-scripts/check-servers";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "@/test-scripts/test-logging";
import { TuneEditorPageObject } from "@/test-scripts/tune-editor.po";
import { setTestDefaults } from "../test-scripts/set-test-defaults";

/**
 * Test suite for Tune Editor double-click functionality.
 *
 * These tests verify that:
 * 1. Double-clicking a tune row opens the tune editor
 * 2. The editor replaces the entire tabs area
 * 3. The current tune is synced between editor and sidebar
 * 4. Cancel/Save operations work correctly after double-click opening
 */

test.setTimeout(process.env.CI ? 120_000 : 300_000);

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await page.waitForTimeout(1_000);
  await restartBackend();
  await page.waitForTimeout(1_000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test.describe.serial("Tune Editor Double-Click Tests", () => {
  test("Double-click opens tune editor and replaces tabs area", async ({
    page,
  }) => {
    const ttPO = new TuneEditorPageObject(page);
    await ttPO.gotoMainPage();
    await page.waitForTimeout(1000);

    // Navigate to a specific tune (selects it)
    await ttPO.navigateToTune("Lakes of Sligo");

    // Verify tune is selected in the grid
    await expect(ttPO.currentTuneTitle).toHaveText("Lakes of Sligo", {
      timeout: 10_000,
    });

    // Verify tabs are visible before opening editor
    const tabsContainer = page
      .locator('[data-testid="tt-tabs-container"]')
      .or(page.locator("#tab-group-main"));
    await expect(tabsContainer).toBeVisible({ timeout: 10_000 });

    // Double-click to open editor
    console.log("===> Double-clicking to open tune editor");
    await ttPO.openTuneEditorByDoubleClick();

    // Verify editor form is visible
    await expect(ttPO.form).toBeVisible({ timeout: 15_000 });

    // Verify editor title shows correct tune
    await expect(ttPO.IdTitle).toContainText("Tune #", { timeout: 10_000 });

    // Verify tabs are NOT visible (editor replaced them)
    await expect(tabsContainer).not.toBeVisible();

    // Verify the tune title field matches selected tune
    const titleInput = ttPO.ffTitle.locator("input");
    await expect(titleInput).toHaveValue("Lakes of Sligo", { timeout: 10_000 });

    console.log("===> Test completed: Editor opened via double-click");
  });

  test("Double-click editor maintains current tune sync", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);
    await ttPO.gotoMainPage();
    await page.waitForTimeout(1000);

    // Select first tune
    await ttPO.navigateToTune("Boyne Hunt");
    const firstTune = await ttPO.currentTuneTitle.textContent();
    console.log(`===> First tune selected: ${firstTune}`);

    // Open editor via double-click
    await ttPO.openTuneEditorByDoubleClick();
    await expect(ttPO.form).toBeVisible({ timeout: 15_000 });

    // Verify editor shows the correct tune
    const titleInput = ttPO.ffTitle.locator("input");
    await expect(titleInput).toHaveValue("Boyne Hunt", { timeout: 10_000 });

    // Verify sidebar still shows the same tune as current
    // (The currentTuneTitle should still be visible in sidebar)
    await expect(ttPO.currentTuneTitle).toHaveText("Boyne Hunt", {
      timeout: 10_000,
    });

    console.log(
      "===> Test completed: Current tune synced between editor and sidebar",
    );
  });

  test("Cancel after double-click returns to tabs view", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);
    await ttPO.gotoMainPage();
    await page.waitForTimeout(1000);

    // Navigate and open editor via double-click
    await ttPO.navigateToTune("Lakes of Sligo");
    await ttPO.openTuneEditorByDoubleClick();
    await expect(ttPO.form).toBeVisible({ timeout: 15_000 });

    // Make a change to verify cancel doesn't save
    const titleInput = ttPO.ffTitle.locator("input");
    await titleInput.fill("Lakes of Sligo - Modified");
    await page.waitForTimeout(500);
    await expect(titleInput).toHaveValue("Lakes of Sligo - Modified");

    // Cancel the editor
    console.log("===> Clicking Cancel button");
    await ttPO.pressCancel();

    // Verify editor is closed (form not visible)
    await expect(ttPO.form).not.toBeVisible({ timeout: 15_000 });

    // Verify tabs are visible again
    const tabsContainer = page
      .locator('[data-testid="tt-tabs-container"]')
      .or(page.locator("#tab-group-main"));
    await expect(tabsContainer).toBeVisible({ timeout: 10_000 });

    // Verify the tune was NOT changed in the grid
    await ttPO.navigateToTune("Lakes of Sligo");
    await expect(ttPO.currentTuneTitle).toHaveText("Lakes of Sligo", {
      timeout: 10_000,
    });

    // Verify if we reopen editor, the original value is there
    await ttPO.openTuneEditorByDoubleClick();
    await expect(titleInput).toHaveValue("Lakes of Sligo", { timeout: 10_000 });

    console.log(
      "===> Test completed: Cancel returns to tabs, no changes saved",
    );
  });

  test("Save after double-click persists changes and returns to tabs", async ({
    page,
  }) => {
    const ttPO = new TuneEditorPageObject(page);
    await ttPO.gotoMainPage();
    await page.waitForTimeout(1000);

    // Navigate and open editor via double-click
    await ttPO.navigateToTune("Lakes of Sligo");
    await ttPO.openTuneEditorByDoubleClick();
    await expect(ttPO.form).toBeVisible({ timeout: 15_000 });

    // Make a change
    const titleInput = ttPO.ffTitle.locator("input");
    await titleInput.fill("Lakes of Sligo - Double Click Test");
    await page.waitForTimeout(500);
    await expect(titleInput).toHaveValue("Lakes of Sligo - Double Click Test");

    // Save the changes
    console.log("===> Clicking Save button");
    await ttPO.pressSave();

    // Verify editor is closed
    await expect(ttPO.form).not.toBeVisible({ timeout: 15_000 });

    // Verify tabs are visible again
    const tabsContainer = page
      .locator('[data-testid="tt-tabs-container"]')
      .or(page.locator("#tab-group-main"));
    await expect(tabsContainer).toBeVisible({ timeout: 10_000 });

    // Verify the tune was changed
    await expect(ttPO.currentTuneTitle).toHaveText(
      "Lakes of Sligo - Double Click Test",
      { timeout: 10_000 },
    );

    // Verify we can find it in the grid with new name
    await ttPO.navigateToTune("Lakes of Sligo - Double Click Test");
    await expect(ttPO.currentTuneTitle).toHaveText(
      "Lakes of Sligo - Double Click Test",
      { timeout: 10_000 },
    );

    console.log(
      "===> Test completed: Save persists changes and returns to tabs",
    );
  });

  test("Double-click on different rows opens correct tune", async ({
    page,
  }) => {
    const ttPO = new TuneEditorPageObject(page);
    await ttPO.gotoMainPage();
    await page.waitForTimeout(1000);

    // Test opening different tunes
    const testTunes = ["Boyne Hunt", "Trip to Durrow"];

    for (const tuneName of testTunes) {
      console.log(`===> Testing double-click for: ${tuneName}`);

      // Navigate to tune (selects it)
      await ttPO.navigateToTune(tuneName);
      await expect(ttPO.currentTuneTitle).toHaveText(tuneName, {
        timeout: 10_000,
      });

      // Open via double-click
      await ttPO.openTuneEditorByDoubleClick();
      await expect(ttPO.form).toBeVisible({ timeout: 15_000 });

      // Verify correct tune is loaded
      const titleInput = ttPO.ffTitle.locator("input");
      await expect(titleInput).toHaveValue(tuneName, { timeout: 10_000 });

      // Close editor
      await ttPO.pressCancel();
      await expect(ttPO.form).not.toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(500);
    }

    console.log(
      "===> Test completed: Multiple tunes opened correctly via double-click",
    );
  });

  test("Escape key closes editor opened via double-click", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);
    await ttPO.gotoMainPage();
    await page.waitForTimeout(1000);

    // Navigate and open editor via double-click
    await ttPO.navigateToTune("Boyne Hunt");
    await ttPO.openTuneEditorByDoubleClick();
    await expect(ttPO.form).toBeVisible({ timeout: 15_000 });

    // Press Escape key
    console.log("===> Pressing Escape key");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);

    // Verify editor is closed
    await expect(ttPO.form).not.toBeVisible({ timeout: 15_000 });

    // Verify tabs are visible again
    const tabsContainer = page
      .locator('[data-testid="tt-tabs-container"]')
      .or(page.locator("#tab-group-main"));
    await expect(tabsContainer).toBeVisible({ timeout: 10_000 });

    console.log("===> Test completed: Escape key closes editor");
  });
});
