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
      // The lazy tab may not have mounted yet. Wait for the responsive control
      // instead of interpreting a not-yet-visible desktop control as mobile.
      await expect(
        ttPage.setlistsGroupSelect
          .or(ttPage.setlistsGroupSelectMobile)
          .filter({ visible: true })
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
