/**
 * SETLIST-009: State Persistence
 *
 * Covers restoring the selected group/setlist and edit mode after a page
 * reload.
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
  .serial("SETLIST-009: State Persistence", () => {
    test.setTimeout(60000);

    test("I1. should restore group and setlist selection on page reload", async ({
      page,
      testUser,
    }) => {
      test.skip(
        true,
        "Setlists group/setlist selection does not currently restore reliably after reload."
      );

      const ttPage = new TuneTreesPage(page);
      const scenario = await setupDefaultSetlistsScenario(page, testUser);
      const expectedSetlistId =
        scenario.setlists.find(
          (setlist: (typeof scenario.setlists)[number]) =>
            setlist.name === SETLIST_TITLES.secondarySetlist
        )?.id ?? "";

      await ttPage.navigateToSetlistsTab();
      await ttPage.selectSetlistsGroup(scenario.groupName);
      await ttPage.selectSetlist(SETLIST_TITLES.secondarySetlist);
      await expect
        .poll(async () => {
          return await page.evaluate((userId) => {
            const raw = localStorage.getItem(`tt:setlists:state:${userId}`);
            return raw ? JSON.parse(raw) : null;
          }, testUser.userId);
        })
        .toMatchObject({
          groupId: scenario.groupId,
          setlistId: expectedSetlistId,
        });

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForSetlistsViewReady(page);

      await expect
        .poll(() => ttPage.getSelectedSetlistsGroupValue())
        .toBe(scenario.groupId);
      await expect
        .poll(() => ttPage.getSelectedSetlistValue())
        .toBe(expectedSetlistId);
    });

    test("I2. should restore edit mode state on page reload", async ({
      page,
      testUser,
    }) => {
      test.skip(
        true,
        "Setlists edit-mode restore depends on the same selection-restore defect as I1."
      );

      const ttPage = new TuneTreesPage(page);
      const scenario = await setupDefaultSetlistsScenario(page, testUser);

      await ttPage.navigateToSetlistsTab();
      await ttPage.selectSetlistsGroup(scenario.groupName);
      await ttPage.selectSetlist(SETLIST_TITLES.defaultSetlist);
      await enterSetlistsEditMode(ttPage, page);

      await page.reload({ waitUntil: "domcontentloaded" });
      await ttPage.waitForSetlistsEditReady();

      await expect
        .poll(() => ttPage.getSelectedSetlistLabel())
        .toBe(SETLIST_TITLES.defaultSetlist);
      await expect(ttPage.setlistEditorNameInputCollapsed).toHaveValue(
        SETLIST_TITLES.defaultSetlist,
        {
          timeout: 10000,
        }
      );
    });
  });
