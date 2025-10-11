import { expect, test } from "@playwright/test";

// Helper to login first
async function loginUser(page: any) {
  const testUsername =
    process.env.TUNETREES_TEST_USERNAME || "sboagy@gmail.com";
  const testPassword =
    process.env.TUNETREES_TEST_PASSWORD || "serf.pincers3BITTERS";

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(testUsername);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.locator('button:has-text("Sign In")').click();

  // Wait for auth state to settle
  await page.waitForTimeout(3000);
}

test("debug authenticated catalog page components", async ({ page }) => {
  // Enable verbose console logging
  page.on("console", (msg) => {
    console.log(`🔍 Console [${msg.type()}]:`, msg.text());
  });

  // Enable error logging
  page.on("pageerror", (error) => {
    console.log(`❌ Page Error:`, error.message);
  });

  // Login first
  await loginUser(page);

  // Navigate to catalog after successful login
  await page.goto("/?tab=catalog");

  // Wait for any async components to load
  await page.waitForTimeout(5000);

  console.log("=== DEBUGGING CATALOG PAGE AFTER LOGIN ===");

  // Check URL
  console.log("Current URL:", page.url());

  // Check if main app container exists
  const appContainer = page.locator("#app, #root, [data-app]");
  console.log("App container exists:", (await appContainer.count()) > 0);

  // Check for any main content containers
  const mainContainers = page.locator('main, [role="main"], .main, .catalog');
  console.log("Main containers found:", await mainContainers.count());

  // Look for specific TuneTrees components by class patterns
  const tuneTreesComponents = page.locator(
    '[class*="catalog"], [class*="toolbar"], [class*="grid"], [class*="filter"]'
  );
  console.log(
    "TuneTrees component classes found:",
    await tuneTreesComponents.count()
  );

  // Look for SolidJS reactive elements
  const solidElements = page.locator(
    "[data-hk], [data-solid], [data-reactivity]"
  );
  console.log("SolidJS reactive elements:", await solidElements.count());

  // Check for any loading states or error states
  const loadingStates = page.locator("text=/loading/i");
  const loadingClasses = page.locator('.loading, [aria-busy="true"]');
  console.log("Loading text states:", await loadingStates.count());
  console.log("Loading class states:", await loadingClasses.count());

  const errorStates = page.locator("text=/error/i");
  const errorClasses = page.locator('.error, [role="alert"]');
  console.log("Error text states:", await errorStates.count());
  console.log("Error class states:", await errorClasses.count());

  // Get detailed DOM structure
  const bodyHTML = await page.locator("body").innerHTML();
  console.log("Body HTML length:", bodyHTML.length);
  console.log("Body HTML preview:", bodyHTML.substring(0, 1000));

  // Check for specific catalog components
  const catalogToolbar = page.locator(
    '[class*="CatalogToolbar"], [class*="catalog-toolbar"]'
  );
  console.log("Catalog toolbar found:", await catalogToolbar.count());

  const tunesGrid = page.locator(
    '[class*="TunesGrid"], [class*="tunes-grid"], [data-testid*="grid"]'
  );
  console.log("Tunes grid found:", await tunesGrid.count());

  // Take detailed screenshot
  await page.screenshot({
    path: "test-results/authenticated-catalog-debug.png",
    fullPage: true,
  });

  // Try to find ANY button elements
  const allButtons = page.locator("button");
  const buttonCount = await allButtons.count();
  console.log("Total buttons found:", buttonCount);

  if (buttonCount > 0) {
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = allButtons.nth(i);
      const buttonText = await button.textContent();
      const buttonClasses = await button.getAttribute("class");
      console.log(
        `Button ${i}: text="${buttonText}" classes="${buttonClasses}"`
      );
    }
  }

  // Check if router is working by trying different routes
  console.log("=== Testing router navigation ===");
  await page.goto("/");
  await page.waitForTimeout(1000);
  console.log("Root page URL:", page.url());

  await page.goto("/?tab=practice");
  await page.waitForTimeout(1000);
  console.log("Practice tab URL:", page.url());

  await page.goto("/?tab=catalog");
  await page.waitForTimeout(1000);
  console.log("Back to catalog tab URL:", page.url());
});
