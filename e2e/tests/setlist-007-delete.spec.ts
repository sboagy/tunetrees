/**
 * SETLIST-007: Delete Setlist
 *
 * Covers delete affordances and the destructive delete flow for existing
 * setlists.
 */

import { expect } from "@playwright/test";
import {
  acceptNextDialog,
  enterSetlistsEditMode,
  expectToast,
  SETLIST_TITLES,
  setupDefaultSetlistsScenario,
  waitForSetlistsViewReady,
} from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe
  .serial("SETLIST-007: Delete Setlist", () => {
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

    test("G1. should show Delete button in edit mode", async ({ page }) => {
      await enterSetlistsEditMode(ttPage, page);

      const desktopVisible = await ttPage.setlistsDeleteButton
        .isVisible()
        .catch(() => false);
      if (desktopVisible) {
        await expect(ttPage.setlistsDeleteButton).toBeVisible({
          timeout: 10000,
        });
        return;
      }

      await ttPage.setlistsOverflowButton.click();
      await expect(
        page.getByTestId("setlists-overflow-delete-button")
      ).toBeVisible({
        timeout: 10000,
      });
    });

    test("G2. should not show Delete button in view mode toolbar", async ({
      page,
    }) => {
      await expect(ttPage.setlistsDeleteButton).toHaveCount(0);

      const mobileOverflowVisible = await ttPage.setlistsOverflowButton
        .isVisible()
        .catch(() => false);
      if (!mobileOverflowVisible) {
        return;
      }

      await ttPage.setlistsOverflowButton.click();
      await expect(
        page.getByTestId("setlists-overflow-delete-button")
      ).toHaveCount(0);
    });

    test("G3. should delete a setlist from edit mode", async ({ page }) => {
      await enterSetlistsEditMode(ttPage, page);
      await acceptNextDialog(page);
      await ttPage.clickSetlistsDelete();
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => undefined);

      await expectToast(page, /Deleted setlist/i);
      await expect
        .poll(() => ttPage.getSelectedSetlistLabel())
        .toBe(SETLIST_TITLES.secondarySetlist);
    });
  });
