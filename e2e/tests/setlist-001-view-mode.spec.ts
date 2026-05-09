/**
 * SETLIST-001: View Mode Grid Display
 *
 * Covers the default setlists view rendering, ordering, hierarchy expansion,
 * and current-row highlighting using deterministic local fixtures.
 */

import { expect } from "@playwright/test";
import {
  SETLIST_TITLES,
  setupDefaultSetlistsScenario,
  waitForSetlistsViewReady,
} from "../helpers/setlist-test-helpers";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe
  .serial("SETLIST-001: View Mode", () => {
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

    test("A1. should render setlist items in the view grid", async () => {
      await expect(ttPage.setlistsViewGrid).toBeVisible({ timeout: 15000 });
      await expect(ttPage.getSetlistsViewRow(SETLIST_TITLES.alpha)).toBeVisible(
        {
          timeout: 10000,
        }
      );
      await expect(
        ttPage.getSetlistsViewRow(SETLIST_TITLES.defaultTuneSet)
      ).toBeVisible({ timeout: 10000 });
      await expect(ttPage.getSetlistsViewRow(SETLIST_TITLES.delta)).toBeVisible(
        { timeout: 10000 }
      );
    });

    test("A2. should display sequential order numbers for top-level items", async () => {
      const topLevelRows = ttPage.setlistsViewGrid.locator(
        "[data-testid='setlist-item-row'], [data-testid^='stacked-item-']"
      );
      const rowTexts = await topLevelRows.allTextContents();

      const alphaIndex = rowTexts.findIndex((text) =>
        text.includes(SETLIST_TITLES.alpha)
      );
      const setIndex = rowTexts.findIndex((text) =>
        text.includes(SETLIST_TITLES.defaultTuneSet)
      );
      const deltaIndex = rowTexts.findIndex((text) =>
        text.includes(SETLIST_TITLES.delta)
      );

      expect(alphaIndex).toBeGreaterThanOrEqual(0);
      expect(setIndex).toBeGreaterThan(alphaIndex);
      expect(deltaIndex).toBeGreaterThan(setIndex);
    });

    test("A3. should render a tune set as an expandable parent row", async () => {
      const setRow = ttPage.getSetlistsViewRow(SETLIST_TITLES.defaultTuneSet);

      await expect(setRow).toContainText(/Tune Set/i);
      await expect(
        setRow.getByRole("button", { name: /Collapse row|Expand row/i })
      ).toBeVisible({ timeout: 10000 });
    });

    test("A4. should expand a tune set row to show child tunes", async ({
      page,
    }) => {
      const setRow = ttPage.getSetlistsViewRow(SETLIST_TITLES.defaultTuneSet);

      await setRow
        .getByRole("button", { name: /Collapse row|Expand row/i })
        .click();

      await expect(page.getByText(SETLIST_TITLES.beta)).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(SETLIST_TITLES.gamma)).toBeVisible({
        timeout: 10000,
      });
    });

    test("A5. should highlight the current tune row after row selection", async () => {
      const tuneRow = ttPage.getSetlistsViewRow(SETLIST_TITLES.alpha);

      await tuneRow.click();
      await expect(tuneRow).toHaveClass(/bg-blue-50|dark:bg-blue-900\/25/, {
        timeout: 10000,
      });
    });
  });
