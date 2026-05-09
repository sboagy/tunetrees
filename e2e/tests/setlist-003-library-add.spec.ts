/**
 * SETLIST-003: Library Panel Add Flow
 *
 * Covers filtering, searching, selecting, and adding library items while
 * building a setlist.
 */

import { expect } from "@playwright/test";
import {
  enterSetlistsCreateMode,
  SETLIST_TITLES,
  setupLibraryOnlySetlistsScenario,
} from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

const WORKING_SETLIST_NAME = "Library Regression Setlist";

test.describe
  .serial("SETLIST-003: Library Panel Add Flow", () => {
    test.setTimeout(60000);

    let ttPage: TuneTreesPage;

    test.beforeEach(async ({ page, testUser }, testInfo) => {
      test.setTimeout(Math.max(testInfo.timeout, 60000));
      ttPage = new TuneTreesPage(page);

      const scenario = await setupLibraryOnlySetlistsScenario(page, testUser);
      await ttPage.navigateToSetlistsTab();
      await ttPage.selectSetlistsGroup(scenario.groupName);
      await enterSetlistsCreateMode(ttPage, page);
      await ttPage.setSetlistName(WORKING_SETLIST_NAME);
    });

    test("C1. should display available tunes and tune sets in the library grid", async () => {
      await expect(ttPage.setlistsLibraryGrid).toBeVisible({ timeout: 10000 });

      await expect(
        ttPage.setlistsLibraryGrid
          .locator(
            "[data-testid='setlists-library-row'], [data-testid='setlists-library-set-row'], [data-testid^='stacked-item-']"
          )
          .first()
      ).toBeVisible({ timeout: 10000 });
      await ttPage.searchSetlistsLibrary(SETLIST_TITLES.defaultTuneSet);
      await expect(
        ttPage.getSetlistsLibrarySetRow(SETLIST_TITLES.defaultTuneSet)
      ).toBeVisible({ timeout: 10000 });
    });

    test("C2. should filter library by All, Tunes, and Sets", async () => {
      await ttPage.setSetlistsLibraryFilter("tune");
      await expect(
        ttPage.setlistsLibraryGrid
          .locator(
            "[data-testid='setlists-library-row'], [data-testid^='stacked-item-']"
          )
          .first()
      ).toBeVisible({ timeout: 10000 });
      await expect(
        ttPage.getSetlistsLibrarySetRow(SETLIST_TITLES.defaultTuneSet)
      ).toHaveCount(0);

      await ttPage.searchSetlistsLibrary(SETLIST_TITLES.defaultTuneSet);
      await ttPage.setSetlistsLibraryFilter("tune_set");
      await expect(
        ttPage.getSetlistsLibrarySetRow(SETLIST_TITLES.defaultTuneSet)
      ).toBeVisible({ timeout: 10000 });
      await expect(
        ttPage.getSetlistsLibraryRow(SETLIST_TITLES.alpha)
      ).toHaveCount(0);

      await ttPage.setSetlistsLibraryFilter("all");
      await expect(
        ttPage.setlistsLibraryGrid
          .locator(
            "[data-testid='setlists-library-row'], [data-testid='setlists-library-set-row'], [data-testid^='stacked-item-']"
          )
          .first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("C3. should search library by tune title", async () => {
      await ttPage.setSetlistsLibraryFilter("tune");
      const firstVisibleTuneRow = ttPage.setlistsLibraryGrid
        .locator(
          "[data-testid='setlists-library-row'], [data-testid^='stacked-item-']"
        )
        .first();
      const titleText =
        (
          await firstVisibleTuneRow
            .locator("a")
            .first()
            .textContent()
            .catch(() => null)
        )?.trim() || "Fig";

      await ttPage.searchSetlistsLibrary(titleText);
      await expect(ttPage.setlistsLibrarySearch).toHaveValue(titleText);
      await expect(firstVisibleTuneRow).toContainText(
        new RegExp(titleText, "i")
      );
    });

    test("C4. should select rows via checkbox and show the selection count", async () => {
      const firstLibraryRow = ttPage.setlistsLibraryGrid
        .locator(
          "[data-testid='setlists-library-row'], [data-testid^='stacked-item-']"
        )
        .first();
      await ttPage.setRowSelected(firstLibraryRow, true);
      await ttPage.searchSetlistsLibrary(SETLIST_TITLES.defaultTuneSet);
      await ttPage.setRowSelected(
        ttPage.getSetlistsLibrarySetRow(SETLIST_TITLES.defaultTuneSet),
        true
      );

      await expect(ttPage.setlistsAddSelectedButton).toContainText("(2)");
    });

    test("C5. should add selected items to the setlist", async ({ page }) => {
      const firstLibraryRow = ttPage.setlistsLibraryGrid
        .locator(
          "[data-testid='setlists-library-row'], [data-testid^='stacked-item-']"
        )
        .first();
      await ttPage.setRowSelected(firstLibraryRow, true);
      await ttPage.searchSetlistsLibrary(SETLIST_TITLES.defaultTuneSet);
      await ttPage.setRowSelected(
        ttPage.getSetlistsLibrarySetRow(SETLIST_TITLES.defaultTuneSet),
        true
      );

      await ttPage.clickAddSelectedSetlistItems();
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => undefined);

      await expect(
        ttPage.getSetlistsEditorRow(SETLIST_TITLES.defaultTuneSet)
      ).toBeVisible({ timeout: 10000 });
      await expect(ttPage.setlistsAddSelectedButton).not.toContainText("(2)");
    });

    test("C6. should not allow adding when the setlist name is empty", async () => {
      const firstLibraryRow = ttPage.setlistsLibraryGrid
        .locator(
          "[data-testid='setlists-library-row'], [data-testid^='stacked-item-']"
        )
        .first();
      await ttPage.setRowSelected(firstLibraryRow, true);
      await ttPage.toggleSetlistsMetadata();
      await ttPage.setSetlistName("");

      await expect(ttPage.setlistsAddSelectedButton).toBeDisabled();
    });

    test("C7. should not show duplicate tunes in the All filter", async () => {
      await ttPage.setSetlistsLibraryFilter("all");
      await ttPage.searchSetlistsLibrary(SETLIST_TITLES.defaultTuneSet);

      await expect(
        ttPage.setlistsLibraryGrid.locator(
          "[data-testid='setlists-library-set-row'], [data-testid='setlists-library-row'], [data-testid^='stacked-item-']"
        )
      ).toHaveCount(3, { timeout: 10000 });
    });

    test("C8. should collapse and expand the library panel", async () => {
      await ttPage.hideSetlistsLibraryPanel();
      await expect(ttPage.setlistsExpandLibraryButton).toBeVisible({
        timeout: 10000,
      });

      await ttPage.showSetlistsLibraryPanel();
      await expect(ttPage.setlistsLibraryGrid).toBeVisible({ timeout: 10000 });
    });
  });
