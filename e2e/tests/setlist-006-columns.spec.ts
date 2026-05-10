/**
 * SETLIST-006: Display Options
 *
 * Covers the setlists column visibility menus for the view, library, and
 * editor grids, along with persistence of view-grid settings.
 */

import { expect } from "@playwright/test";
import {
  enterSetlistsEditMode,
  SETLIST_TITLES,
  setupDefaultSetlistsScenario,
  waitForSetlistsViewReady,
} from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe
  .serial("SETLIST-006: Display Options", () => {
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

    test("F1. should open view-mode display options", async ({ page }) => {
      await ttPage.openSetlistsColumnVisibilityMenu("view");

      const menu = page.getByTestId("column-visibility-menu").last();
      await expect(menu).toBeVisible({ timeout: 10000 });
      await expect(menu).toContainText("Type");
      await expect(menu).toContainText("Details");
    });

    test("F2. should toggle column visibility in view mode", async () => {
      await ttPage.setSetlistsColumnVisibility("view", "Type", false);

      await expect(
        ttPage.getSetlistsViewRow(SETLIST_TITLES.defaultTuneSet)
      ).not.toContainText(/Tune Set/i);
    });

    test("F3. should open library display options in edit mode", async ({
      page,
    }) => {
      await enterSetlistsEditMode(ttPage, page);
      await ttPage.openSetlistsColumnVisibilityMenu("library");

      await expect(
        page.getByTestId("column-visibility-menu").last()
      ).toBeVisible({
        timeout: 10000,
      });
    });

    test("F4. should open editor display options in edit mode", async ({
      page,
    }) => {
      await enterSetlistsEditMode(ttPage, page);
      await ttPage.openSetlistsColumnVisibilityMenu("editor");

      await expect(
        page.getByTestId("column-visibility-menu").last()
      ).toBeVisible({
        timeout: 10000,
      });
    });

    test("F5. should persist column visibility per grid scope", async ({
      page,
    }) => {
      test.skip(
        /Mobile Chrome/i.test(test.info().project.name),
        "The mobile stacked-list layout does not currently reflect view-grid column visibility changes. See issue #604."
      );

      await ttPage.setSetlistsColumnVisibility("view", "Mode", false);
      await expect(
        ttPage.getSetlistsViewRow(SETLIST_TITLES.alpha)
      ).not.toContainText(/recall/i);

      await enterSetlistsEditMode(ttPage, page);
      await ttPage.clickSetlistsDoneEditing();
      await waitForSetlistsViewReady(page);

      await expect(
        ttPage.getSetlistsViewRow(SETLIST_TITLES.alpha)
      ).not.toContainText(/recall/i);
    });
  });
