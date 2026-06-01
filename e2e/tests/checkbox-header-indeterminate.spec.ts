/**
 * E2E Test: Checkbox Header Indeterminate State
 *
 * Bug: Checkbox in table header doesn't update when rows are selected/deselected.
 * The indeterminate state only appears after switching tabs and returning.
 *
 * Test scenarios:
 * 1. Catalog: Select some rows, verify header shows indeterminate state immediately
 * 2. Repertoire: Select some rows, verify header shows indeterminate state immediately
 * 3. Catalog: Select all rows via header, verify header is checked
 * 4. Catalog: Deselect one row, verify header returns to indeterminate
 */

import { expect, type Locator } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

type GridTab = "catalog" | "repertoire";

async function expectCheckboxIndeterminate(
  checkbox: Locator,
  expected: boolean
) {
  // The indeterminate flag is a DOM property, not an attribute, so poll it
  // directly instead of sleeping and hoping Solid has flushed the update.
  await expect
    .poll(
      () =>
        checkbox.evaluate((element: HTMLInputElement) => element.indeterminate),
      {
        timeout: 5000,
        intervals: [100, 250, 500],
      }
    )
    .toBe(expected);
}

async function navigateToGridTab(ttPage: TuneTreesPage, tab: GridTab) {
  await ttPage.navigateToTab(tab);
  await ttPage.ensureGridView(tab);
}

test.describe("Checkbox Header Indeterminate State", () => {
  // This suite resets remote state, clears IndexedDB, waits for initial sync,
  // and normalizes two table view modes in beforeEach. CI browsers can exceed
  // the default 30s test budget before the actual checkbox assertion runs.
  test.describe.configure({ timeout: 90_000 });

  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, testUser }) => {
    // Setup: Seed several tunes in repertoire for selection testing
    const { privateTune1Id } = getPrivateTuneIds(testUser.userId);
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [privateTune1Id, TEST_TUNE_MORRISON_ID],
      scheduleTunes: false,
    });

    ttPage = new TuneTreesPage(page);
  });

  test("Catalog: header checkbox shows indeterminate when some rows selected", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await navigateToGridTab(ttPage, "catalog");
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    // Get header checkbox (first checkbox in grid)
    const headerCheckbox = page
      .locator('[data-testid="tunes-grid-catalog"] input[type="checkbox"]')
      .first();

    // Verify header is unchecked and not indeterminate initially
    await expect(headerCheckbox).not.toBeChecked();
    const initialIndeterminate = await headerCheckbox.evaluate(
      (el: HTMLInputElement) => el.indeterminate
    );
    expect(initialIndeterminate).toBe(false);

    // Select 2 rows (skip header at index 0, select rows at indices 1 and 2)
    const checkboxes = page.locator(
      '[data-testid="tunes-grid-catalog"] input[type="checkbox"]'
    );
    await expect(checkboxes.nth(2)).toBeVisible({ timeout: 10000 });
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    // Verify header checkbox is now indeterminate (this is the bug fix verification)
    await expectCheckboxIndeterminate(headerCheckbox, true);

    // Verify header is not checked (only indeterminate)
    await expect(headerCheckbox).not.toBeChecked();
  });

  test("Catalog: header checkbox is checked when all rows selected", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await navigateToGridTab(ttPage, "catalog");
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    const headerCheckbox = page
      .locator('[data-testid="tunes-grid-catalog"] input[type="checkbox"]')
      .first();

    // Click header checkbox to select all
    await headerCheckbox.click();

    // Verify header is checked
    await expect(headerCheckbox).toBeChecked({ timeout: 5000 });

    // Verify header is NOT indeterminate
    await expectCheckboxIndeterminate(headerCheckbox, false);
  });

  test("Catalog: header returns to indeterminate when one row deselected", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await navigateToGridTab(ttPage, "catalog");
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    const headerCheckbox = page
      .locator('[data-testid="tunes-grid-catalog"] input[type="checkbox"]')
      .first();
    const checkboxes = page.locator(
      '[data-testid="tunes-grid-catalog"] input[type="checkbox"]'
    );
    await expect(checkboxes.nth(1)).toBeVisible({ timeout: 10000 });

    // Select all via header
    await headerCheckbox.click();
    await expect(headerCheckbox).toBeChecked({ timeout: 5000 });

    // Deselect one row
    await checkboxes.nth(1).click();

    // Verify header is now indeterminate
    await expectCheckboxIndeterminate(headerCheckbox, true);
    await expect(headerCheckbox).not.toBeChecked();
  });

  test("Repertoire: header checkbox shows indeterminate when some rows selected", async ({
    page,
  }) => {
    // Navigate to Repertoire tab
    await navigateToGridTab(ttPage, "repertoire");
    await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
      timeout: 5000,
    });

    // Ensure checkboxes are rendered
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length >= 3,
      '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
    );

    const headerCheckbox = page
      .locator('[data-testid="tunes-grid-repertoire"] input[type="checkbox"]')
      .first();

    // Verify initial state
    await expect(headerCheckbox).not.toBeChecked();
    const initialIndeterminate = await headerCheckbox.evaluate(
      (el: HTMLInputElement) => el.indeterminate
    );
    expect(initialIndeterminate).toBe(false);

    // Select 1 row (we only have 2 rows in repertoire)
    const checkboxes = page.locator(
      '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
    );
    await checkboxes.nth(1).check();

    // Verify header checkbox is now indeterminate
    await expectCheckboxIndeterminate(headerCheckbox, true);
    await expect(headerCheckbox).not.toBeChecked();
  });

  test("Repertoire: header checkbox is checked when all rows selected", async ({
    page,
  }) => {
    // Navigate to Repertoire tab
    await navigateToGridTab(ttPage, "repertoire");
    await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
      timeout: 5000,
    });

    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length >= 3,
      '[data-testid="tunes-grid-repertoire"] input[type="checkbox"]'
    );

    const headerCheckbox = page
      .locator('[data-testid="tunes-grid-repertoire"] input[type="checkbox"]')
      .first();

    // Click header to select all
    await headerCheckbox.click();

    // Verify header is checked and not indeterminate
    await expect(headerCheckbox).toBeChecked({ timeout: 5000 });
    await expectCheckboxIndeterminate(headerCheckbox, false);
  });
});
