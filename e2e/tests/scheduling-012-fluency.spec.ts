import { expect } from "@playwright/test";
import { DEFAULT_PLUGIN_SCRIPT } from "../../src/lib/plugins/scheduling-template";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import {
  seedSchedulingPluginLocally,
  setupForPracticeTestsParallel,
} from "../helpers/practice-scenarios";
import {
  runTestHook,
  submitAndWaitForPracticeSettled,
} from "../helpers/practice-view";
import { queryLatestPracticeRecord } from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/** SCHEDULING-012 (HIGH): Fluency evaluates, stages, submits and persists.
 * The production template must actually query local history; merely falling
 * back without a toast cannot satisfy the asserted two/four-day intervals.
 */
test.describe("Fluency scheduling", () => {
  test.setTimeout(120000);
  let tt: TuneTreesPage;
  test.beforeEach(async ({ page, context, testUser }) => {
    await setStableDate(context, new Date(STANDARD_TEST_DATE));
    tt = new TuneTreesPage(page);
    await tt.setSchedulingPrefs();
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleDaysAgo: 1,
      scheduleBaseDate: STANDARD_TEST_DATE,
      startTab: "practice",
    });
    const row = tt.getRows("scheduled").first();
    await row.getByRole("button", { name: /recall/i }).click();
    await page.getByRole("menuitem", { name: "fluency", exact: true }).click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(row.getByRole("button", { name: /fluency/i })).toBeVisible({
      timeout: 10000,
    });
  });
  test("submits a first Fluency review and preserves it on reload", async ({
    page,
    testUser,
  }) => {
    await seedSchedulingPluginLocally(page, {
      script: DEFAULT_PLUGIN_SCRIPT,
      goals: ["fluency"],
      userId: testUser.userId,
    });
    await tt.setRowEvaluation(tt.getRows("scheduled").first(), "good");
    await expect(tt.submitEvaluationsButton).toBeEnabled({ timeout: 10000 });
    const preview = await page.evaluate(
      async (rep) => window.__ttTestApi?.getPracticeListStaged(rep),
      testUser.repertoireId
    );
    expect(
      preview?.find((row) => row.id === TEST_TUNE_BANISH_ID)
    ).toMatchObject({ latest_interval: 2, has_staged: 1 });
    await submitAndWaitForPracticeSettled(page, tt);
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    const record = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000 }
    );
    expect(record?.interval).toBe(2);
    expect(record?.due).toBe(
      preview?.find((row) => row.id === TEST_TUNE_BANISH_ID)?.latest_due
    );
    const stagedAfter = await page.evaluate(
      async (rep) => window.__ttTestApi?.getPracticeListStaged(rep),
      testUser.repertoireId
    );
    expect(
      stagedAfter?.find((row) => row.id === TEST_TUNE_BANISH_ID)?.has_staged ??
        0
    ).toBe(0);
    await page.reload();
    const reloaded = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000 }
    );
    expect(reloaded?.id).toBe(record?.id);
    expect(
      await page.evaluate(
        async ({ rep, tune }) =>
          window.__ttTestApi?.getDistinctPracticeRecordCount(rep, tune),
        { rep: testUser.repertoireId, tune: TEST_TUNE_BANISH_ID }
      )
    ).toBe(1);
    await expect(
      page.getByText("Scheduling plugin failed", { exact: true })
    ).toHaveCount(0);
  });
  test("uses review history offline and syncs the submitted result after reconnect", async ({
    page,
    context,
    testUser,
  }) => {
    await seedSchedulingPluginLocally(page, {
      script: DEFAULT_PLUGIN_SCRIPT,
      goals: ["fluency"],
      userId: testUser.userId,
    });
    await page.evaluate(
      async (input) => window.__ttTestApi?.seedPracticeHistory(input),
      {
        repertoireId: testUser.repertoireId,
        tuneId: TEST_TUNE_BANISH_ID,
        qualities: [3, 3],
        practicedBefore: new Date(STANDARD_TEST_DATE).toISOString(),
      }
    );
    // Warm the real worker/WASM before disabling the network; the review itself
    // must still obtain its history from SQLite rather than a remote service.
    await page.evaluate(async () =>
      window.__ttTestApi?.runPlugin({
        script: "function parseImport(){return true;}",
        functionName: "parseImport",
        payload: {},
      })
    );
    await context.setOffline(true);
    await tt.setRowEvaluation(tt.getRows("scheduled").first(), "good");
    await expect(tt.submitEvaluationsButton).toBeEnabled({ timeout: 10000 });
    await submitAndWaitForPracticeSettled(page, tt);
    const record = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000 }
    );
    expect(record?.interval).toBe(4);
    await expect(
      page.getByText("Scheduling plugin failed", { exact: true })
    ).toHaveCount(0);
    await context.setOffline(false);
    await runTestHook(page, "__forceSyncUpForTest");
    // Poll the specific submitted record, not the whole outbox, which may also
    // contain unrelated preference or queue updates from the test fixture.
    await expect
      .poll(
        () =>
          page.evaluate(
            async (id) =>
              window.__ttTestApi?.getSupabaseRecord("practice_record", id),
            record?.id ?? "missing"
          ),
        { timeout: 30000 }
      )
      .toMatchObject({ interval: 4 });
  });
  test("reports the historical script error and still allows fallback submission", async ({
    page,
    testUser,
  }) => {
    const historical = DEFAULT_PLUGIN_SCRIPT.replaceAll(
      "repertoire_ref",
      "playlist_ref"
    ).replaceAll("repertoireRef", "playlistRef");
    await seedSchedulingPluginLocally(page, {
      script: historical,
      goals: ["fluency"],
      userId: testUser.userId,
    });
    await tt.setRowEvaluation(tt.getRows("scheduled").first(), "good");
    await expect(
      page.getByText("Scheduling plugin failed", { exact: true })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/This plugin uses the old playlist API/)
    ).toBeVisible({ timeout: 10000 });
    await expect(tt.submitEvaluationsButton).toBeEnabled({ timeout: 10000 });
    await submitAndWaitForPracticeSettled(page, tt);
    const record = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000 }
    );
    // Good advances a first review from step zero to the ladder's second
    // entry: [1, 3, 7, 14, 21]. This differs from the plugin's two-day result.
    expect(record?.interval).toBe(3);
  });
  test("unblocks Submit after a scheduling timeout", async ({
    page,
    testUser,
  }) => {
    await seedSchedulingPluginLocally(page, {
      script: `function createScheduler() {
        const hang = () => new Promise(() => {});
        return {processFirstReview: hang, processReview: hang};
      }`,
      goals: ["fluency"],
      userId: testUser.userId,
    });
    await tt.setRowEvaluation(tt.getRows("scheduled").first(), "good");
    await expect(tt.submitEvaluationsButton).toBeDisabled({ timeout: 10000 });
    // Exercise the production 30-second deadline all the way through staging.
    // Short injected deadlines are covered separately by the transport tests.
    await expect(page.getByText(/Plugin execution timed out/)).toBeVisible({
      timeout: 40000,
    });
    await expect(tt.submitEvaluationsButton).toBeEnabled({ timeout: 10000 });
    await submitAndWaitForPracticeSettled(page, tt);
    const record = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000 }
    );
    expect(record?.interval).toBe(3);
  });
});
