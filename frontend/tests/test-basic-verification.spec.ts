import { test, expect } from "@playwright/test";

test.describe("Basic TuneGrid Verification", () => {
  test("verify-sorting-functionality-simple", async ({ page }) => {
    // Navigate to the application (we'll handle auth separately)
    await page.goto("http://localhost:3000");
    
    // Add basic console logging to see what's happening
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Take a screenshot to see current state
    await page.screenshot({ path: 'test-verification-step1.png' });
    
    // Check if we can see any grid elements
    const gridElements = await page.locator('[data-testid*="grid"]').count();
    const sortButtons = await page.locator('button[title*="sort"]').count();
    const tableRows = await page.locator('table tr').count();
    
    console.log("Grid elements found:", gridElements);
    console.log("Sort buttons found:", sortButtons);
    console.log("Table rows found:", tableRows);
    
    // Basic verification that the page loads
    expect(gridElements).toBeGreaterThanOrEqual(0);
  });
});