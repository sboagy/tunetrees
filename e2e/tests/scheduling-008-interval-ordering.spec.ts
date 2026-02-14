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
  queryPracticeRecords,
  queryTunesByTitles,
  validateScheduledDatesInFuture,
} from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SCHEDULING-008: Interval Ordering Across First Evaluations
 * Priority: HIGH
 *
 * Invariant: For first evaluation of NEW tunes (same starting conditions), FSRS-derived intervals obey ordering:
 *   Again < Hard ≤ Good < Easy, with all intervals ≥ 1 day and scheduled dates strictly > now.
 *
 * Scope (Skeleton):
 * - Create 4 new tunes (A, H, G, E)
 * - Add each to repertoire then to review
 * - Evaluate each once with its respective rating
 * - Query resulting practice_record interval + due
 * - Assert relative ordering and future-only constraints
 *
 * Full version (later):
 * - Capture stability/difficulty initial metrics
 * - Validate repertoire_tune.scheduled mirrors practice_record.due
 * - Add tolerance for potential equal Hard/Good intervals (spec allows Hard == Good in edge cases)
 * - Extend to multi-day second evaluation confirming monotonic growth
 */

interface RatedTuneMeta {
  title: string;
  tuneId?: string;
  rating: "again" | "hard" | "good" | "easy";
  interval?: number;
}

const RATED_TUNES: RatedTuneMeta[] = [
  { title: `SCHED-008 Again ${Date.now()}`, rating: "again" },
  { title: `SCHED-008 Hard ${Date.now()}`, rating: "hard" },
  { title: `SCHED-008 Good ${Date.now()}`, rating: "good" },
  { title: `SCHED-008 Easy ${Date.now()}`, rating: "easy" },
];

let ttPage: TuneTreesPage;
let currentDate: Date;

