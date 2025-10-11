import { expect, test } from "@playwright/test";

test("simple catalog page load test", async ({ page }) => {
  // Enable console logging
  page.on("console", (msg) => {
    console.log(`🔍 Console [${msg.type()}]:`, msg.text());
  });

  // Enable error logging
  page.on("pageerror", (error) => {
    console.log(`❌ Page Error:`, error.message);
  });

  // Navigate to catalog page
  await page.goto("/catalog", {
    waitUntil: "domcontentloaded",
  });

  // Wait a bit for any async content to load
  await page.waitForTimeout(2000);

  // Take a screenshot to see what's on the page
  await page.screenshot({
    path: "test-results/catalog-page-simple.png",
    fullPage: true,
  });

  // Check basic page structure
  await expect(page.locator("body")).toBeVisible();

  // Get the page title
  const title = await page.title();
  console.log("Page title:", title);

  // Check if there are any main elements
  const mainElements = await page
    .locator('main, [role="main"], .catalog, nav')
    .count();
  console.log("Main elements found:", mainElements);

  // Log all elements with data-testid for debugging
  const testIdElements = await page.locator("[data-testid]").all();
  console.log("Elements with data-testid count:", testIdElements.length);

  // Check what's actually in the DOM - get more content
  const content = await page.textContent("body");
  console.log("Page content preview:", content?.substring(0, 500));

  // Check if we're redirected or have auth issues
  const currentUrl = page.url();
  console.log("Current URL:", currentUrl);

  // Look for any error messages
  const errorMessages = await page
    .locator("text=/error|Error|404|not found/i")
    .count();
  console.log("Error messages found:", errorMessages);
});
