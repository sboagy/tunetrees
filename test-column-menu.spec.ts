import { expect, test } from "@playwright/test";

test.describe("Column Visibility Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:4173");
    await page.waitForLoadState("networkidle");
  });

  test("should keep menu open when clicking checkbox", async ({ page }) => {
    // Navigate to Repertoire tab
    await page.getByRole("tab", { name: "Repertoire" }).click();
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

    // Find a checkbox and click it
    const firstCheckbox = menu.locator('input[type="checkbox"]').first();
    const isCheckedBefore = await firstCheckbox.isChecked();
    console.log("Checkbox checked before:", isCheckedBefore);

    // Click the checkbox
    await firstCheckbox.click();
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
    await page.getByRole("tab", { name: "Repertoire" }).click();
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

    // Click outside the menu
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);

    // Menu should be hidden
    await expect(menu).not.toBeVisible();
  });
});
