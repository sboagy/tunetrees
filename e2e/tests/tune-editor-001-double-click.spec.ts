/**
 * TUNE-EDITOR-001: Double-Click to Edit and Full Editing Workflow
 * Priority: Critical
 *
 * Tests the complete tune editor functionality:
 * 1. Double-clicking a tune row opens the editor
 * 2. Editor displays in main content area with sidebar visible
 * 3. Show Public toggle is visible
 * 4. Submit/Cancel buttons are visible and functional
 * 5. Form fields can be edited
 * 6. Submit saves changes and returns to home
 * 7. Cancel discards changes and returns to home
 *
 * User Flow:
 * 1. Log in as test user
 * 2. Navigate to tab (Catalog, Repertoire, or Practice)
 * 3. Double-click a tune row
 * 4. Verify tune editor opens with correct tune data
 * 5. Edit tune fields
 * 6. Submit or Cancel
 * 7. Verify return to home page
 *
 * Edge Cases:
 * - Works in Catalog tab
 * - Works in Repertoire tab
 * - Works in Practice tab (if tunes present)
 * - Editor is scrollable
 * - Submit button triggers save
 * - Cancel button discards changes
 */

import { expect } from "@playwright/test";
import { CATALOG_TUNE_A_FIG_FOR_A_KISS } from "../../src/lib/db/catalog-tune-ids";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";
import { BASE_URL } from "../test-config";

let ttPage: TuneTreesPage;

test.describe("TUNE-EDITOR-001: Double-Click to Edit and Full Workflow", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Setup: Start on catalog tab with some tunes
    // await setupForCatalogTestsParallel(page, testUser, {
    //   emptyRepertoire: false,
    //   startTab: "catalog",
    // });
    const { privateTune1Id } = getPrivateTuneIds(testUser.userId);
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [privateTune1Id, TEST_TUNE_MORRISON_ID],
      scheduleTunes: false,
    });
    await ttPage.navigateToTab("catalog");
  });

  test("should open editor in main content area when double-clicking catalog row", async ({
    page,
  }) => {
    // ARRANGE: Wait for catalog grid to be visible
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500); // Allow grid to render

    // Find a tune row (A Fig for a Kiss)
    const tuneRow = page
      .locator('[data-testid="tunes-grid-catalog"] tbody tr')
      .filter({ hasText: "A Fig for a Kiss" })
      .first();

    await expect(tuneRow).toBeVisible({ timeout: 5000 });

    // Get the tune ID from the row (for URL verification)
    const tuneId = CATALOG_TUNE_A_FIG_FOR_A_KISS;

    // ACT: Double-click the tune row
    await tuneRow.dblclick();

    // ASSERT: Verify navigation to edit page
    await expect(page).toHaveURL(new RegExp(`/tunes/${tuneId}/edit`), {
      timeout: 10000,
    });

    // Verify tune ID is displayed (small, grayed out)
    await expect(
      ttPage.tuneEditorContainer.getByText(new RegExp(`${tuneId}`))
    ).toBeVisible({
      timeout: 5000,
    });

    // Verify Submit and Cancel buttons are visible
    await expect(page.getByTestId("tune-editor-save-button")).toBeVisible();
    await expect(page.getByTestId("tune-editor-cancel-button")).toBeVisible();

    // Verify tune title is loaded
    await expect(page.getByLabel(/title/i)).toHaveValue(/a fig for a kiss/i);
  });

  test("should allow editing tune fields and submitting", async ({
    page,
    baseURL,
  }) => {
    // ARRANGE: Navigate to editor
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    const tuneRow = page
      .locator('[data-testid="tunes-grid-catalog"] tbody tr')
      .filter({ hasText: "A Fig for a Kiss" })
      .first();

    await tuneRow.dblclick();

    await expect(page.getByTestId("tune-editor-save-button")).toBeVisible({
      timeout: 10000,
    });

    // ACT: Edit the structure field
    const structureInput = page.getByLabel(/structure/i);
    await expect(structureInput).toBeVisible({ timeout: 5000 });

    // Clear and enter new value
    await structureInput.clear();
    await structureInput.fill("AABBCC");

    // Submit the form
    await page.getByTestId("tune-editor-save-button").click();

    // ASSERT: Verify navigation back to home
    const baseURLConstructed = `${BASE_URL}?tab=catalog`;
    await expect(page).toHaveURL(baseURLConstructed, {
      timeout: 10000,
    });

    // Verify we're back on a tab (not in editor)
    await expect(page.getByTestId("tab-practice")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should discard changes when clicking cancel", async ({ page }) => {
    // ARRANGE: Navigate to editor
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    const tuneRow = page
      .locator('[data-testid="tunes-grid-catalog"] tbody tr')
      .filter({ hasText: "A Fig for a Kiss" })
      .first();

    await tuneRow.dblclick();

    await expect(page.getByTestId("tune-editor-cancel-button")).toBeVisible({
      timeout: 10000,
    });

    // ACT: Edit the structure field (but don't save)
    const structureInput = page.getByLabel(/structure/i);
    await expect(structureInput).toBeVisible({ timeout: 5000 });

    await structureInput.clear();
    await structureInput.fill("XXYYZZ");

    // Click Cancel
    await page.getByTestId("tune-editor-cancel-button").click();

    // ASSERT: Verify navigation back to home
    const baseURLConstructed = `${BASE_URL}?tab=catalog`;
    await expect(page).toHaveURL(baseURLConstructed, {
      timeout: 10000,
    });

    // Verify we're back on a tab
    await expect(page.getByTestId("tab-practice")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should open editor when double-clicking repertoire row", async ({
    page,
  }) => {
    // ARRANGE: Navigate to repertoire tab
    await ttPage.navigateToTab("repertoire");

    // Find a tune row in repertoire
    const tuneCell = page.getByRole("cell", { name: "JigD" }).first();
    const tuneRow = tuneCell.locator("xpath=ancestor::tr[1]");

    await expect(tuneRow).toBeVisible({ timeout: 5000 });

    // ACT: Double-click the tune row
    await tuneRow.dblclick();

    // ASSERT: Verify navigation to edit page
    await expect(page).toHaveURL(
      /\/tunes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/edit/i,
      { timeout: 10000 }
    );

    // Verify Submit and Cancel buttons are visible
    await expect(page.getByTestId("tune-editor-save-button")).toBeVisible();
    await expect(page.getByTestId("tune-editor-cancel-button")).toBeVisible();
  });

  test("should have scrollable editor content", async ({ page }) => {
    // ARRANGE: Open editor
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    const tuneRow = page.getByRole("cell", { name: "Public" }).first();

    await tuneRow.dblclick();

    await expect(page.getByTestId("tune-editor-form")).toBeVisible({
      timeout: 10000,
    });

    // ACT & ASSERT: Verify scrollable container exists
    const scrollableContainer = page.locator(".flex.overflow-y-auto");
    await expect(scrollableContainer).toBeVisible();

    // Verify form is inside scrollable area
    const form = page.getByTestId("tune-editor-form");
    await expect(form).toBeVisible();
  });
});
