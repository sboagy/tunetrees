import { expect, type Page } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import {
  advanceHours,
  STANDARD_TEST_DATE,
  setStableDate,
} from "../helpers/clock-control";
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

const fluencyId = "00000000-0000-0000-0000-000000000003";
const declaration = `function describeGoalSchedulerV1() {
  return { apiVersion: 1, stateVersion: 1, compatibleStateVersions: [1],
    actions: [{ id: "smooth", label: "Smooth", description: "Review in six hours" }] };
}`;
async function selectEvaluation(page: Page, value: string) {
  const trigger = page.getByTestId(`recall-eval-${TEST_TUNE_BANISH_ID}`);
  await expect(trigger).toBeEnabled({ timeout: 10000 });
  await trigger.click({ timeout: 10000 });
  await page.getByTestId(`recall-eval-option-${value}`).click();
  await page.waitForLoadState("networkidle", { timeout: 15000 });
}

/** Goal-specific choices and new-event submission, including explicit plugins.
 * Legacy automatic plugin matching and silent fallback are intentionally gone. */
test.describe("Fluency scheduling", () => {
  test.setTimeout(120000);
  let tt: TuneTreesPage;
  test.beforeEach(async ({ page, context, testUser }) => {
    await setStableDate(context, new Date(STANDARD_TEST_DATE));
    tt = new TuneTreesPage(page);
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleDaysAgo: 1,
      scheduleBaseDate: STANDARD_TEST_DATE,
      startTab: "practice",
    });
    const row = tt.getRows("scheduled").first();
    await tt.selectRowFluency(row);
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(tt.getRowFluencyButton(row)).toBeVisible({ timeout: 10000 });
  });

  test("submits a goal-specific ladder evaluation and preserves it on reload", async ({
    page,
    testUser,
  }) => {
    await selectEvaluation(page, "effortless");
    await expect(tt.submitEvaluationsButton).toBeEnabled({ timeout: 10000 });
    await submitAndWaitForPracticeSettled(page, tt);
    const record = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000 }
    );
    expect(record).toMatchObject({
      goal_id: fluencyId,
      evaluation_id: "effortless",
      scheduler_id: "builtin:interval-ladder",
      interval_days: 3,
    });
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
  });

  test("Practice again appends an event and cancellation preserves the prior completion", async ({
    page,
    context,
    testUser,
  }) => {
    await selectEvaluation(page, "effortless");
    await submitAndWaitForPracticeSettled(page, tt);
    const first = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000 }
    );
    await tt.setShowSubmitted(true);
    const completed = page.getByTestId(`practice-again-${TEST_TUNE_BANISH_ID}`);
    await expect(completed).toContainText("Effortless", { timeout: 10000 });
    await completed.click();
    await page.getByTestId("practice-again-action").click();
    await selectEvaluation(page, "not-set");
    await expect(completed).toContainText("Effortless", { timeout: 10000 });
    expect(
      (
        await queryLatestPracticeRecord(
          page,
          TEST_TUNE_BANISH_ID,
          testUser.repertoireId
        )
      )?.id
    ).toBe(first?.id);
    await advanceHours(context, 6, new Date(STANDARD_TEST_DATE));
    await completed.click();
    await page.getByTestId("practice-again-action").click();
    await selectEvaluation(page, "fluent");
    await submitAndWaitForPracticeSettled(page, tt);
    const second = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000 }
    );
    expect(second?.id).not.toBe(first?.id);
    expect(second).toMatchObject({ evaluation_id: "fluent", interval_days: 3 });
    expect(
      await page.evaluate(
        async ({ rep, tune }) =>
          window.__ttTestApi?.getDistinctPracticeRecordCount(rep, tune),
        { rep: testUser.repertoireId, tune: TEST_TUNE_BANISH_ID }
      )
    ).toBe(2);
  });

  test("runs the explicitly selected plugin offline and syncs after reconnect", async ({
    page,
    context,
    testUser,
  }) => {
    const plugin = await seedSchedulingPluginLocally(page, {
      userId: testUser.userId,
      goalId: fluencyId,
      script:
        declaration +
        `function scheduleGoalV1(input) { return { due: new Date(Date.parse(input.practiced) + 21600000).toISOString(), state: { count: 1 } }; }`,
    });
    await page.reload();
    await expect(
      page.getByTestId(`recall-eval-${TEST_TUNE_BANISH_ID}`)
    ).toBeEnabled({ timeout: 10000 });
    // Warm the worker after reload; the actual scheduling and submission then run offline.
    await page.evaluate(async () =>
      window.__ttTestApi?.runPlugin({
        script: "function parseImport(){return true;}",
        functionName: "parseImport",
        payload: {},
      })
    );
    await context.setOffline(true);
    await selectEvaluation(page, "smooth");
    await submitAndWaitForPracticeSettled(page, tt);
    const record = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000 }
    );
    expect(record).toMatchObject({
      scheduler_id: `plugin:${plugin.id}`,
      evaluation_id: "smooth",
      interval_days: 0.25,
    });
    await context.setOffline(false);
    await runTestHook(page, "__forceSyncUpForTest");
    // Await the exact event's server acknowledgment, not unrelated outbox entries.
    await expect
      .poll(
        () =>
          page.evaluate(
            async (id) =>
              window.__ttTestApi?.getSupabaseRecord(
                "practice_record",
                id,
                true
              ),
            record?.id ?? "missing"
          ),
        { timeout: 30000 }
      )
      .toMatchObject({ interval_days: 0.25 });
  });

  test("keeps a failed explicit plugin evaluation unsubmitted without fallback", async ({
    page,
    testUser,
  }) => {
    await seedSchedulingPluginLocally(page, {
      userId: testUser.userId,
      goalId: fluencyId,
      script:
        declaration +
        `function scheduleGoalV1(){ throw new Error("Scheduler needs repair"); }`,
    });
    await page.reload();
    await selectEvaluation(page, "smooth");
    await expect(
      page.getByRole("alert").filter({ hasText: "Scheduler needs repair" })
    ).toBeVisible({ timeout: 10000 });
    await expect(tt.submitEvaluationsButton).toBeDisabled({ timeout: 10000 });
    expect(
      await queryLatestPracticeRecord(
        page,
        TEST_TUNE_BANISH_ID,
        testUser.repertoireId
      )
    ).toBeNull();
  });

  test("a scheduling timeout retains an actionable error without submitting fallback", async ({
    page,
    testUser,
  }) => {
    await seedSchedulingPluginLocally(page, {
      userId: testUser.userId,
      goalId: fluencyId,
      script:
        declaration +
        `function scheduleGoalV1(){return new Promise(() => {});}`,
    });
    await page.reload();
    await selectEvaluation(page, "smooth");
    await expect(
      page.getByRole("alert").filter({ hasText: /timed out/i })
    ).toBeVisible({ timeout: 40000 });
    await expect(
      page.getByRole("button", { name: "Retry", exact: true })
    ).toBeEnabled({ timeout: 10000 });
    await expect(tt.submitEvaluationsButton).toBeDisabled({ timeout: 10000 });
    expect(
      await queryLatestPracticeRecord(
        page,
        TEST_TUNE_BANISH_ID,
        testUser.repertoireId
      )
    ).toBeNull();
  });
});
