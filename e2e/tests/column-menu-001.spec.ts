import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe("Column Visibility Menu", () => {
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID, TEST_TUNE_MORRISON_ID], // User's 2 private tunes
      scheduleTunes: false,
    });
  });

  test("should keep menu open when clicking checkbox", async ({ page }) => {
    // Navigate to Repertoire tab
    await ttPage.repertoireTab.click();
    await page.waitForTimeout(1000);

    // Click the Columns button to open menu
    const columnsButton = page
      .getByRole("button", { name: /columns/i })
      .first();
    await columnsButton.click();
    await page.waitForTimeout(500);

    // Check that menu is visible
    const menu = page
      .locator("div.fixed.w-64")
      .filter({ hasText: "Show Columns" });
    await expect(menu).toBeVisible();

    // Log initial state
    console.log("Menu is visible");

    // Find the first button item that has a checkbox (skip "Show All" and "Hide All" buttons)
    const allButtons = await menu.getByRole("button").all();
    let firstButtonWithCheckbox = null;
    let firstCheckbox = null;

    for (const button of allButtons) {
      const checkbox = button.locator('input[type="checkbox"]');
      const hasCheckbox = (await checkbox.count()) > 0;
      if (hasCheckbox) {
        firstButtonWithCheckbox = button;
        firstCheckbox = checkbox;
        break;
      }
    }

    if (!firstButtonWithCheckbox || !firstCheckbox) {
      throw new Error("No button with checkbox found in menu");
    }

    await expect(firstButtonWithCheckbox).toBeVisible();
    await expect(firstCheckbox).toBeVisible();

    const isCheckedBefore = await firstCheckbox.isChecked();
    console.log("Checkbox checked before:", isCheckedBefore);

    // Click the button (not the checkbox) to toggle
    await firstButtonWithCheckbox.click();
    await page.waitForTimeout(500);

    // Check if menu is still visible
    const menuStillVisible = await menu.isVisible();
    console.log("Menu still visible after checkbox click:", menuStillVisible);

    // Check if checkbox state changed
    const isCheckedAfter = await firstCheckbox.isChecked();
    console.log("Checkbox checked after:", isCheckedAfter);

    // Assertions
    await expect(menu).toBeVisible(); // Menu should stay open
    expect(isCheckedAfter).not.toBe(isCheckedBefore); // Checkbox should toggle
  });

  test("should close menu when clicking outside", async ({ page }) => {
    // Navigate to Repertoire tab
    await ttPage.repertoireTab.click();
    await page.waitForTimeout(1000);

    // Click the Columns button to open menu
    const columnsButton = ttPage.columnsButton;
    await columnsButton.click();
    await page.waitForTimeout(500);

    // Check that menu is visible
    const menu = page
      .locator("div.fixed.w-64")
      .filter({ hasText: "Show Columns" });
    await expect(menu).toBeVisible();

    // Click outside the menu
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);

    // Menu should be hidden
    await expect(menu).not.toBeVisible();
  });
});
