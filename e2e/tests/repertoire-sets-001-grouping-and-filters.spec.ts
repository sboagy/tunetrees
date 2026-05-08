/**
 * FEATURE-593: Repertoire tune-set grouping and filtering
 * Priority: High
 *
 * Covers the repertoire-specific behaviors introduced in this PR using
 * deterministic tune-set fixtures seeded via helpers rather than brittle UI
 * creation flows.
 */

import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_BANISH_TITLE,
  TEST_TUNE_KESH_ID,
  TEST_TUNE_MORRISON_ID,
  TEST_TUNE_MORRISON_TITLE,
  TEST_TUNE_SWALLOWTAIL_ID,
  TEST_TUNE_SWALLOWTAIL_TITLE,
} from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

const PRIMARY_SET_NAME = "E2E Repertoire Set Alpha";
const SECONDARY_SET_NAME = "E2E Repertoire Set Beta";

test.describe("FEATURE-593: Repertoire tune-set grouping and filters", () => {
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [
        TEST_TUNE_BANISH_ID,
        TEST_TUNE_MORRISON_ID,
        TEST_TUNE_SWALLOWTAIL_ID,
        TEST_TUNE_KESH_ID,
      ],
      tuneSets: [
        {
          name: PRIMARY_SET_NAME,
          tuneIds: [TEST_TUNE_BANISH_ID, TEST_TUNE_MORRISON_ID],
        },
        {
          name: SECONDARY_SET_NAME,
          tuneIds: [TEST_TUNE_SWALLOWTAIL_ID],
        },
      ],
    });

    await ttPage.ensureGridView("repertoire");
    await ttPage.expectGridHasContent(ttPage.repertoireGrid);
  });

  test("shows set rows expanded by default with an inline expander control", async () => {
    const primarySetRow = ttPage.getRepertoireRowByText(PRIMARY_SET_NAME);
    const expanderButtons = primarySetRow.getByRole("button", {
      name: /collapse row/i,
    });

    await expect(primarySetRow).toBeVisible({ timeout: 10000 });
    await expect(expanderButtons.first()).toBeVisible({ timeout: 5000 });
    await expect(expanderButtons).toHaveCount(2);
    await expect(primarySetRow.locator('input[type="checkbox"]')).toHaveCount(
      0
    );

    await ttPage.expectTuneVisible(
      TEST_TUNE_BANISH_TITLE,
      ttPage.repertoireGrid
    );
    await ttPage.expectTuneVisible(
      TEST_TUNE_MORRISON_TITLE,
      ttPage.repertoireGrid
    );
  });

  test("can toggle Show Sets off to show only individual tune rows", async () => {
    await expect(ttPage.getRepertoireRowByText(PRIMARY_SET_NAME)).toBeVisible({
      timeout: 10000,
    });

    await ttPage.setRepertoireShowSets(false);

    await expect(ttPage.getRepertoireRowByText(PRIMARY_SET_NAME)).toHaveCount(
      0
    );
    await expect(ttPage.getRepertoireRowByText(SECONDARY_SET_NAME)).toHaveCount(
      0
    );
    await ttPage.expectTuneVisible(
      TEST_TUNE_BANISH_TITLE,
      ttPage.repertoireGrid
    );
    await ttPage.expectTuneVisible(
      TEST_TUNE_MORRISON_TITLE,
      ttPage.repertoireGrid
    );
    await expect(
      ttPage
        .getTuneRowById(TEST_TUNE_SWALLOWTAIL_ID, ttPage.repertoireGrid)
        .first()
    ).toBeVisible({ timeout: 10000 });

    await ttPage.setRepertoireShowSets(true);

    await expect(ttPage.getRepertoireRowByText(PRIMARY_SET_NAME)).toBeVisible({
      timeout: 10000,
    });
  });

  test("supports broad and specific Tune Set filter modes", async () => {
    await ttPage.setInTuneSetsFilter(true);

    await expect(ttPage.getRepertoireRowByText(PRIMARY_SET_NAME)).toBeVisible({
      timeout: 10000,
    });
    await expect(ttPage.getRepertoireRowByText(SECONDARY_SET_NAME)).toBeVisible(
      {
        timeout: 10000,
      }
    );

    await ttPage.selectTuneSetFilterByName(PRIMARY_SET_NAME);

    await expect
      .poll(() => ttPage.isInTuneSetsFilterEnabled(), {
        timeout: 5000,
        intervals: [100, 250, 500],
      })
      .toBe(false);

    await expect(ttPage.getRepertoireRowByText(PRIMARY_SET_NAME)).toBeVisible({
      timeout: 10000,
    });
    await expect(ttPage.getRepertoireRowByText(SECONDARY_SET_NAME)).toHaveCount(
      0
    );
    await ttPage.expectTuneVisible(
      TEST_TUNE_BANISH_TITLE,
      ttPage.repertoireGrid
    );
    await ttPage.expectTuneVisible(
      TEST_TUNE_MORRISON_TITLE,
      ttPage.repertoireGrid
    );
    await expect(
      ttPage.getRepertoireRowByText(TEST_TUNE_SWALLOWTAIL_TITLE)
    ).toHaveCount(0);
  });
});