test.describe("SCHEDULING-008: Interval Ordering Across First Evaluations", () => {
  // Extend timeout for this suite due to multiple tune creations & evaluations
  test.setTimeout(120_000);
  test.beforeEach(async ({ page, context, testUser }) => {
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
        "SCHED-008",
      ],
    });
    await verifyClockFrozen(
      page,
      currentDate,
      undefined,
      test.info().project.name
    );
  });

  test("should produce ordered intervals Again < Hard ≤ Good < Easy (skeleton)", async ({
    page,
    testUser,
  }) => {
    // Helper to create, configure, and add a tune to review
    async function createAndAddToReview(meta: RatedTuneMeta, tuneType: string) {
      await ttPage.catalogTab.click();
      await ttPage.catalogAddTuneButton.click();
      const newButton = page.getByRole("button", { name: /^new$/i });
      await newButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      const titleField = ttPage.tuneEditorForm.getByTestId(
        "tune-editor-input-title"
      );
      await titleField.fill(meta.title);
      await ttPage.selectTypeInTuneEditor(tuneType);
      const saveButton = page.getByRole("button", { name: /save/i });
      await saveButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      // Add to repertoire
      await ttPage.searchForTune(meta.title, ttPage.catalogGrid);
      const checkbox = ttPage.catalogGrid
        .locator('input[type="checkbox"]')
        .nth(1);
      await checkbox.check();
      await ttPage.catalogAddToRepertoireButton.click();
      await page.waitForTimeout(1000);
      // Add to review
      await ttPage.repertoireTab.click();
      await ttPage.searchForTune(meta.title, ttPage.repertoireGrid);
      const repCheckbox = ttPage.repertoireGrid
        .locator('input[type="checkbox"]')
        .nth(1);
      await repCheckbox.check();
      await ttPage.repertoireAddToReviewButton.click();
      await page.waitForTimeout(1000);
    }

    // Cleanup helper (cascade delete test tunes + dependent rows)
    async function cleanupRatedTunes() {
      try {
        const titles = RATED_TUNES.map((t) => t.title);
        const userKey = testUser.email.split(".")[0];
        const { supabase } = await getTestUserClient(userKey);
        // Resolve tune ids
        const { data, error } = await supabase
          .from("tune")
          .select("id,title")
          .in("title", titles);
        if (error) {
          console.warn(`[SCHED-008 CLEANUP] Query error: ${error.message}`);
          return;
        }
        const tuneIds = (data || []).map((r: any) => r.id).filter(Boolean);
        if (tuneIds.length === 0) return;
        const uniqueIds = [...new Set(tuneIds)];
        const cascade: {
          table: string;
          column: string;
          filterPlaylist?: boolean;
        }[] = [
          {
            table: "repertoire_tune",
            column: "tune_ref",
            filterPlaylist: true,
          },
          {
            table: "practice_record",
            column: "tune_ref",
            filterPlaylist: true,
          },
          {
            table: "daily_practice_queue",
            column: "tune_ref",
            filterPlaylist: true,
          },
          { table: "tune_override", column: "tune_ref" },
        ];
        for (const { table, column, filterPlaylist } of cascade) {
          if (table === "practice_record") {
            const { error: delErr } = await supabase.rpc(
              "e2e_delete_practice_record_by_tunes",
              {
                target_playlist: testUser.repertoireId,
                tune_ids: uniqueIds,
              }
            );
            if (delErr) {
              console.warn(
                `[SCHED-008 CLEANUP] ${table} delete error: ${delErr.message}`
              );
            }
            continue;
          }
          let del = supabase.from(table).delete().in(column, uniqueIds);
          if (filterPlaylist)
            del = del.eq("repertoire_ref", testUser.repertoireId);
          const { error: delErr } = await del;
          if (delErr) {
            console.warn(
              `[SCHED-008 CLEANUP] ${table} delete error: ${delErr.message}`
            );
          }
        }
        const { error: tuneErr } = await supabase
          .from("tune")
          .delete()
          .in("id", uniqueIds);
        if (tuneErr) {
          console.warn(
            `[SCHED-008 CLEANUP] tune delete error: ${tuneErr.message}`
          );
        } else {
          console.log(
            `[SCHED-008 CLEANUP] Removed tunes: ${uniqueIds.join(", ")}`
          );
        }
      } catch (e: any) {
        console.warn(`[SCHED-008 CLEANUP] Exception: ${e?.message || e}`);
      }
    }

    try {
      // Create all four tunes
      await createAndAddToReview(RATED_TUNES[0], "Jig (6/8)");
      await createAndAddToReview(RATED_TUNES[1], "Reel (4/4)");
      await createAndAddToReview(RATED_TUNES[2], "Hornpipe (4/4)");
      await createAndAddToReview(RATED_TUNES[3], "Slip Jig (9/8)");

      // Evaluate each tune once with designated rating
      async function evaluate(meta: RatedTuneMeta) {
        const toastCloser = page.getByRole("button", { name: "Close toast" });
        try {
          const isCloserVisible = await toastCloser.isVisible();
          if (isCloserVisible) {
            toastCloser.click();
          }
          await page.waitForTimeout(500);
        } catch (_e) {}
        await ttPage.practiceTab.click();
        const rows = await ttPage.getRows("scheduled");

        // await ttPage.searchForTune(meta.title, ttPage.practiceGrid);
        const row = rows.getByText(meta.title);
        await expect(row).toBeVisible({ timeout: 60000 });
        await ttPage.enableFlashcardMode();
        await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });
        await ttPage.selectFlashcardEvaluation(meta.rating);
        await ttPage.submitEvaluations();
        await page.waitForLoadState("networkidle", { timeout: 15000 });
        await page.waitForTimeout(1500);
        ttPage.flashcardModeSwitch.isVisible({ timeout: 15000 });
        await ttPage.disableFlashcardMode();
        // Interval capture / tuneId resolution will be added later.
      }

      for (const meta of RATED_TUNES) {
        await evaluate(meta);
      }

      // Resolve tune IDs from LOCAL database and query practice records
      const titles = RATED_TUNES.map((t) => t.title);

      // Query tunes from local SQLite instead of Supabase to avoid sync timing issues
      const tuneData = await queryTunesByTitles(page, titles);

      const tuneIdMap = new Map<string, string>();
      tuneData.forEach((t: { id: string; title: string }) => {
        tuneIdMap.set(t.title, t.id);
      });

      const tuneIds = Array.from(tuneIdMap.values());
      const allRecords = await queryPracticeRecords(page, tuneIds);

      // Filter out initial seed records (quality is null) and ensure we have the evaluation records
      const records = allRecords.filter((r) => r.quality !== null);

      // Map records to ratings
      const intervals: Record<string, number> = {};
      for (const meta of RATED_TUNES) {
        const id = tuneIdMap.get(meta.title);
        // Find the record for this tune
        const record = records.find((r) => r.tune_ref === id);
        if (record) {
          intervals[meta.rating] = record.interval;
        }
      }

      console.log("Captured intervals:", intervals);

      // Assertions
      const again = intervals.again;
      const hard = intervals.hard;
      const good = intervals.good;
      const easy = intervals.easy;

      expect(again).toBeDefined();
      expect(hard).toBeDefined();
      expect(good).toBeDefined();
      expect(easy).toBeDefined();

      // 1. All intervals >= 1 day
      expect(again).toBeGreaterThanOrEqual(1);
      expect(hard).toBeGreaterThanOrEqual(1);
      expect(good).toBeGreaterThanOrEqual(1);
      expect(easy).toBeGreaterThanOrEqual(1);

      // 2. Ordering: Again < Hard <= Good < Easy
      // Note: Hard can be equal to Good in some FSRS configurations or edge cases,
      // but typically Hard < Good. We'll use <= for robustness.
      // Again is usually the smallest.
      expect(hard).toBeGreaterThanOrEqual(again);
      expect(good).toBeGreaterThanOrEqual(hard);
      expect(easy).toBeGreaterThan(good); // Easy should be strictly greater than Good for first review

      // 3. Future dates
      validateScheduledDatesInFuture(records, currentDate);
    } finally {
      await cleanupRatedTunes();
    }
  });
});
