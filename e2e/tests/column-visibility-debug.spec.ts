import { test, expect } from "@playwright/test";

test.describe("Column Visibility Menu Debug", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:4173/catalog");
    await page.waitForLoadState("networkidle");
    
    // Switch to Repertoire tab
    await page.getByRole("tab", { name: /repertoire/i }).click();
    await page.waitForTimeout(500);
  });

  test("should keep menu open when clicking checkbox", async ({ page }) => {
    // Open column visibility menu
    const columnsButton = page.getByRole("button", { name: /columns/i });
    await columnsButton.click();
    
    // Wait for menu to appear
    await page.waitForSelector('text="Show Columns"');
    
    // Get a checkbox
    const checkbox = page.locator('input[type="checkbox"]').first();
    const initialState = await checkbox.isChecked();
    
    console.log("Initial checkbox state:", initialState);
    
    // Click the checkbox
    await checkbox.click();
    
    // Wait a bit
    await page.waitForTimeout(200);
    
    // Check if menu is still visible
    const menuVisible = await page.locator('text="Show Columns"').isVisible();
    console.log("Menu visible after checkbox click:", menuVisible);
    
    // Check if checkbox state changed
    const newState = await checkbox.isChecked();
    console.log("New checkbox state:", newState);
    console.log("State changed:", initialState !== newState);
    
    expect(menuVisible).toBe(true);
    expect(newState).toBe(!initialState);
  });

  test("should close menu when clicking outside", async ({ page }) => {
    // Open column visibility menu
    const columnsButton = page.getByRole("button", { name: /columns/i });
    await columnsButton.click();
    
    // Wait for menu to appear
    await page.waitForSelector('text="Show Columns"');
    
    // Click outside the menu
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    
    // Wait a bit
    await page.waitForTimeout(200);
    
    // Check if menu is closed
    const menuVisible = await page.locator('text="Show Columns"').isVisible();
    console.log("Menu visible after outside click:", menuVisible);
    
    expect(menuVisible).toBe(false);
  });
});
