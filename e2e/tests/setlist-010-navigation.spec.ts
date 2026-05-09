/**
 * SETLIST-010: Navigation
 *
 * Covers URL-based and tab-based navigation into the setlists feature.
 */

import { expect } from "@playwright/test";
import { setupDefaultSetlistsScenario } from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe
  .serial("SETLIST-010: Navigation", () => {
    test.setTimeout(60000);

    test("J1. should navigate to the Setlists tab via URL", async ({
      page,
      testUser,
    }) => {
      const ttPage = new TuneTreesPage(page);
      await setupDefaultSetlistsScenario(page, testUser);

      await page.goto("/?tab=setlists", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/tab=setlists/);
      const desktopVisible = await ttPage.setlistsGroupSelect
        .isVisible()
        .catch(() => false);
      await expect(
        desktopVisible
          ? ttPage.setlistsGroupSelect
          : ttPage.setlistsGroupSelectMobile
      ).toBeVisible({ timeout: 10000 });
    });

    test("J2. should navigate to the Setlists tab from another tab", async ({
      page,
      testUser,
    }) => {
      const ttPage = new TuneTreesPage(page);
      await setupDefaultSetlistsScenario(page, testUser);

      await ttPage.navigateToTab("repertoire");
      await ttPage.navigateToSetlistsTab();

      await expect(page).toHaveURL(/tab=setlists/);
      await expect(
        ttPage.setlistsViewGrid.or(ttPage.setlistsNoSetlistsEmptyState)
      ).toBeVisible({
        timeout: 10000,
      });
    });
  });
