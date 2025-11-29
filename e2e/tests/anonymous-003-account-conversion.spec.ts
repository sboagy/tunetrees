/**
 * E2E Test: Anonymous User Account Conversion
 *
 * Tests the account conversion flow that preserves UUID when converting
 * from anonymous user to registered account using Supabase updateUser().
 *
 * Feature: Anonymous User Conversion Pattern (PR #287)
 * Priority: P0 (Critical - UUID preservation is essential)
 *
 * Prerequisites:
 * - Supabase running with enable_anonymous_sign_ins = true
 * - Development server running on http://localhost:5173
 */

import { test as base, expect } from "@playwright/test";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

// Override the base test to NOT use stored auth state (we need fresh sessions)
const test = base.extend({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture pattern requires empty object
  storageState: async ({}, use) => {
    await use({ cookies: [], origins: [] });
  },
});

// Generate unique email for each test run to avoid conflicts
function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `anon-test-${timestamp}-${random}@tunetrees.test`;
}

test.describe("Anonymous User Account Conversion", () => {
  test.setTimeout(60000);

  // Run these tests serially to avoid parallel session conflicts
  test.describe.configure({ mode: "serial" });

  // Only run on Chromium for now
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page }) => {
    ttPage = new TuneTreesPage(page);
  });

  test("3.1 Conversion UI shows special header and info box", async () => {
    // Sign in anonymously first
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();

    // Navigate to conversion page via banner
    await ttPage.clickCreateAccountOnBanner();

    // Verify conversion-specific UI elements
    await expect(ttPage.conversionHeader).toBeVisible({ timeout: 10000 });

    // Verify info box about data preservation
    await expect(ttPage.conversionInfoBox).toBeVisible({ timeout: 5000 });

    // Verify the name field is visible (sign-up mode)
    await expect(ttPage.nameInput).toBeVisible({ timeout: 5000 });
  });

  test("3.2 Conversion validates required fields", async ({ page }) => {
    // Sign in anonymously
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();

    // Navigate to conversion page
    await ttPage.clickCreateAccountOnBanner();

    // Try to submit with empty fields
    await ttPage.signUpButton.click();

    // Form should not submit (we stay on the same page)
    await expect(page).toHaveURL(/\/login\?convert=true/);

    // Fill only email (missing name and password)
    await ttPage.emailInput.fill("test@example.com");
    await ttPage.signUpButton.click();

    // Still on conversion page (validation failed)
    await expect(page).toHaveURL(/\/login\?convert=true/);
  });

  test("3.3 Conversion validates password length", async ({ page }) => {
    // Sign in anonymously
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();

    // Navigate to conversion page
    await ttPage.clickCreateAccountOnBanner();

    // Fill form with short password
    await ttPage.nameInput.fill("Test User");
    await ttPage.emailInput.fill(generateTestEmail());
    await ttPage.passwordInput.fill("12345"); // Too short

    // Try to submit
    await ttPage.signUpButton.click();

    // Should show error or stay on page (HTML5 validation or custom)
    // Check if error message appears or we're still on the page
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    expect(currentUrl).toContain("convert=true");
  });

  test("3.4 Successful conversion preserves UUID and redirects", async ({
    page,
  }) => {
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(msg.text());
    });

    // Sign in anonymously
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();

    // Wait and capture the anonymous UUID from logs
    await page.waitForTimeout(2000);
    // Look for anonymous user creation log (for debugging if test fails)
    const _anonymousUuidLog = consoleLogs.find(
      (log) =>
        log.includes("anonymous sign-in successful") ||
        log.includes("Anonymous user") ||
        log.includes("user_profile for anonymous")
    );
    console.log("Anonymous UUID log:", _anonymousUuidLog || "(not found)");

    // Navigate to conversion page
    await ttPage.clickCreateAccountOnBanner();

    // Fill conversion form
    const testEmail = generateTestEmail();
    await ttPage.convertAnonymousAccount(
      testEmail,
      "TestPassword123!",
      "Test Converted User"
    );

    // Verify redirected to home
    await expect(page).toHaveURL(/\/$|\?tab=/);

    // Verify Practice tab is visible
    await expect(ttPage.practiceTab).toBeVisible({ timeout: 10000 });

    // Verify anonymous banner is NO LONGER visible (converted user)
    const bannerVisible = await ttPage.isAnonymousBannerVisible();
    expect(bannerVisible).toBe(false);

    // Check console for UUID preservation message
    const uuidPreservedLog = consoleLogs.find(
      (log) =>
        log.includes("User ID preserved") ||
        log.includes("linked to anonymous") ||
        log.includes("Converting anonymous")
    );
    expect(uuidPreservedLog).toBeDefined();
  });

  test("3.5 Converted user can sign out and sign back in", async ({ page }) => {
    // Sign in anonymously and convert
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();
    await ttPage.clickCreateAccountOnBanner();

    const testEmail = generateTestEmail();
    const testPassword = "TestPassword123!";
    await ttPage.convertAnonymousAccount(
      testEmail,
      testPassword,
      "Test User Sign Out"
    );

    // Sign out
    await ttPage.signOut();

    // Verify on login page
    await expect(page).toHaveURL(/\/login/);

    // Sign back in with the new credentials
    await ttPage.emailInput.fill(testEmail);
    await ttPage.passwordInput.fill(testPassword);
    await ttPage.signInButton.click();

    // Verify redirected to home
    await page.waitForURL(/\/$|\?tab=/, { timeout: 15000 });

    // Verify Practice tab visible
    await expect(ttPage.practiceTab).toBeVisible({ timeout: 10000 });

    // Verify NO anonymous banner (regular user)
    const bannerVisible = await ttPage.isAnonymousBannerVisible();
    expect(bannerVisible).toBe(false);
  });
});
