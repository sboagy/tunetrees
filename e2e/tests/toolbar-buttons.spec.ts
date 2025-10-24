/**
 * E2E Test: Toolbar Button Hover Effects
 *
 * Bug #4: All toolbar buttons should have normal hover behavior
 * (change shade on hover).
 *
 * Test scenario:
 * Verify that all toolbar buttons include hover CSS classes
 * (hover:bg-gray-100 dark:hover:bg-gray-800)
 */

import { expect, test } from "@playwright/test";
import { setupForPracticeTests } from "../helpers/practice-scenarios";

test.use({ storageState: "e2e/.auth/alice.json" });

test.describe("Toolbar Button Hover Effects", () => {
  test.beforeEach(async ({ page }) => {
    // Setup with some tunes in repertoire
    await setupForPracticeTests(page, {
      repertoireTunes: [9001, 9002],
      startTab: "practice",
    });
  });

  test("Catalog toolbar buttons have hover classes", async ({ page }) => {
    // Navigate to Catalog tab
    await page.click('button:has-text("Catalog")');
    await page.waitForTimeout(500);

    // Check that Filters button has hover classes
    const filtersButton = page.locator('button:has-text("Filters")');
    const filtersClass = await filtersButton.getAttribute("class");
    expect(filtersClass).toContain("hover:bg-gray");

    // Check Add Tune button
    const addTuneButton = page.locator('button:has-text("Add Tune")');
    const addTuneClass = await addTuneButton.getAttribute("class");
    expect(addTuneClass).toContain("hover:bg-gray");

    // Check Columns button
    const columnsButton = page.locator('button:has-text("Columns")');
    const columnsClass = await columnsButton.getAttribute("class");
    expect(columnsClass).toContain("hover:bg-gray");
  });

  test("Repertoire toolbar buttons have hover classes", async ({ page }) => {
    // Navigate to Repertoire tab
    await page.click('button:has-text("Repertoire")');
    await page.waitForTimeout(500);

    // Check that Filters button has hover classes
    const filtersButton = page.locator('button:has-text("Filters")');
    const filtersClass = await filtersButton.getAttribute("class");
    expect(filtersClass).toContain("hover:bg-gray");

    // Check Columns button
    const columnsButton = page.locator('button:has-text("Columns")');
    const columnsClass = await columnsButton.getAttribute("class");
    expect(columnsClass).toContain("hover:bg-gray");
  });

  test("Practice toolbar buttons have hover classes", async ({ page }) => {
    // Navigate to Practice tab
    await page.click('button:has-text("Practice")');
    await page.waitForTimeout(500);

    // Check that Columns button has hover classes
    const columnsButton = page.locator('button:has-text("Columns")');
    const columnsClass = await columnsButton.getAttribute("class");
    expect(columnsClass).toContain("hover:bg-gray");

    // Enable Submit by selecting an evaluation on the first row
    const firstEval = page.locator('[data-testid^="recall-eval-"]').first();
    await firstEval.click();
    await page.click('button:has-text("Good")');
    const submitButton = page.locator('button:has-text("Submit")');
    const submitClass = await submitButton.getAttribute("class");
    expect(submitClass).toContain("hover:");
  });
});
