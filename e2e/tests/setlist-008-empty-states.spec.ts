/**
 * SETLIST-008: Empty States
 *
 * Covers empty states for groups without setlists, empty setlists, and empty
 * library searches.
 */

import { expect } from "@playwright/test";
import {
  enterSetlistsCreateMode,
  SETLIST_TITLES,
  setupEmptySetlistsScenario,
  setupLibraryOnlySetlistsScenario,
  setupNamedEmptySetlistScenario,
} from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe
  .serial("SETLIST-008: Empty States", () => {
    test.setTimeout(60000);

    test("H1. should show the no-setlists message when a group has none", async ({
      page,
      testUser,
    }) => {
      const ttPage = new TuneTreesPage(page);
      const scenario = await setupEmptySetlistsScenario(page, testUser);

      await ttPage.navigateToSetlistsTab();
      await ttPage.selectSetlistsGroup(scenario.groupName);
      await expect(ttPage.setlistsNoSetlistsEmptyState).toBeVisible({
        timeout: 10000,
      });
      await expect(ttPage.setlistsNoSetlistsEmptyState).toContainText(
        /No setlists yet/i
      );
    });

    test("H2. should show the empty-setlist message when the setlist has no items", async ({
      page,
      testUser,
    }) => {
      const ttPage = new TuneTreesPage(page);
      const scenario = await setupNamedEmptySetlistScenario(page, testUser);

      await ttPage.navigateToSetlistsTab();
      await ttPage.selectSetlistsGroup(scenario.groupName);
      await ttPage.selectSetlist(SETLIST_TITLES.emptySetlist);

      await expect(ttPage.setlistsEmptyViewState).toBeVisible({
        timeout: 10000,
      });
      await expect(ttPage.setlistsEmptyViewState).toContainText(
        /This setlist is empty/i
      );
    });

    test("H3. should show the no-match message in the library search", async ({
      page,
      testUser,
    }) => {
      const ttPage = new TuneTreesPage(page);
      const scenario = await setupLibraryOnlySetlistsScenario(page, testUser);

      await ttPage.navigateToSetlistsTab();
      await ttPage.selectSetlistsGroup(scenario.groupName);
      await enterSetlistsCreateMode(ttPage, page);
      await ttPage.setSetlistName("Search Empty State Setlist");
      await ttPage.searchSetlistsLibrary("xyznonexistent");

      await expect(ttPage.setlistsLibraryEmptyState).toBeVisible({
        timeout: 10000,
      });
      await expect(ttPage.setlistsLibraryEmptyState).toContainText(
        /No matching tunes or tune sets/i
      );
    });
  });
