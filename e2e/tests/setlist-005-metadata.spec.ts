/**
 * SETLIST-005: Metadata Panel
 *
 * Covers the collapsed and expanded metadata states used while editing a
 * setlist.
 */

import { expect } from "@playwright/test";
import {
  enterSetlistsEditMode,
  SETLIST_TITLES,
  setupDefaultSetlistsScenario,
} from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

const UPDATED_NAME = "Collapsed Metadata Name";

test.describe
  .serial("SETLIST-005: Metadata Panel", () => {
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

    test("E1. should show collapsed metadata header by default", async () => {
      await expect(ttPage.setlistEditorNameInputCollapsed).toBeVisible({
        timeout: 10000,
      });
      await expect(ttPage.setlistEditorDescriptionInput).toHaveCount(0);
    });

    test("E2. should expand metadata on chevron click", async () => {
      await ttPage.toggleSetlistsMetadata();

      await expect(ttPage.setlistEditorNameInput).toBeVisible({
        timeout: 10000,
      });
      await expect(ttPage.setlistEditorDescriptionInput).toBeVisible({
        timeout: 10000,
      });
    });

    test("E3. should collapse metadata on chevron click", async () => {
      await ttPage.toggleSetlistsMetadata();
      await ttPage.toggleSetlistsMetadata();

      await expect(ttPage.setlistEditorNameInputCollapsed).toBeVisible({
        timeout: 10000,
      });
      await expect(ttPage.setlistEditorDescriptionInput).toHaveCount(0);
    });

    test("E4. should preserve name edits across collapse and expand", async () => {
      await ttPage.toggleSetlistsMetadata();
      await ttPage.setSetlistName(UPDATED_NAME);
      await ttPage.toggleSetlistsMetadata();

      await expect(ttPage.setlistEditorNameInputCollapsed).toHaveValue(
        UPDATED_NAME,
        { timeout: 10000 }
      );

      await ttPage.toggleSetlistsMetadata();
      await expect(ttPage.setlistEditorNameInput).toHaveValue(UPDATED_NAME, {
        timeout: 10000,
      });
    });
  });
