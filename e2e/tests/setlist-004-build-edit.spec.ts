/**
 * SETLIST-004: Build Panel Editing
 *
 * Covers drag handles, reordering, removal, and editor-state transitions in
 * the setlist build panel.
 */

import { expect } from "@playwright/test";
import {
  acceptNextDialog,
  enterSetlistsEditMode,
  expectToast,
  SETLIST_TITLES,
  setupDefaultSetlistsScenario,
} from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe
  .serial("SETLIST-004: Build Panel Editing", () => {
    test.setTimeout(60000);

    let ttPage: TuneTreesPage;

    test.beforeEach(async ({ page, testUser }, testInfo) => {
      test.setTimeout(Math.max(testInfo.timeout, 60000));
      ttPage = new TuneTreesPage(page);

      const scenario = await setupDefaultSetlistsScenario(page, testUser);
      await ttPage.navigateToSetlistsTab();
      await ttPage.selectSetlistsGroup(scenario.groupName);
      await ttPage.selectSetlist(SETLIST_TITLES.defaultSetlist);
      await enterSetlistsEditMode(ttPage, page);
    });

    test("D1. should show drag handles on setlist items", async ({
      page: _page,
    }, testInfo) => {
      test.skip(
        /Mobile Chrome/i.test(testInfo.project.name),
        "Drag handles only render in the desktop grid layout. See issue #604."
      );

      for (const title of [
        SETLIST_TITLES.alpha,
        SETLIST_TITLES.defaultTuneSet,
        SETLIST_TITLES.delta,
      ]) {
        await expect(
          ttPage
            .getSetlistsEditorRow(title)
            .locator("[data-testid='setlist-editor-drag-handle']")
            .first()
        ).toBeVisible({ timeout: 10000 });
      }
    });

    test("D2. should reorder items from the drag handle", async ({
      page: _page,
    }, testInfo) => {
      test.skip(
        /Mobile Chrome/i.test(testInfo.project.name),
        "Reorder handles only render in the desktop grid layout. See issue #604."
      );

      await ttPage.moveSetlistEditorRowDown(SETLIST_TITLES.alpha);

      // D2 covers reorder persistence through the focused handle control. D3
      // still covers pointer-drag visual feedback separately.
      await expect
        .poll(
          async () => {
            const rowTexts = await ttPage.setlistsEditorGrid
              .locator(
                "[data-testid='setlist-editor-item-row'], [data-testid^='stacked-item-']"
              )
              .allTextContents();
            const tuneSetIndex = rowTexts.findIndex((text) =>
              text.includes(SETLIST_TITLES.defaultTuneSet)
            );
            const alphaIndex = rowTexts.findIndex((text) =>
              text.includes(SETLIST_TITLES.alpha)
            );
            const deltaIndex = rowTexts.findIndex((text) =>
              text.includes(SETLIST_TITLES.delta)
            );

            return tuneSetIndex < alphaIndex && alphaIndex < deltaIndex;
          },
          {
            timeout: 10000,
            intervals: [100, 250, 500, 1000],
          }
        )
        .toBe(true);
    });

    test("D3. should show visual feedback during drag", async ({
      page,
    }, testInfo) => {
      test.skip(
        /Mobile Chrome/i.test(testInfo.project.name),
        "Drag feedback is only rendered in the desktop grid layout. See issue #604."
      );

      const sourceRow = ttPage.getSetlistsEditorRow(SETLIST_TITLES.alpha);
      const targetRow = ttPage.getSetlistsEditorRow(SETLIST_TITLES.delta);
      const dragHandle = sourceRow
        .locator("[data-testid='setlist-editor-drag-handle']")
        .first();

      const sourceBox = await dragHandle.boundingBox();
      const targetBox = await targetRow.boundingBox();
      expect(sourceBox).not.toBeNull();
      expect(targetBox).not.toBeNull();

      await page.mouse.move(
        sourceBox!.x + sourceBox!.width / 2,
        sourceBox!.y + sourceBox!.height / 2
      );
      await page.mouse.down();
      await expect(sourceRow).toHaveClass(/opacity-60/, { timeout: 10000 });

      await page.mouse.move(
        targetBox!.x + targetBox!.width / 2,
        targetBox!.y + targetBox!.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();
    });

    test("D4. should remove items via checkbox and Remove button", async ({
      page,
    }) => {
      await ttPage.setRowSelected(
        ttPage.getSetlistsEditorRow(SETLIST_TITLES.alpha),
        true
      );
      await ttPage.setRowSelected(
        ttPage.getSetlistsEditorRow(SETLIST_TITLES.delta),
        true
      );

      await acceptNextDialog(page);
      await ttPage.clickRemoveSelectedSetlistItems();
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => undefined);

      await expectToast(page, /Removed 2 items?/i);
      await expect(
        ttPage.getSetlistsEditorRow(SETLIST_TITLES.alpha)
      ).toHaveCount(0);
      await expect(
        ttPage.getSetlistsEditorRow(SETLIST_TITLES.delta)
      ).toHaveCount(0);
    });

    test("D5. should not allow removing when the setlist name is empty", async ({
      page,
    }) => {
      await ttPage.setRowSelected(
        ttPage.getSetlistsEditorRow(SETLIST_TITLES.alpha),
        true
      );
      await ttPage.toggleSetlistsMetadata();
      await ttPage.setSetlistName("");

      const desktopVisible = await ttPage.setlistsRemoveSelectedButton
        .isVisible()
        .catch(() => false);

      if (desktopVisible) {
        await expect(ttPage.setlistsRemoveSelectedButton).toBeDisabled();
        return;
      }

      await ttPage.setlistsSetlistPanelOverflowButton.click();
      await expect(
        page.getByTestId("setlists-remove-selected-menu-button")
      ).toBeDisabled();
    });

    test("D6. should exit edit mode when selecting a different setlist", async () => {
      await ttPage.selectSetlist(SETLIST_TITLES.secondarySetlist);

      await expect(ttPage.setlistsEditorGrid).toHaveCount(0);
      await expect(ttPage.setlistsViewGrid).toBeVisible({ timeout: 10000 });
    });
  });
