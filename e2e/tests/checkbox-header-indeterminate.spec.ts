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

import { expect } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe("Checkbox Header Indeterminate State", () => {
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
    await ttPage.navigateToTab("catalog");
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
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    // Wait a bit for reactivity to update
    await page.waitForTimeout(200);

    // Verify header checkbox is now indeterminate (this is the bug fix verification)
    const isIndeterminate = await headerCheckbox.evaluate(
      (el: HTMLInputElement) => el.indeterminate
    );
    expect(isIndeterminate).toBe(true);

    // Verify header is not checked (only indeterminate)
    await expect(headerCheckbox).not.toBeChecked();
  });

  test("Catalog: header checkbox is checked when all rows selected", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await ttPage.navigateToTab("catalog");
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    const headerCheckbox = page
      .locator('[data-testid="tunes-grid-catalog"] input[type="checkbox"]')
      .first();

    // Click header checkbox to select all
    await headerCheckbox.click();
    await page.waitForTimeout(200);

    // Verify header is checked
    await expect(headerCheckbox).toBeChecked();

    // Verify header is NOT indeterminate
    const isIndeterminate = await headerCheckbox.evaluate(
      (el: HTMLInputElement) => el.indeterminate
    );
    expect(isIndeterminate).toBe(false);
  });

  test("Catalog: header returns to indeterminate when one row deselected", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await ttPage.navigateToTab("catalog");
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    const headerCheckbox = page
      .locator('[data-testid="tunes-grid-catalog"] input[type="checkbox"]')
      .first();
    const checkboxes = page.locator(
      '[data-testid="tunes-grid-catalog"] input[type="checkbox"]'
    );

    // Select all via header
    await headerCheckbox.click();
    await page.waitForTimeout(200);
    await expect(headerCheckbox).toBeChecked();

    // Deselect one row
    await checkboxes.nth(1).click();
    await page.waitForTimeout(200);

    // Verify header is now indeterminate
    const isIndeterminate = await headerCheckbox.evaluate(
      (el: HTMLInputElement) => el.indeterminate
    );
    expect(isIndeterminate).toBe(true);
    await expect(headerCheckbox).not.toBeChecked();
  });

  test("Repertoire: header checkbox shows indeterminate when some rows selected", async ({
    page,
  }) => {
    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");
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
    await page.waitForTimeout(200);

    // Verify header checkbox is now indeterminate
    const isIndeterminate = await headerCheckbox.evaluate(
      (el: HTMLInputElement) => el.indeterminate
    );
    expect(isIndeterminate).toBe(true);
    await expect(headerCheckbox).not.toBeChecked();
  });

  test("Repertoire: header checkbox is checked when all rows selected", async ({
    page,
  }) => {
    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");
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
    await page.waitForTimeout(200);

    // Verify header is checked and not indeterminate
    await expect(headerCheckbox).toBeChecked();
    const isIndeterminate = await headerCheckbox.evaluate(
      (el: HTMLInputElement) => el.indeterminate
    );
    expect(isIndeterminate).toBe(false);
  });
});
