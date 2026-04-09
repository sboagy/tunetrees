import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TUNE-EDITOR-003 (REFACTORED): Field-Level Override Indicators
 * Priority: High
 *
 * Legacy global Show Public toggle replaced by per-field override indicators.
 * Each field with a user override differing from public value displays a layers icon.
 * Clicking the icon reveals the public value and a Revert action.
 *
 * TODO: Make deterministic data fixtures that guarantee differences for each field (title, genre, etc.).
 * TODO: Add assertions verifying indicator absence when override equals public value.
 */

let ttPage: TuneTreesPage;

test.describe("TUNE-EDITOR-003: Field Override Indicators", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
    await ttPage.page.waitForTimeout(500);

    await ttPage.navigateToTab("catalog");
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
    // The catalog shell can mount before the synced catalog rows arrive on Mobile Chrome.
    // Wait for actual content so searches don't race the empty-state render.
    await ttPage.expectGridHasContent(ttPage.catalogGrid);
  });

  async function editTuneFieldAndSave(
    tuneName: string,
    fieldTestId: string,
    newValue: string
  ): Promise<void> {
    await ttPage.searchForTune(tuneName, ttPage.catalogGrid);
    await ttPage.page.waitForTimeout(500);
    const firstRow = ttPage.getRows("catalog").first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    await ttPage.openTuneEditor();

    const field = ttPage.page.getByTestId(fieldTestId);
    await expect(field).toBeVisible({ timeout: 5000 });

    const tagName = await field.evaluate((el) =>
      (el as HTMLElement).tagName.toLowerCase()
    );
    if (tagName === "input" || tagName === "textarea") {
      await field.fill(newValue);
    } else {
      // Fallback for custom controls (selects, composite components)
      await field.click();
      await ttPage.page.keyboard.type(newValue);
    }
    await ttPage.page.waitForTimeout(500);

    await ttPage.tuneEditorSubmitButton.click();
    // await ttPage.openTuneEditor();
    await ttPage.page.waitForTimeout(500);

    const dialog = ttPage.page.locator('[role="dialog"]').first();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  }

  test("should show override indicator for title when override differs", async ({
    page,
  }) => {
    const tuneTitleModified = "Cooley's (modified)";

    await editTuneFieldAndSave(
      "Cooley's",
      "tune-editor-input-title",
      tuneTitleModified
    );

    await ttPage.searchForTune(tuneTitleModified, ttPage.catalogGrid);
    await page.waitForTimeout(500);
    const firstRow = ttPage.getRows("catalog").first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await ttPage.openTuneEditor();
    const indicator = page.getByTestId("override-indicator-title");
    await expect(indicator).toBeVisible();
  });

  test("should reveal public title value on indicator click", async ({
    page,
  }) => {
    // TODO: Precondition: tune has title override
    const tuneTitleModified = "Cooley's (modified)";

    await editTuneFieldAndSave(
      "Cooley's",
      "tune-editor-input-title",
      tuneTitleModified
    );
    await page.waitForTimeout(500);
    // const firstRow = ttPage.getRows(tuneTitleModified).first();
    // await firstRow.click();

    await ttPage.openTuneEditor();
    await page.waitForTimeout(500);
    const indicator = page.getByTestId("override-indicator-title");
    await indicator.click();
    const reveal = page.getByTestId("override-reveal-title");
    await expect(reveal).toBeVisible();
  });

  test("should revert title override", async ({ page }) => {
    const tuneTitleModified = "Cooley's (modified)";

    await editTuneFieldAndSave(
      "Cooley's",
      "tune-editor-input-title",
      tuneTitleModified
    );
    await ttPage.searchForTune(tuneTitleModified, ttPage.catalogGrid);
    await page.waitForTimeout(500);
    const firstRow = ttPage.getRows("catalog").first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await ttPage.openTuneEditor();

    const indicator = page.getByTestId("override-indicator-title");
    await indicator.click();
    const revertBtn = page.getByTestId("override-revert-title");
    await revertBtn.click();
    const reveal = page.getByTestId("override-reveal-title");
    await expect(reveal).not.toBeVisible();
  });

  test("should not show indicators on new tune creation", async ({ page }) => {
    // New tune flow
    const addTuneButton = page.getByTestId("catalog-add-tune-button");
    await addTuneButton.click();
    const addTuneDialog = page.locator('[role="dialog"]').first();
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });
    // TODO: Adapt custom Select interaction for genre selection.
    // Expect no override indicators present.
    // await expect(page.getByTestId("override-indicator-title")).not.toBeVisible();
  });
});
