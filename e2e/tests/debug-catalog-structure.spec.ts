import { expect, test } from "@playwright/test";

test("debug catalog page component structure", async ({ page }) => {
  // Enable all console logs
  page.on("console", (msg) => {
    console.log(`🔍 Console [${msg.type()}]:`, msg.text());
  });

  // Enable error logging
  page.on("pageerror", (error) => {
    console.log(`❌ Page Error:`, error.message);
  });

  // Navigate to catalog
  await page.goto("/catalog");

  // Wait for potential async loading
  await page.waitForTimeout(3000);

  // Check the HTML structure
  const htmlContent = await page.content();
  console.log("Full HTML content length:", htmlContent.length);

  // Look for specific SolidJS patterns or component markers
  const solidMarkers = await page.locator("[data-hk], [data-solid]").count();
  console.log("SolidJS hydration markers:", solidMarkers);

  // Check for specific TuneTrees components
  const catalogComponents = await page
    .locator('.catalog, [class*="catalog"], .grid, [class*="grid"]')
    .count();
  console.log("Catalog/grid components:", catalogComponents);

  // Check if there are any loading states
  const loadingElements = await page
    .locator('text=/loading/i, .loading, [class*="loading"]')
    .count();
  console.log("Loading elements:", loadingElements);

  // Check for errors in the DOM
  const errorElements = await page
    .locator('text=/error/i, .error, [class*="error"]')
    .count();
  console.log("Error elements:", errorElements);

  // Look for auth-related elements
  const authElements = await page
    .locator("text=/sign in|login|authenticate/i")
    .count();
  console.log("Auth-related elements:", authElements);

  // Check the actual DOM tree structure
  const bodyChildren = await page.locator("body > *").count();
  console.log("Direct body children:", bodyChildren);

  // Get all text content to see if there's hidden text
  const allText = await page.textContent("*");
  const cleanText = allText?.replace(/\s+/g, " ").trim();
  console.log("All text content:", cleanText?.substring(0, 500));

  // Take detailed screenshot
  await page.screenshot({
    path: "test-results/catalog-debug-structure.png",
    fullPage: true,
  });

  // Check if app root exists and has content
  const appRoot = page.locator("#app, #root, [data-app]");
  const appRootCount = await appRoot.count();
  console.log("App root elements:", appRootCount);

  if (appRootCount > 0) {
    const appContent = await appRoot.first().textContent();
    console.log("App root content:", appContent?.substring(0, 200));

    const appChildren = await appRoot.first().locator("> *").count();
    console.log("App root direct children:", appChildren);
  }
});
