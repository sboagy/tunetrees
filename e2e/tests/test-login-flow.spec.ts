import { expect, test } from "@playwright/test";

test("login and access catalog", async ({ page }) => {
  // Get test credentials from environment
  const testUsername =
    process.env.TUNETREES_TEST_USERNAME || "sboagy@gmail.com";
  const testPassword =
    process.env.TUNETREES_TEST_PASSWORD || "serf.pincers3BITTERS";

  console.log("Using test credentials:", testUsername);

  // Enable console logging
  page.on("console", (msg) => {
    console.log(`🔍 Console [${msg.type()}]:`, msg.text());
  });

  // Enable error logging
  page.on("pageerror", (error) => {
    console.log(`❌ Page Error:`, error.message);
  });

  // Navigate to login page first
  await page.goto("/login");

  // Take screenshot of login page
  await page.screenshot({
    path: "test-results/login-page.png",
    fullPage: true,
  });

  // Wait for login form to be ready
  await page.waitForLoadState("domcontentloaded");

  // Find login form elements with multiple selectors
  const emailInput = page
    .locator('input[type="email"]')
    .or(page.locator('input[placeholder*="email" i]'))
    .or(page.locator('input[name="email"]'))
    .first();

  const passwordInput = page
    .locator('input[type="password"]')
    .or(page.locator('input[placeholder*="password" i]'))
    .or(page.locator('input[name="password"]'))
    .first();

  const signInButton = page
    .locator('button:has-text("Sign In")')
    .or(page.locator('button:has-text("Login")'))
    .or(page.locator('button[type="submit"]'))
    .first();

  // Check if login elements are found
  console.log("Email input visible:", await emailInput.isVisible());
  console.log("Password input visible:", await passwordInput.isVisible());
  console.log("Sign in button visible:", await signInButton.isVisible());

  // Fill in credentials and attempt login
  await emailInput.fill(testUsername);
  await passwordInput.fill(testPassword);

  // Click sign in
  await signInButton.click();

  // Wait for navigation or auth state change
  await page.waitForTimeout(5000);

  console.log("After login attempt - URL:", page.url());

  // Take screenshot after login attempt
  await page.screenshot({
    path: "test-results/after-login-attempt.png",
    fullPage: true,
  });

  // Check if we're now authenticated by trying to access catalog
  await page.goto("/?tab=catalog");
  await page.waitForTimeout(3000);

  console.log("Catalog URL after login:", page.url());

  // Check if catalog content is now visible
  const filterButton = page.locator('[data-testid="combined-filter-button"]');
  const filterButtonVisible = await filterButton.isVisible();
  console.log("Filter button visible after login:", filterButtonVisible);

  if (filterButtonVisible) {
    console.log("🎉 SUCCESS: Catalog loaded with authentication!");

    // Now test the filter dropdown
    await filterButton.click();

    const dropdown = page.locator('[data-testid="combined-filter-dropdown"]');
    await expect(dropdown).toBeVisible();

    await page.screenshot({
      path: "test-results/catalog-with-filter-dropdown.png",
      fullPage: true,
    });

    console.log("Filter dropdown opened successfully!");
  } else {
    // Check what content is actually showing
    const content = await page.textContent("body");
    console.log(
      "Catalog page content after login:",
      content?.substring(0, 500)
    );
  }
});
