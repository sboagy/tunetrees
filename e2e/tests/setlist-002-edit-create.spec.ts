/**
 * SETLIST-002: Edit and Create Mode
 *
 * Covers entering edit/create mode, name validation, and persisting setlist
 * metadata through the main create flow.
 */

import { expect } from "@playwright/test";
import {
  enterSetlistsCreateMode,
  enterSetlistsEditMode,
  SETLIST_TITLES,
  setupDefaultSetlistsScenario,
  waitForSetlistsViewReady,
} from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

const CREATED_SETLIST_NAME = "Setlist Creation Regression";
const CREATED_SETLIST_NOTES = "Created in Playwright regression coverage.";

test.describe
  .serial("SETLIST-002: Edit and Create Mode", () => {
    test.setTimeout(60000);

    let ttPage: TuneTreesPage;

    test.beforeEach(async ({ page, testUser }, testInfo) => {
      test.setTimeout(Math.max(testInfo.timeout, 60000));
      ttPage = new TuneTreesPage(page);

      const scenario = await setupDefaultSetlistsScenario(page, testUser);
      await ttPage.navigateToSetlistsTab();
      await ttPage.selectSetlistsGroup(scenario.groupName);
      await ttPage.selectSetlist(SETLIST_TITLES.defaultSetlist);
      await waitForSetlistsViewReady(page);
    });

    test("B1. should enter edit mode when clicking Edit", async ({ page }) => {
      await enterSetlistsEditMode(ttPage, page);

      await expect(ttPage.setlistsLibraryGrid).toBeVisible({ timeout: 10000 });
      await expect(ttPage.setlistsEditorGrid).toBeVisible({ timeout: 10000 });
      await expect(
        ttPage.getSetlistsEditorRow(SETLIST_TITLES.alpha)
      ).toBeVisible({ timeout: 10000 });
    });

    test("B2. should enter create mode when clicking New Setlist", async ({
      page,
    }) => {
      await enterSetlistsCreateMode(ttPage, page);

      await expect(ttPage.setlistEditorNameInputCollapsed).toBeVisible({
        timeout: 10000,
      });
      await expect(ttPage.setlistEditorNameInputCollapsed).toHaveValue("");
      await expect(ttPage.setlistsLibraryGrid).toBeVisible({ timeout: 10000 });
    });

    test("B3. should show validation when setlist name is empty", async ({
      page,
    }) => {
      await enterSetlistsCreateMode(ttPage, page);
      await ttPage.toggleSetlistsMetadata();

      await expect(
        page.getByText(/Setlist name is required before adding/i)
      ).toBeVisible({
        timeout: 10000,
      });
      await expect(ttPage.setlistsAddSelectedButton).toBeDisabled();
    });

    test("B4. should enable add after typing a valid setlist name", async ({
      page,
    }) => {
      await enterSetlistsCreateMode(ttPage, page);

      const firstLibraryRow = ttPage.setlistsLibraryGrid
        .locator(
          "[data-testid='setlists-library-row'], [data-testid='setlists-library-set-row'], [data-testid^='stacked-item-']"
        )
        .first();
      await ttPage.setRowSelected(firstLibraryRow, true);
      await expect(ttPage.setlistsAddSelectedButton).toBeDisabled();

      await ttPage.setSetlistName(CREATED_SETLIST_NAME);

      await expect(ttPage.setlistsAddSelectedButton).toBeEnabled({
        timeout: 10000,
      });
    });

    test("B5. should persist entered setlist name and notes when saving", async ({
      page,
    }) => {
      await enterSetlistsCreateMode(ttPage, page);

      await ttPage.setSetlistName(CREATED_SETLIST_NAME);
      await ttPage.setSetlistNotes(CREATED_SETLIST_NOTES);
      await ttPage.clickSetlistsDoneEditing();
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => undefined);

      await expect
        .poll(async () => {
          await ttPage
            .selectSetlist(CREATED_SETLIST_NAME)
            .catch(() => undefined);
          return await ttPage.getSelectedSetlistLabel();
        })
        .toBe(CREATED_SETLIST_NAME);

      await enterSetlistsEditMode(ttPage, page);
      await ttPage.toggleSetlistsMetadata();

      await expect(ttPage.setlistEditorNameInput).toHaveValue(
        CREATED_SETLIST_NAME,
        {
          timeout: 10000,
        }
      );
      await expect(ttPage.setlistEditorDescriptionInput).toHaveValue(
        CREATED_SETLIST_NOTES,
        {
          timeout: 10000,
        }
      );
    });
  });
