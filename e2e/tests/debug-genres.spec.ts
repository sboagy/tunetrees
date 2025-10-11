import { test } from "@playwright/test";

test("debug genre loading", async ({ page }) => {
  // Listen to console logs
  page.on("console", (msg) => {
    console.log("🔍 Console:", msg.text());
  });

  // Navigate to catalog
  await page.goto("http://localhost:5173/catalog", {
    timeout: 10000,
    waitUntil: "domcontentloaded",
  });

  // Wait for the combined filter button to be visible and clickable
  const filterButton = page.locator('[data-testid="combined-filter-button"]');
  await filterButton.waitFor({ state: "visible", timeout: 10000 });

  // Click the filter dropdown
  await filterButton.click();

  // Wait for dropdown content to appear
  await page.locator('[data-testid="combined-filter-dropdown"]').waitFor({
    state: "visible",
    timeout: 5000,
  });

  // Take a screenshot
  await page.screenshot({ path: "debug-genre-dropdown.png" });

  console.log("Genre debugging completed");
});
