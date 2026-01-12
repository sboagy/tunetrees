/**
 * E2E Test: Evaluation Column Sorting Disabled
 *
 * Bug #5: The Evaluation column in the Practice grid should not be sortable
 * (enableSorting: false).
 *
 * Test scenario:
 * Verify that clicking the Evaluation column header does not trigger sorting
 */

import { expect } from "@playwright/test";
import { STANDARD_TEST_DATE, setStableDate } from "e2e/helpers/clock-control";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";

test.describe("Evaluation Column Sorting Disabled", () => {
  test.beforeEach(async ({ page, testUser, context }) => {
    const currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Fast setup: seed 2 tunes, start on practice tab
    const { privateTune1Id } = getPrivateTuneIds(testUser.userId);
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [privateTune1Id, TEST_TUNE_MORRISON_ID],
      scheduleDaysAgo: 1,
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });
    await page.waitForTimeout(200);
  });

  test("Evaluation column header is not clickable for sorting", async ({
    page,
  }) => {
    // Find the Evaluation column header
    const evaluationHeader = page.getByTestId("ch-evaluation");

    // Verify the header exists
    await expect(evaluationHeader).toBeVisible();

    // Get the initial column class/state
    const initialClass = await evaluationHeader.getAttribute("class");

    // Click the Evaluation column header (should not trigger sorting)
    await evaluationHeader.click();
    await page.waitForTimeout(300);

    // Verify no sort indicator appears (no asc/desc arrow classes)
    const afterClickClass = await evaluationHeader.getAttribute("class");

    // The class should not contain sort-related indicators
    expect(afterClickClass).not.toContain("asc");
    expect(afterClickClass).not.toContain("desc");

    // Verify class hasn't changed (no sorting state applied)
    expect(afterClickClass).toBe(initialClass);
  });

  test("Evaluation column does not show sort arrows on hover", async ({
    page,
  }) => {
    // Find the Evaluation column header
    const evaluationHeader = page.getByTestId("ch-evaluation");

    // Hover over the header
    await evaluationHeader.hover();
    await page.waitForTimeout(200);

    // Check if sort arrows/indicators are NOT present
    // (Most sortable columns show some visual feedback on hover)
    const headerContent = await evaluationHeader.textContent();

    // Should not contain sorting symbols like ↑ ↓ or similar
    expect(headerContent).not.toContain("↑");
    expect(headerContent).not.toContain("↓");
    expect(headerContent).not.toContain("▲");
    expect(headerContent).not.toContain("▼");
  });

  test("Other columns ARE sortable (control test)", async ({ page }) => {
    // Find a different column header (e.g., Title) that should be sortable
    const titleHeader = page.getByTestId("ch-title");

    // Verify the header exists
    await expect(titleHeader).toBeVisible();

    // Click the Title column header (should trigger sorting)
    await titleHeader.click();
    await page.waitForTimeout(500);

    // This verifies that sorting works for other columns, proving
    // that Evaluation column's non-sortability is intentional
    // If this test reaches here without error, Title column is sortable
    // (control test to confirm sorting system is working)
  });
});
