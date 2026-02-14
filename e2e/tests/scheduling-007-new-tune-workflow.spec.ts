import { expect } from "@playwright/test";
import {
  STANDARD_TEST_DATE,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import {
  getTestUserClient,
  setupDeterministicTestParallel,
} from "../helpers/practice-scenarios";
import {
  queryLatestPracticeRecord,
  queryScheduledDates,
} from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SCHEDULING-007: New Tune Workflow & FSRS NEW State
 * Priority: HIGH
 *
 * Tests complete workflow for creating new tunes and validates FSRS "New" card handling.
 *
 * Workflow:
 * 1. Create tune in Catalog ("Add Tune" → "New" → Fill form → Save)
 * 2. Add to Repertoire (Select tune → "Add to Repertoire")
 * 3. Add to Review (Repertoire tab → "Add to Review")
 * 4. First Evaluation validates FSRS NEW state transitions:
 *    - Again/Hard/Good → Learning (state=1)
 *    - Easy → Review (state=2, skips Learning per ts-fsrs workflow)
 *
 * Validates:
 * - New tunes start in FSRS state = 0 (New)
 * - First evaluation transitions correctly per rating
 * - "Easy" skips Learning state (goes directly to Review)
 * - All scheduled dates respect minimum next-day constraint
 * - FSRS metrics initialize correctly (stability, difficulty, reps=0, lapses=0)
 */

test.describe("SCHEDULING-007: New Tune Workflow & FSRS NEW State", () => {
  let ttPage: TuneTreesPage;
  let currentDate: Date;
  let newTuneTitle: string;
  let newTuneId: string | undefined;

  test.beforeEach(async ({ page, context, testUser }, testInfo) => {
    // Extend timeout for all tests running this hook by 3x.
    test.setTimeout(testInfo.timeout * 3);

    ttPage = new TuneTreesPage(page);

    // Set stable starting date
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Start with clean repertoire
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
      purgeTitlePrefixes: [
        "Test Tune SCHED-007",
        "Easy Skip Learning",
        "Again Learning",
      ],
    });

    // Verify clock is frozen
    await verifyClockFrozen(
      page,
      currentDate,
      undefined,
      test.info().project.name
    );

    // Initialize new tune title with timestamp for uniqueness
    newTuneTitle = `Test Tune SCHED-007 ${currentDate}`;
  });

  test("should create new tune, add to practice queue, and validate NEW→Learning transition", async ({
    page,
    testUser,
  }) => {
    const createdTitle = newTuneTitle;
    async function cleanupTunes(titles: string[]) {
      try {
        const userKey = testUser.email.split(".")[0];
        const { supabase } = await getTestUserClient(userKey);
        // Resolve tune ids by exact title match
        const tuneIds: string[] = [];
        for (const title of titles) {
          const { data, error } = await supabase
            .from("tune")
            .select("id,title")
            .eq("title", title);
          if (error) {
            console.warn(
              `[CLEANUP] Failed to query tune '${title}': ${error.message}`
            );
            continue;
          }
          (data || []).forEach((row: any) => {
            if (row?.id) tuneIds.push(row.id);
          });
        }
        if (tuneIds.length === 0) return; // Nothing to clean
        const uniqueIds = [...new Set(tuneIds)];
        // Delete dependent rows first (playlist_tune, practice_record, daily_practice_queue, tune_override)
        const cascade: {
          table: string;
          column: string;
          filterPlaylist?: boolean;
        }[] = [
          { table: "playlist_tune", column: "tune_ref" },
          {
            table: "practice_record",
            column: "tune_ref",
            filterPlaylist: true,
          },
          { table: "daily_practice_queue", column: "tune_ref" },
          { table: "tune_override", column: "tune_ref" },
        ];
        for (const { table, column, filterPlaylist } of cascade) {
          if (table === "practice_record") {
            const { error } = await supabase.rpc(
              "e2e_delete_practice_record_by_tunes",
              {
                target_playlist: testUser.repertoireId,
                tune_ids: uniqueIds,
              }
            );
            if (error) {
              console.warn(
                `[CLEANUP] Error deleting from ${table}: ${error.message}`
              );
            }
            continue;
          }

          let del = supabase.from(table).delete().in(column, uniqueIds);
          if (filterPlaylist)
            del = del.eq("playlist_ref", testUser.repertoireId);
          const { error } = await del;
          if (error) {
            console.warn(
              `[CLEANUP] Error deleting from ${table}: ${error.message}`
            );
          }
        }
        const { error: tuneDeleteError } = await supabase
          .from("tune")
          .delete()
          .in("id", uniqueIds);
        if (tuneDeleteError) {
          console.warn(
            `[CLEANUP] Error deleting tunes: ${tuneDeleteError.message}`
          );
        } else {
          console.log(`[CLEANUP] Removed test tunes: ${uniqueIds.join(", ")}`);
        }
      } catch (err: any) {
        console.warn(
          `[CLEANUP] Exception during tune cleanup: ${err?.message || err}`
        );
      }
    }
    try {
      // ===== STEP 1: Create New Tune in Catalog =====
      console.log("\n=== Step 1: Create New Tune in Catalog ===");

      await ttPage.catalogTab.click();
      await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 });

      // Open "Add Tune" dialog
      await ttPage.catalogAddTuneButton.click();
      await expect(ttPage.addTuneDialog).toBeVisible({ timeout: 5000 });

      // Click "New" to create empty tune
      const newButton = page.getByRole("button", { name: /^new$/i });
      await newButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });

      // Should navigate to tune editor
      await expect(ttPage.tuneEditorForm).toBeVisible({ timeout: 10000 });

      // Fill in title (required)
      const titleField = ttPage.tuneEditorForm
        .locator('input[name="title"]')
        .or(ttPage.tuneEditorForm.locator('input[type="text"]').first());
      await titleField.fill(newTuneTitle);

      // Type is required — select "Jig (6/8)"
      await ttPage.selectTypeInTuneEditor("Jig (6/8)");

      // Save
      const saveButton = page.getByRole("button", { name: /save/i });
      await saveButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });

      // Verify tune appears in catalog
      await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
      await ttPage.searchForTune(newTuneTitle, ttPage.catalogGrid);
      await page.waitForTimeout(500);

      const tuneRow = ttPage.catalogGrid.getByText(newTuneTitle);
      await expect(tuneRow).toBeVisible({ timeout: 5000 });

      console.log(`  ✓ Created tune: ${newTuneTitle}`);

      // ===== STEP 2: Add to Repertoire =====
      console.log("\n=== Step 2: Add to Repertoire ===");

      // Select the new tune (checkbox in first column)
      const firstCheckbox = ttPage.catalogGrid
        .locator('input[type="checkbox"]')
        .nth(1);
      await firstCheckbox.check();
      await page.waitForTimeout(500);

      // Verify selection count
      await expect(page.getByText(/1 tune selected/i)).toBeVisible({
        timeout: 3000,
      });

      // Click "Add to Repertoire"
      await ttPage.catalogAddToRepertoireButton.click();
      await page.waitForTimeout(2000); // Wait for sync

      console.log("  ✓ Added to repertoire");

      // ===== STEP 3: Add to Review (Practice Queue) =====
      console.log("\n=== Step 3: Add to Review ===");

      // Navigate to Repertoire tab
      await ttPage.repertoireTab.click();
      await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      // Search for the new tune
      await ttPage.searchForTune(newTuneTitle, ttPage.repertoireGrid);
      await page.waitForTimeout(500);

      // Select the tune
      const repertoireCheckbox = ttPage.repertoireGrid
        .locator('input[type="checkbox"]')
        .nth(1);
      await repertoireCheckbox.check();
      await page.waitForTimeout(500);

      // Click "Add To Review"
      await ttPage.repertoireAddToReviewButton.click();
      await page.waitForTimeout(2000); // Wait for sync

      console.log("  ✓ Added to review (practice queue)");

      // ===== STEP 4: Verify Tune Appears in Practice Queue =====
      console.log("\n=== Step 4: Verify in Practice Queue ===");

      // Navigate to Practice tab
      await ttPage.practiceTab.click();
      await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      // The tune should be in the queue (Bucket Q3: New/Unscheduled)
      // It has no practice history yet
      const practiceRow = ttPage.practiceGrid.getByText(newTuneTitle);
      await expect(practiceRow).toBeVisible({ timeout: 10000 });

      console.log("  ✓ Tune visible in practice queue (Bucket Q3: New)");

      // ===== STEP 5: First Evaluation - GOOD (NEW → Learning) =====
      console.log("\n=== Step 5: First Evaluation (GOOD - NEW → Learning) ===");

      // Enable flashcard mode
      await ttPage.enableFlashcardMode();
      await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });

      // Select "Good" evaluation (should transition to Learning state=1)
      await page.waitForTimeout(600);
      await ttPage.selectFlashcardEvaluation("good");
      await page.waitForTimeout(700);

      // Submit
      await ttPage.submitEvaluations();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      await page.waitForTimeout(2000);

      // Query practice record
      const repertoireId = testUser.repertoireId;

      // Get tune ID from scheduled_dates (need to query by title pattern)
      const scheduledDates = await queryScheduledDates(page, repertoireId);
      const dateEntries = [...scheduledDates.entries()];
      const tuneEntry = dateEntries[0]; // Only one tune expected in this isolated test

      if (!tuneEntry) {
        throw new Error(
          `Could not find scheduled date for new tune ${newTuneTitle}`
        );
      }

      newTuneId = tuneEntry[0];
      const record = await queryLatestPracticeRecord(
        page,
        newTuneId,
        repertoireId
      );
      if (!record)
        throw new Error("Practice record not found after first evaluation");

      console.log(`  Interval: ${record.interval} days`);
      console.log(`  Scheduled: ${record.due}`);
      console.log(`  Stability: ${record.stability}`);
      console.log(`  Difficulty: ${record.difficulty}`);
      console.log(`  State: ${record.state}`);
      console.log(`  Repetitions: ${record.repetitions}`);
      console.log(`  Lapses: ${record.lapses}`);

      // === CRITICAL VALIDATIONS FOR NEW TUNE FIRST EVALUATION ===

      // 1. State should be Learning (state=1) after "Good" from NEW
      // First "Good" evaluation transitions NEW (0) → Learning (1)
      expect(record.state).toBe(1);

      // 2. Repetitions should be 1 (first practice)
      // First evaluation sets repetitions=1
      expect(record.repetitions).toBe(1);

      // 3. Lapses should be 0 (no mistakes yet)
      // New tune has lapses=0
      expect(record.lapses).toBe(0);

      // 4. Interval >= 1 day (minimum constraint)
      // Interval must be >= 1 day
      expect(record.interval).toBeGreaterThanOrEqual(1);

      // 5. Scheduled date in future
      const scheduledDate = new Date(record.due);
      const daysDiff = Math.floor(
        (scheduledDate.getTime() - currentDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      // Scheduled date must be >= 1 day in future
      expect(daysDiff).toBeGreaterThanOrEqual(1);

      // 6. Stability and difficulty initialized
      // FSRS metrics initialized > 0
      expect(record.stability).toBeGreaterThan(0);
      expect(record.difficulty).toBeGreaterThan(0);

      console.log("\n✓ All NEW → Learning transition validations passed!");
    } finally {
      await cleanupTunes([createdTitle]);
    }
  });

  test("should validate NEW→Review transition with Easy (skip Learning)", async ({
    page,
    testUser,
  }) => {
    // This test validates that "Easy" from NEW skips Learning and goes directly to Review (state=2)

    console.log("\n=== NEW → Review (Easy) Test ===");

    // Create tune (same steps as above, condensed)
    await ttPage.catalogTab.click();
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    await ttPage.catalogAddTuneButton.click();
    await expect(ttPage.addTuneDialog).toBeVisible({ timeout: 5000 });

    const newButton = page.getByRole("button", { name: /^new$/i });
    await newButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const titleField = ttPage.page.getByTestId("tune-editor-input-title");
    const easyTestTitle = `Easy Skip Learning ${currentDate}`;
    await titleField.fill(easyTestTitle);
    await ttPage.selectTypeInTuneEditor("Reel (4/4)");

    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Add to repertoire
    await ttPage.searchForTune(easyTestTitle, ttPage.catalogGrid);
    const checkbox = ttPage.catalogGrid
      .locator('input[type="checkbox"]')
      .nth(1);
    await checkbox.check();
    await ttPage.catalogAddToRepertoireButton.click();
    await page.waitForTimeout(2000);

    // Add to review
    await ttPage.repertoireTab.click();
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });
    await ttPage.searchForTune(easyTestTitle, ttPage.repertoireGrid);
    const repCheckbox = ttPage.repertoireGrid
      .locator('input[type="checkbox"]')
      .nth(1);
    await repCheckbox.check();
    await ttPage.repertoireAddToReviewButton.click();
    await page.waitForTimeout(2000);

    // Practice with "Easy"
    await ttPage.practiceTab.click();
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });
    await ttPage.enableFlashcardMode();
    await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });

    // Select "Easy" (should skip Learning → Review directly)
    await ttPage.selectFlashcardEvaluation("easy");
    await page.waitForTimeout(500);

    await ttPage.submitEvaluations();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Query practice record
    const repertoireId = testUser.repertoireId;
    const scheduledDates = await queryScheduledDates(page, repertoireId);
    const tuneEntry = [...scheduledDates.entries()][0]; // First/only tune expected

    if (!tuneEntry) {
      throw new Error("Could not find scheduled date for Easy test tune");
    }

    const tuneId = tuneEntry[0];
    const record = await queryLatestPracticeRecord(page, tuneId, repertoireId);
    if (!record)
      throw new Error("Practice record not found after Easy evaluation");

    console.log(`  State: ${record.state}`);
    console.log(`  Interval: ${record.interval} days`);
    console.log(
      `  Repetitions: ${record.repetitions}, Lapses: ${record.lapses}`
    );

    // === CRITICAL VALIDATION: Easy skips Learning ===
    // First "Easy" evaluation transitions NEW (0) → Review (2) skipping Learning
    expect(record.state).toBe(2);

    expect(record.repetitions).toBe(1);
    expect(record.lapses).toBe(0);

    // Interval should be longer than "Good" (Easy gets longer first interval)
    // Easy should produce interval > 1 day
    expect(record.interval).toBeGreaterThan(1);

    try {
      console.log('✓ "Easy" correctly skipped Learning state (NEW → Review)');
    } finally {
      // Cleanup this tune
      const userKey = testUser.email.split(".")[0];
      const { supabase } = await getTestUserClient(userKey);
      try {
        const { data } = await supabase
          .from("tune")
          .select("id")
          .eq("title", easyTestTitle);
        const ids = (data || []).map((r: any) => r.id).filter(Boolean);
        if (ids.length) {
          // Dependent deletes
          await supabase.from("playlist_tune").delete().in("tune_ref", ids);
          await supabase.rpc("e2e_delete_practice_record_by_tunes", {
            target_playlist: testUser.repertoireId,
            tune_ids: ids,
          });
          await supabase
            .from("daily_practice_queue")
            .delete()
            .in("tune_ref", ids);
          await supabase.from("tune_override").delete().in("tune_ref", ids);
          await supabase.from("tune").delete().in("id", ids);
          console.log(`[CLEANUP] Removed Easy test tune(s): ${ids.join(", ")}`);
        }
      } catch (err: any) {
        console.warn(
          `[CLEANUP] Failed to remove Easy test tune: ${err?.message || err}`
        );
      }
    }
  });

  test("should validate Again rating creates short interval in Learning state", async ({
    page,
    testUser,
  }) => {
    // Test that "Again" from NEW goes to Learning with very short interval

    console.log("\n=== NEW → Learning (Again) Test ===");

    // Create tune (condensed)
    await ttPage.catalogTab.click();
    await ttPage.catalogAddTuneButton.click();
    const newButton = page.getByRole("button", { name: /^new$/i });
    await newButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const titleField = ttPage.page.getByTestId("tune-editor-input-title");

    const againTestTitle = `Again Learning ${currentDate}`;
    await titleField.fill(againTestTitle);
    await ttPage.selectTypeInTuneEditor("Jig (6/8)");

    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Add to repertoire → review (condensed)
    await ttPage.searchForTune(againTestTitle, ttPage.catalogGrid);
    await ttPage.catalogGrid.locator('input[type="checkbox"]').nth(1).check();
    await ttPage.catalogAddToRepertoireButton.click();
    await page.waitForTimeout(2000);

    await ttPage.repertoireTab.click();
    await ttPage.searchForTune(againTestTitle, ttPage.repertoireGrid);
    await ttPage.repertoireGrid
      .locator('input[type="checkbox"]')
      .nth(1)
      .check();
    await ttPage.repertoireAddToReviewButton.click();
    await page.waitForTimeout(2000);

    // Practice with "Again"
    await ttPage.practiceTab.click();
    await ttPage.enableFlashcardMode();
    await ttPage.selectFlashcardEvaluation("again");
    await page.waitForTimeout(500);

    await ttPage.submitEvaluations();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Query
    const repertoireId = testUser.repertoireId;
    const scheduledDates = await queryScheduledDates(page, repertoireId);
    // Map returned; use Map APIs instead of Object.keys
    const tuneId = [...scheduledDates.keys()][0];
    const record = await queryLatestPracticeRecord(page, tuneId, repertoireId);
    if (!record)
      throw new Error("Practice record not found after Again evaluation");

    console.log(`  State: ${record.state}`);
    console.log(`  Interval: ${record.interval} days`);
    console.log(`  Lapses: ${record.lapses}`);

    // Validation
    expect(record.state).toBe(1); // "Again" transitions to Learning (1)
    expect(record.repetitions).toBe(1); // First evaluation sets repetitions=1

    // Lapses rule: first failure from NEW (now Learning) does NOT increment lapses.
    // Lapses only increment on an Again when prior state was Review (state=2).
    expect(record.lapses).toBe(0); // Remains 0 in Learning

    // Interval should be minimum (1 day) since "Again" is hardest
    expect(record.interval).toBe(1); // Minimum interval (1 day)

    try {
      console.log(
        '✓ "Again" correctly set Learning state with minimum interval'
      );
    } finally {
      // Cleanup Again test tune
      const userKey = testUser.email.split(".")[0];
      const { supabase } = await getTestUserClient(userKey);
      try {
        const { data } = await supabase
          .from("tune")
          .select("id")
          .eq("title", againTestTitle);
        const ids = (data || []).map((r: any) => r.id).filter(Boolean);
        if (ids.length) {
          await supabase.from("playlist_tune").delete().in("tune_ref", ids);
          await supabase.rpc("e2e_delete_practice_record_by_tunes", {
            target_playlist: testUser.repertoireId,
            tune_ids: ids,
          });
          await supabase
            .from("daily_practice_queue")
            .delete()
            .in("tune_ref", ids);
          await supabase.from("tune_override").delete().in("tune_ref", ids);
          await supabase.from("tune").delete().in("id", ids);
          console.log(
            `[CLEANUP] Removed Again test tune(s): ${ids.join(", ")}`
          );
        }
      } catch (err: any) {
        console.warn(
          `[CLEANUP] Failed to remove Again test tune: ${err?.message || err}`
        );
      }
    }
  });
});
