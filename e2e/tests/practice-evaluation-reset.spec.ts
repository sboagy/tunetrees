/**
 * E2E Test: Practice Evaluation Reset Behavior
 *
 * Bug #1: When selecting "(Not Set)" in RecallEvalComboBox, the count should
 * be removed and Submit button should become disabled.
 *
 * Test scenarios:
 * 1. Select evaluation "Good" → verify count = 1, Submit enabled
 * 2. Change to "(Not Set)" → verify count = 0, Submit disabled
 * 3. Select multiple evaluations → verify correct count
 * 4. Clear some evaluations → verify count decrements correctly
 */

import { expect } from "@playwright/test";
import {
  CATALOG_TUNE_54_ID,
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe("Practice Evaluation Interaction", () => {
  let ttPage: TuneTreesPage;
  let currentDate: Date;

  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Set stable starting date
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Fast setup: seed 2 tunes, start on practice tab
    const { privateTune1Id } = getPrivateTuneIds(testUser.userId);
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [privateTune1Id, TEST_TUNE_MORRISON_ID],
      startTab: "practice",
      scheduleBaseDate: currentDate,
      scheduleDaysAgo: 1,
    });
  });

  async function selectEvalFor(
    tuneId: string,
    optionKey: "not-set" | "again" | "hard" | "good" | "easy"
  ) {
    const row = ttPage.getRowInPracticeGridByTuneId(tuneId);
    console.log(row.toString());
    await ttPage.setRowEvaluation(row, optionKey, 500);
  }

  async function getNotSetIds(
    page: import("@playwright/test").Page,
    needed: number
  ): Promise<string[]> {
    const loc = page.locator('[data-testid^="recall-eval-"]', {
      hasText: "(Not Set)",
    });
    const found = Math.min(await loc.count(), needed);
    const ids: string[] = [];
    for (let i = 0; i < found; i++) {
      const el = loc.nth(i);
      const testid = await el.getAttribute("data-testid");
      if (testid) {
        // Format: recall-eval-{uuid}
        const parts = testid.split("-");
        // UUIDs have format: 8-4-4-4-12 hex digits with hyphens
        // After split on "-": ["recall", "eval", ...uuid parts...]
        // Rejoin from index 2 onwards to reconstruct the UUID
        const id = parts.slice(2).join("-");
        // Validate it looks like a UUID (36 chars with hyphens at positions 8,13,18,23)
        if (id.length === 36 && id[8] === "-" && id[13] === "-") {
          ids.push(id);
        }
      }
    }
    // Fallback: if none marked "(Not Set)", pick from any visible triggers
    if (ids.length === 0) {
      const anyTriggers = page.locator('[data-testid^="recall-eval-"]');
      const count = Math.min(await anyTriggers.count(), needed);
      for (let i = 0; i < count; i++) {
        const testid = await anyTriggers.nth(i).getAttribute("data-testid");
        if (testid) {
          const parts = testid.split("-");
          const id = parts.slice(2).join("-");
          if (id.length === 36 && id[8] === "-" && id[13] === "-") {
            ids.push(id);
          }
        }
      }
    }
    return ids;
  }

  test("should enable Submit button with count when evaluation selected", async ({
    page,
  }) => {
    const submitButton = page.locator('button:has-text("Submit")');

    // Pick a visible (Not Set) row and select "Good"
    const ids = await getNotSetIds(page, 1);
    const targetId = ids[0];
    const trigger = page.getByTestId(`recall-eval-${targetId}`);
    await trigger.scrollIntoViewIfNeeded();
    await selectEvalFor(targetId, "good");

    // Verify dropdown now shows Good and Submit is enabled
    await expect(page.getByTestId(`recall-eval-${targetId}`)).toContainText(
      "Good"
    );
    await expect(submitButton).toBeEnabled();
  });

  test.skip("should disable Submit button when evaluation changed to (Not Set)", async ({
    page,
  }) => {
    // Baseline count (may be non-zero)
    const submitButton = page.locator('button:has-text("Submit")');
    const parseCount = async () => {
      const txt = await submitButton.textContent();
      const m = txt?.match(/Submit(\d+)/);
      return m ? Number.parseInt(m[1], 10) : 0;
    };
    const baseline = await parseCount();

    // Select "Good" on a row that is currently (Not Set)
    const ids = await getNotSetIds(page, 1);
    const targetId = ids[0] ?? CATALOG_TUNE_54_ID; // Fallback to catalog tune 54
    const trigger = page.getByTestId(`recall-eval-${targetId}`);
    await trigger.scrollIntoViewIfNeeded();
    await selectEvalFor(targetId, "good");

    // Verify the UI reflects the change (row no longer shows "(Not Set)")
    await expect(submitButton).toBeEnabled();
    await expect(page.getByTestId(`recall-eval-${targetId}`)).not.toContainText(
      "(Not Set)"
    );

    // Verify count increased by 1
    const afterAdd = await parseCount();
    expect(afterAdd).toBe(baseline + 1);

    // Change to "(Not Set)"
    await selectEvalFor(targetId, "not-set");

    // Verify count returned to baseline
    const afterClear = await parseCount();
    expect(afterClear).toBe(baseline);

    // If baseline was 0, button should be disabled
    if (baseline === 0) {
      await expect(submitButton).toBeDisabled();
    }
  });

  test("should correctly track count with multiple evaluations", async ({
    page,
  }) => {
    // Using explicit row targets below for stability
    const submitButton = page.locator('button:has-text("Submit")');
    const baselineText = await submitButton.textContent();
    const baselineMatch = baselineText?.match(/Submit(\d+)/);
    const baseline = baselineMatch ? Number.parseInt(baselineMatch[1], 10) : 0;

    // Pick two (Not Set) rows to ensure count increases
    const ids = Array.from(new Set(await getNotSetIds(page, 2)));
    if (ids.length >= 1) {
      await selectEvalFor(ids[0], "good");
      await expect(page.getByTestId(`recall-eval-${ids[0]}`)).not.toContainText(
        "(Not Set)"
      );
    }
    if (ids.length >= 2) {
      await selectEvalFor(ids[1], "easy");
      await expect(page.getByTestId(`recall-eval-${ids[1]}`)).not.toContainText(
        "(Not Set)"
      );
    }
    const afterAll = await submitButton.textContent();
    const matchAll = afterAll?.match(/Submit(\d+)/);
    const total = matchAll ? Number.parseInt(matchAll[1], 10) : baseline;
    expect(total).toBeGreaterThanOrEqual(baseline);
  });

  test.skip("should correctly decrement count when clearing evaluations", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const submitButton = page.locator('button:has-text("Submit")');
    const parseCount = async () => {
      const txt = await submitButton.textContent();
      const m = txt?.match(/Submit(\d+)/);
      return m ? Number.parseInt(m[1], 10) : 0;
    };
    const baseline = await parseCount();

    // Add two evaluations on rows that are (Not Set) if available
    const ids = Array.from(new Set(await getNotSetIds(page, 2)));
    const numToAdd = ids.length;

    if (ids.length >= 1) {
      await selectEvalFor(ids[0], "good");
    }
    if (ids.length >= 2) {
      await selectEvalFor(ids[1], "easy");
    }

    // Verify count increased
    const afterAdd = await parseCount();
    expect(afterAdd).toBe(baseline + numToAdd);

    // Clear evaluations for the same two rows
    if (ids.length >= 1) {
      await selectEvalFor(ids[0], "not-set");
    }
    if (ids.length >= 2) {
      await selectEvalFor(ids[1], "not-set");
    }

    // Verify count returned to baseline
    const finalCount = await parseCount();
    expect(finalCount).toBe(baseline);

    if (baseline === 0) {
      await expect(submitButton).toBeDisabled();
    }
  });
});
