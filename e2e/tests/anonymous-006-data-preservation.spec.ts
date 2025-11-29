/**
 * E2E Test: Data Preservation During Conversion
 *
 * This is the CRITICAL test that verifies data created as an anonymous user
 * is preserved after converting to a registered account. UUID preservation
 * is the core feature of the Supabase Native Anonymous Auth approach.
 *
 * Feature: Anonymous User Conversion Pattern (PR #287)
 * Priority: P0 (CRITICAL - This is the main value proposition)
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

// Generate unique email for each test run
function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `conversion-data-${timestamp}-${random}@tunetrees.test`;
}

test.describe("Data Preservation During Conversion", () => {
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page }) => {
    ttPage = new TuneTreesPage(page);
  });

  // TODO: KNOWN BUG - Data is not being preserved during anonymous to registered conversion.
  // The conversion process creates the account but the local SQLite data (repertoire tunes)
  // is not being synced to Supabase during conversion. This needs investigation in:
  // - AuthContext.tsx convertAnonymousAccount flow
  // - Sync layer handling of user conversion
  test.fixme(
    "6.1 CRITICAL: Repertoire data preserved after conversion @critical",
    async ({ page }) => {
      // Step 1: Sign in anonymously WITH a playlist (needed for repertoire functionality)
      await ttPage.gotoLogin();
      await ttPage.signInAnonymouslyWithPlaylist("Data Preservation Test");
      await page.waitForTimeout(2000);

      // Step 2: Navigate to Catalog and add tune to repertoire
      await ttPage.catalogTab.click();
      await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      // Get the title of the first tune before adding
      const firstRow = ttPage.catalogGrid
        .locator("tbody tr[data-index]")
        .first();
      // Get the tune title from the second cell (Title column, index 1)
      // In case that's the ID, also try index 2
      let tuneTitle = await firstRow.locator("td").nth(1).textContent();
      // If the result looks like a UUID, try the next column
      if (tuneTitle?.match(/^[0-9a-f-]{36}$/i)) {
        tuneTitle = await firstRow.locator("td").nth(2).textContent();
      }
      console.log(`Adding tune to repertoire: ${tuneTitle}`);

      // Select and add the tune
      const firstTuneCheckbox = firstRow.locator('input[type="checkbox"]');
      await firstTuneCheckbox.click();
      await ttPage.catalogAddToRepertoireButton.click();
      await page.waitForTimeout(1000);

      // Step 3: Verify tune is in repertoire BEFORE conversion
      await ttPage.repertoireTab.click();
      await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);

      const repertoireCountBefore = await ttPage.repertoireGrid
        .locator("tbody tr[data-index]")
        .count();
      console.log(
        `Repertoire count before conversion: ${repertoireCountBefore}`
      );
      expect(repertoireCountBefore).toBeGreaterThan(0);

      // Just verify we have at least one tune in repertoire (don't rely on exact text matching)
      // The tune title may differ between catalog and repertoire views
      const firstRepertoireTune = ttPage.repertoireGrid
        .locator("tbody tr[data-index]")
        .first();
      await expect(firstRepertoireTune).toBeVisible({ timeout: 5000 });

      // Step 4: Convert to registered account
      await ttPage.clickCreateAccountOnBanner();
      await expect(ttPage.conversionHeader).toBeVisible({ timeout: 10000 });

      const testEmail = generateTestEmail();
      await ttPage.convertAnonymousAccount(
        testEmail,
        "TestPassword123!",
        "Data Preservation Test User"
      );

      // Step 5: Verify redirected to home and banner is gone
      await expect(ttPage.practiceTab).toBeVisible({ timeout: 10000 });
      const bannerVisible = await ttPage.isAnonymousBannerVisible();
      expect(bannerVisible).toBe(false);

      // Step 6: CRITICAL CHECK - Verify repertoire data is PRESERVED
      await ttPage.repertoireTab.click();
      await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const repertoireCountAfter = await ttPage.repertoireGrid
        .locator("tbody tr[data-index]")
        .count();
      console.log(`Repertoire count after conversion: ${repertoireCountAfter}`);

      // Count should be the same or greater (sync might bring more)
      expect(repertoireCountAfter).toBeGreaterThanOrEqual(
        repertoireCountBefore
      );

      // Verify at least one tune is still there (data was preserved)
      const firstRepertoireTuneAfter = ttPage.repertoireGrid
        .locator("tbody tr[data-index]")
        .first();
      await expect(firstRepertoireTuneAfter).toBeVisible({ timeout: 10000 });

      console.log("✅ CRITICAL TEST PASSED: Data preserved after conversion!");
    }
  );

  // TODO: KNOWN BUG - Same as 6.1, data not preserved during conversion.
  test.fixme(
    "6.2 Data persists after sign-out and sign-in post-conversion @critical",
    async ({ page }) => {
      // Step 1: Sign in anonymously WITH a playlist and add data
      await ttPage.gotoLogin();
      await ttPage.signInAnonymouslyWithPlaylist("Persistence Test");
      await page.waitForTimeout(2000);

      // Add tune to repertoire
      await ttPage.catalogTab.click();
      await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const firstRow = ttPage.catalogGrid
        .locator("tbody tr[data-index]")
        .first();
      // We don't need the exact title, just need to verify data persists
      const firstTuneCheckbox = firstRow.locator('input[type="checkbox"]');
      await firstTuneCheckbox.click();
      await ttPage.catalogAddToRepertoireButton.click();
      await page.waitForTimeout(1000);

      // Verify tune was added before converting
      await ttPage.repertoireTab.click();
      await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });
      const countBeforeConversion = await ttPage.repertoireGrid
        .locator("tbody tr[data-index]")
        .count();
      expect(countBeforeConversion).toBeGreaterThan(0);

      // Step 2: Convert to registered account
      await ttPage.clickCreateAccountOnBanner();

      const testEmail = generateTestEmail();
      const testPassword = "TestPassword123!";
      await ttPage.convertAnonymousAccount(
        testEmail,
        testPassword,
        "Persistence Test User"
      );

      // Step 3: Sign out
      await ttPage.signOut();
      await expect(page).toHaveURL(/\/login/);

      // Step 4: Sign back in with new credentials
      await ttPage.emailInput.fill(testEmail);
      await ttPage.passwordInput.fill(testPassword);
      await ttPage.signInButton.click();

      // Wait for app to load and sync
      await page.waitForURL(/\/$|\?tab=/, { timeout: 15000 });
      await expect(ttPage.practiceTab).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(3000); // Allow sync to complete

      // Step 5: Verify data is still there
      await ttPage.repertoireTab.click();
      await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      // Verify at least one tune is still there after sign-out/sign-in
      const countAfterRelogin = await ttPage.repertoireGrid
        .locator("tbody tr[data-index]")
        .count();
      expect(countAfterRelogin).toBeGreaterThanOrEqual(countBeforeConversion);

      console.log(
        "✅ CRITICAL TEST PASSED: Data persists across sign-out/sign-in!"
      );
    }
  );

  // TODO: KNOWN BUG - Same as 6.1, data not preserved during conversion.
  test.fixme(
    "6.3 Multiple tunes preserved during conversion",
    async ({ page }) => {
      // Step 1: Sign in anonymously WITH a playlist
      await ttPage.gotoLogin();
      await ttPage.signInAnonymouslyWithPlaylist("Multi Tune Test");
      await page.waitForTimeout(2000);

      // Step 2: Add multiple tunes to repertoire
      await ttPage.catalogTab.click();
      await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      // Select first 3 tunes (if available)
      const rows = ttPage.catalogGrid.locator("tbody tr[data-index]");
      const rowCount = await rows.count();
      const tunesToAdd = Math.min(3, rowCount);

      for (let i = 0; i < tunesToAdd; i++) {
        const checkbox = rows.nth(i).locator('input[type="checkbox"]');
        await checkbox.click();
        await page.waitForTimeout(200);
      }

      // Add all selected to repertoire
      await ttPage.catalogAddToRepertoireButton.click();
      await page.waitForTimeout(1000);

      // Verify count in repertoire
      await ttPage.repertoireTab.click();
      await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);

      const countBefore = await ttPage.repertoireGrid
        .locator("tbody tr[data-index]")
        .count();
      console.log(`Added ${tunesToAdd} tunes, repertoire has ${countBefore}`);
      expect(countBefore).toBeGreaterThanOrEqual(tunesToAdd);

      // Step 3: Convert account
      await ttPage.clickCreateAccountOnBanner();
      await ttPage.convertAnonymousAccount(
        generateTestEmail(),
        "TestPassword123!",
        "Multi Tune Test"
      );

      // Step 4: Verify all tunes preserved
      await ttPage.repertoireTab.click();
      await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const countAfter = await ttPage.repertoireGrid
        .locator("tbody tr[data-index]")
        .count();
      console.log(`After conversion, repertoire has ${countAfter}`);

      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
      console.log("✅ Multiple tunes preserved during conversion!");
    }
  );
});
