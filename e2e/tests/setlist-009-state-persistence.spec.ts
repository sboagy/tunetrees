/**
 * SETLIST-009: State Persistence
 *
 * Covers restoring the selected group/setlist and edit mode after a page
 * reload.
 */

import { expect, type Page } from "@playwright/test";
import {
  enterSetlistsEditMode,
  SETLIST_TITLES,
  setupDefaultSetlistsScenario,
  waitForSetlistsViewReady,
} from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

type PersistedSetlistsState = {
  groupId?: string;
  setlistId?: string;
  mode?: string;
  create?: string;
};

async function readPersistedSetlistsState(page: Page, userId: string) {
  return await page.evaluate((nextUserId) => {
    const raw = localStorage.getItem(`tt:setlists:state:${nextUserId}`);
    return raw ? (JSON.parse(raw) as PersistedSetlistsState) : null;
  }, userId);
}

async function expectPersistedSetlistsSelection(
  page: Page,
  userId: string,
  expected: { groupId: string; setlistId: string }
) {
  // This check intentionally validates persisted route state separately from
  // the visible <select> controls. It lets the test distinguish between
  // "reload lost the saved selection" and "reload kept the saved selection,
  // but the async dropdown options are not showing it yet".
  await expect
    .poll(() => readPersistedSetlistsState(page, userId))
    .toMatchObject(expected);
}

test.describe
  .serial("SETLIST-009: State Persistence", () => {
    test.setTimeout(60000);

    test("I1. should restore group and setlist selection on page reload", async ({
      page,
      testUser,
    }) => {
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

      await expectPersistedSetlistsSelection(page, testUser.userId, {
        groupId: scenario.groupId,
        setlistId: expectedSetlistId,
      });

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForSetlistsViewReady(page);

      await expectPersistedSetlistsSelection(page, testUser.userId, {
        groupId: scenario.groupId,
        setlistId: expectedSetlistId,
      });

      // Once persisted route state has settled after reload, these polls verify
      // the visible group/setlist controls have caught up to the restored state.
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
