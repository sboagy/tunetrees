/**
 * E2E Test: Anonymous User Sign-In Flow
 *
 * Tests the anonymous sign-in feature using Supabase Native Anonymous Auth.
 * Users should be able to start using TuneTrees immediately without creating an account.
 *
 * Feature: Anonymous User Conversion Pattern (PR #287)
 * Priority: P0 (Critical Path)
 *
 * Prerequisites:
 * - Supabase running with enable_anonymous_sign_ins = true
 * - Development server running on ${BASE_URL}
 */

import { test as base, expect } from "@playwright/test";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

// Override the base test to NOT use stored auth state (we need fresh sessions)
const test = base.extend({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture pattern requires empty object
  storageState: async ({}, use) => {
    // Use empty storage state for anonymous tests
    await use({ cookies: [], origins: [] });
  },
});

test.describe("Anonymous User Sign-In Flow", () => {
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page }) => {
    ttPage = new TuneTreesPage(page);
  });

  test("1.1 Anonymous sign-in button is visible on login page", async ({
    page,
  }) => {
    // Navigate to login page with fresh state
    await ttPage.gotoLogin();

    // Verify "Use on this Device Only" button is visible
    await expect(ttPage.anonymousSignInButton).toBeVisible({ timeout: 10000 });

    // Verify the button has helpful subtext
    const subtext = page.getByText(/Try TuneTrees without an account/i);
    await expect(subtext).toBeVisible();

    // Verify regular sign-in form is also visible
    await expect(ttPage.emailInput).toBeVisible();
    await expect(ttPage.passwordInput).toBeVisible();

    // Verify OAuth buttons are visible
    await expect(ttPage.googleOAuthButton).toBeVisible();
    await expect(ttPage.githubOAuthButton).toBeVisible();
  });

  test("1.2 Anonymous sign-in succeeds and redirects to home", async ({
    page,
  }) => {
    // Capture console logs for verification
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(msg.text());
    });

    // Navigate to login page
    await ttPage.gotoLogin();

    // Click anonymous sign-in button
    await ttPage.signInAnonymously();

    // Verify redirected to home (Practice tab)
    await expect(page).toHaveURL(/\/$|\?tab=practice/);

    // Verify Practice tab is visible (app loaded)
    await expect(ttPage.practiceTab).toBeVisible({ timeout: 10000 });

    // Verify console logs indicate successful anonymous sign-in
    const hasAnonymousSuccessLog = consoleLogs.some(
      (log) =>
        log.includes("Anonymous sign-in") ||
        log.includes("anonymous") ||
        log.includes("Anonymous mode")
    );
    expect(hasAnonymousSuccessLog).toBe(true);
  });

  test("1.3 Anonymous user session persists after page refresh", async ({
    page,
  }) => {
    // Navigate and sign in anonymously
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();

    // Wait for app to fully load
    await expect(ttPage.practiceTab).toBeVisible({ timeout: 10000 });

    // Refresh the page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Verify still on the same page (not redirected to login)
    expect(page.url()).not.toContain("/login");

    // Verify Practice tab is still visible (app loaded)
    await expect(ttPage.practiceTab).toBeVisible({ timeout: 10000 });

    // Verify anonymous banner is still visible (still in anonymous mode)
    const bannerVisible = await ttPage.isAnonymousBannerVisible();
    expect(bannerVisible).toBe(true);
  });

  test("1.4 Anonymous user can access all main tabs", async () => {
    // Navigate and sign in anonymously
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();

    // Verify Practice tab accessible
    // New anonymous users have no playlist, so they see loading/no content state
    await expect(ttPage.practiceTab).toBeVisible({ timeout: 10000 });
    await ttPage.practiceTab.click();
    // Check that the practice tab content area exists (may show loading or empty state)
    const practiceContent = ttPage.page
      .getByTestId("tunes-grid-scheduled")
      .or(ttPage.page.getByText("Loading practice queue"))
      .or(ttPage.page.getByText("No tunes are due"));
    await expect(practiceContent).toBeVisible({ timeout: 10000 });

    // Verify Repertoire tab accessible (new users see "No playlist selected")
    await ttPage.repertoireTab.click();
    const repertoireContent = ttPage.page
      .getByTestId("tunes-grid-repertoire")
      .or(ttPage.page.getByText("No playlist selected"));
    await expect(repertoireContent).toBeVisible({ timeout: 10000 });

    // Verify Catalog tab accessible (always has public tunes, but needs loading time)
    await ttPage.catalogTab.click();
    const catalogContent = ttPage.catalogGrid.or(
      ttPage.page.getByText("Loading")
    );
    await expect(catalogContent).toBeVisible({ timeout: 15000 });
  });
});
