import { expect, test } from "@playwright/test";

test("simple filter dropdown test", async ({ page }) => {
  console.log("=== SIMPLE FILTER DROPDOWN TEST ===");

  // Enable console and error logging
  page.on("console", (msg) => {
    console.log(`🔍 Browser Console: ${msg.text()}`);
  });

  page.on("pageerror", (error) => {
    console.log(`❌ Page Error: ${error.message}`);
  });

  // Navigate to catalog with explicit tab parameter
  await page.goto("/?tab=catalog");
  console.log("Navigated to catalog tab");

  // Wait for authentication to complete
  let authComplete = false;
  let attempts = 0;
  const maxAttempts = 30;

  while (!authComplete && attempts < maxAttempts) {
    await page.waitForTimeout(1000);
    attempts++;

    // Check for signs of successful auth/loading
    const pageText = await page.locator("body").textContent();
    const hasAuthContent =
      pageText?.includes("Practice") ||
      pageText?.includes("Catalog") ||
      pageText?.includes("Repertoire");
    const hasDebugMessage = pageText?.includes("DEBUG:");

    if (hasAuthContent || hasDebugMessage) {
      authComplete = true;
      console.log(
        `✅ Authentication/loading completed after ${attempts} seconds`
      );
    } else {
      console.log(
        `⏳ Waiting for auth/content... attempt ${attempts}/${maxAttempts}`
      );
    }
  }

  if (!authComplete) {
    console.log("❌ Authentication/loading never completed");
    await page.screenshot({
      path: "test-results/auth-failed.png",
      fullPage: true,
    });
  }

  // Check if we can find any button with "Filter" text
  const filterButtons = await page
    .locator("button")
    .filter({ hasText: /filter/i })
    .count();
  console.log(`Found ${filterButtons} button(s) with 'filter' text`);

  // Check if the toolbar is even visible
  const toolbars = await page
    .locator("div")
    .filter({ hasText: /toolbar/i })
    .count();
  console.log(`Found ${toolbars} div(s) with 'toolbar' text`);

  // Look for any text about loading
  const pageText = await page.locator("body").textContent();
  const hasLoadingText =
    pageText?.includes("loading") || pageText?.includes("Loading");
  console.log(`Page contains loading text: ${hasLoadingText}`);

  // Check for debug messages
  const debugMessages = await page
    .locator("div")
    .filter({ hasText: /DEBUG:/ })
    .count();
  console.log(`Found ${debugMessages} debug message(s)`);

  if (debugMessages > 0) {
    const debugText = await page
      .locator("div")
      .filter({ hasText: /DEBUG:/ })
      .first()
      .textContent();
    console.log(`Debug message: ${debugText}`);
  }

  // Find the Filters button
  const filterButton = page.locator('button:has-text("Filters")');
  expect(await filterButton.count()).toBeGreaterThan(0);
  console.log("✅ Found Filters button");

  // Take screenshot before click
  await page.screenshot({
    path: "test-results/before-filter-click.png",
    fullPage: true,
  });

  // Click the Filters button
  await filterButton.click();
  console.log("✅ Clicked Filters button");

  // Wait a moment for any animation
  await page.waitForTimeout(500);

  // Take screenshot after click
  await page.screenshot({
    path: "test-results/after-filter-click.png",
    fullPage: true,
  });

  // Look for dropdown content
  const dropdownSelectors = [
    "div.absolute.right-0.top-full", // FilterPanel dropdown
    "div.absolute.top-full", // Any absolute dropdown
    'div[class*="dropdown"]', // Any element with dropdown in class
    'div[class*="absolute"]', // Any absolute positioned element
  ];

  let dropdownFound = false;
  for (const selector of dropdownSelectors) {
    const elements = await page.locator(selector).count();
    if (elements > 0) {
      console.log(
        `✅ Found dropdown element: ${selector} (${elements} matches)`
      );
      dropdownFound = true;

      // Get text content of this dropdown
      const dropdownText = await page.locator(selector).first().textContent();
      console.log(`Dropdown content: ${dropdownText?.substring(0, 200)}...`);
      break;
    }
  }

  if (!dropdownFound) {
    console.log("❌ No dropdown elements found");

    // Check what elements are visible on the page
    const allElements = await page.locator("*").count();
    console.log(`Total elements on page: ${allElements}`);

    // Check for any text that might indicate the dropdown opened
    const pageText = await page.locator("body").textContent();
    const hasFilterText =
      pageText?.includes("Genre") ||
      pageText?.includes("Type") ||
      pageText?.includes("Mode");
    console.log(`Page contains filter text: ${hasFilterText}`);
  }

  expect(dropdownFound).toBe(true);
});
