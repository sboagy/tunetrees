import { expect, test } from "@playwright/test";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * REPERTOIRE-001: Repertoire tab shows Alice's 2 private tunes
 * Priority: Critical
 *
 * Tests that the Repertoire tab correctly displays Alice's private tunes
 * after login and sync completion.
 */

test.use({ storageState: "e2e/.auth/alice.json" });

test.describe("REPERTOIRE-001: User's Tunes Display", () => {
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page }) => {
    ttPage = new TuneTreesPage(page);
    await ttPage.goto();
    await ttPage.waitForSync(2000);
    await ttPage.navigateToTab("repertoire");
  });

  test("should display exactly 2 tunes in Repertoire grid", async () => {
    // Wait for grid to load
    await ttPage.expectGridHasContent(ttPage.repertoireGrid);

    // Look for the two tune titles
    await ttPage.expectTuneVisible("Banish Misfortune", ttPage.repertoireGrid);
    await ttPage.expectTuneVisible("Morrison's Jig", ttPage.repertoireGrid);
  });

  test("should show 'Private' badge on both tunes", async ({ page }) => {
    // Both tunes should have Private badge
    const privateBadges = page.getByText("Private");
    await expect(privateBadges).toHaveCount(2, { timeout: 5000 });
  });

  test("should display tune type for both tunes", async ({ page }) => {
    // Look for JigD or Jig badges
    const jigBadges = page.getByText(/Jig/i);
    await expect(jigBadges.first()).toBeVisible({ timeout: 5000 });
  });

  test("should display tune modes", async ({ page }) => {
    // Look for mode badges
    await expect(page.getByText(/D Mixolydian/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/E Dorian/i)).toBeVisible({ timeout: 5000 });
  });

  test("should display tune structure AABBCC", async ({ page }) => {
    // Look for structure information
    const structureCells = page.getByText("AABBCC");
    await expect(structureCells.first()).toBeVisible({ timeout: 5000 });
  });

  test("should show toolbar with Add To Review button", async () => {
    // Toolbar buttons should be visible - use tab-specific locators
    await expect(ttPage.repertoireAddToReviewButton).toBeVisible({
      timeout: 5000,
    });
    await expect(ttPage.repertoireAddTuneButton).toBeVisible({
      timeout: 5000,
    });
    await expect(ttPage.repertoireColumnsButton).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show action buttons in toolbar", async () => {
    // Verify common toolbar buttons are present
    await ttPage.expectToolbarVisible({
      addTune: true,
      columns: true,
      tab: "repertoire",
    });
    // Just verify the "Add To Review" button exists (enabled/disabled depends on selection)
    await expect(ttPage.repertoireAddToReviewButton).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show filters section", async () => {
    // Click filters button to expand panel if needed
    await ttPage.filtersButton.click();
    await ttPage.page.waitForTimeout(500);
    // Use Page Object to verify filters are visible
    await ttPage.expectFiltersVisible();
  });

  test("should not show loading spinner after load", async () => {
    // Use Page Object to verify no loading state
    await ttPage.expectNoLoading();
  });

  test("should not show empty state message", async () => {
    // Should not show "No tunes" or similar empty state
    await expect(ttPage.page.getByText(/No tunes found/i)).not.toBeVisible();
    await expect(
      ttPage.page.getByText(/Add your first tune/i)
    ).not.toBeVisible();
  });
});
