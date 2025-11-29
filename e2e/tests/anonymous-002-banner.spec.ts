/**
 * E2E Test: Anonymous User Banner
 *
 * Tests the anonymous user banner that prompts users to create an account.
 * The banner should appear on all pages for anonymous users.
 *
 * Feature: Anonymous User Conversion Pattern (PR #287)
 * Priority: P1 (Important)
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

test.describe("Anonymous User Banner", () => {
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page }) => {
    ttPage = new TuneTreesPage(page);
    // Sign in anonymously for each test
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();
  });

  test("2.1 Banner is visible after anonymous sign-in", async () => {
    // Verify banner is visible
    await expect(ttPage.anonymousBanner).toBeVisible({ timeout: 10000 });

    // Verify banner content
    const bannerText = await ttPage.anonymousBanner.textContent();
    expect(bannerText).toContain("You're using TuneTrees on this device only");
    expect(bannerText).toContain("Create an account");
  });

  test("2.2 Banner shows on all main tabs", async () => {
    // Check Practice tab
    await ttPage.practiceTab.click();
    await expect(ttPage.anonymousBanner).toBeVisible({ timeout: 5000 });

    // Check Repertoire tab
    await ttPage.repertoireTab.click();
    await expect(ttPage.anonymousBanner).toBeVisible({ timeout: 5000 });

    // Check Catalog tab
    await ttPage.catalogTab.click();
    await expect(ttPage.anonymousBanner).toBeVisible({ timeout: 5000 });
  });

  test("2.3 Banner can be dismissed", async ({ page }) => {
    // Verify banner is initially visible
    await expect(ttPage.anonymousBanner).toBeVisible({ timeout: 10000 });

    // Click dismiss button (X)
    const dismissButton = ttPage.anonymousBanner.locator(
      'button[aria-label="Dismiss banner"]'
    );
    await dismissButton.click();

    // Verify banner is hidden
    await expect(ttPage.anonymousBanner).not.toBeVisible({ timeout: 5000 });

    // Verify dismissed state is saved to localStorage
    const dismissed = await page.evaluate(() =>
      localStorage.getItem("tunetrees:anonymous-banner-dismissed")
    );
    expect(dismissed).toBe("true");
  });

  test("2.4 Banner stays dismissed across tab navigation", async () => {
    // Dismiss the banner
    const dismissButton = ttPage.anonymousBanner.locator(
      'button[aria-label="Dismiss banner"]'
    );
    await dismissButton.click();
    await expect(ttPage.anonymousBanner).not.toBeVisible({ timeout: 5000 });

    // Navigate to different tabs
    await ttPage.repertoireTab.click();
    await expect(ttPage.anonymousBanner).not.toBeVisible({ timeout: 2000 });

    await ttPage.catalogTab.click();
    await expect(ttPage.anonymousBanner).not.toBeVisible({ timeout: 2000 });

    await ttPage.practiceTab.click();
    await expect(ttPage.anonymousBanner).not.toBeVisible({ timeout: 2000 });
  });

  test("2.5 Create Account button navigates to conversion page", async ({
    page,
  }) => {
    // Verify banner is visible
    await expect(ttPage.anonymousBanner).toBeVisible({ timeout: 10000 });

    // Click "Create Account" button on banner
    await ttPage.clickCreateAccountOnBanner();

    // Verify navigated to login page with convert=true parameter
    await expect(page).toHaveURL(/\/login\?convert=true/);

    // Verify conversion UI is shown
    await expect(ttPage.conversionHeader).toBeVisible({ timeout: 10000 });
  });
});
