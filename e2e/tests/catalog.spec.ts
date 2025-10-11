import { expect, test } from "@playwright/test";

test.describe("Catalog Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to catalog page before each test
    await page.goto("/catalog", {
      waitUntil: "domcontentloaded",
    });
  });

  test("should load catalog page", async ({ page }) => {
    // Check that the page loads
    await expect(page).toHaveTitle(/TuneTrees/);

    // Wait for the catalog content to be visible
    await expect(page.locator("h1")).toContainText("Catalog");
  });

  test("should show filter dropdown", async ({ page }) => {
    // Wait for the combined filter button to be visible
    const filterButton = page.locator('[data-testid="combined-filter-button"]');
    await expect(filterButton).toBeVisible();

    // Click the filter dropdown
    await filterButton.click();

    // Wait for dropdown content to appear
    const dropdown = page.locator('[data-testid="combined-filter-dropdown"]');
    await expect(dropdown).toBeVisible();
  });

  test("debug genre loading", async ({ page }) => {
    // Listen to console logs for debugging
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("DEBUG:")) {
        consoleLogs.push(msg.text());
        console.log("🔍 Console:", msg.text());
      }
    });

    // Wait for the combined filter button to be visible and clickable
    const filterButton = page.locator('[data-testid="combined-filter-button"]');
    await expect(filterButton).toBeVisible();

    // Click the filter dropdown
    await filterButton.click();

    // Wait for dropdown content to appear
    const dropdown = page.locator('[data-testid="combined-filter-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Check if genres are populated
    const genreSection = dropdown.locator("text=Genre");
    await expect(genreSection).toBeVisible();

    // Take a screenshot for debugging
    await page.screenshot({
      path: "test-results/debug-genre-dropdown.png",
      fullPage: true,
    });

    console.log("Genre debugging completed");
    console.log("Console logs captured:", consoleLogs.length);
  });
});
