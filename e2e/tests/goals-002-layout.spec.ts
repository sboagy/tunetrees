import { expect } from "@playwright/test";
import { CATALOG_TUNE_KESH_ID } from "../../src/lib/db/catalog-tune-ids";
import {
  setupDeterministicTestParallel,
  setupForPracticeTestsParallel,
} from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/** GOALS-002: Responsive Goals and manual-entry forms (design-system Q2).
 * Screenshots supplement geometry/interaction checks; they are not pixel baselines.
 */
const layouts = [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 768, height: 800 },
  { width: 1280, height: 800 },
  { width: 667, height: 320 },
];
for (const theme of ["light", "dark"] as const) {
  for (const viewport of layouts) {
    test(`${theme} ${viewport.width}x${viewport.height}: forms stay usable`, async ({
      page,
      testUser,
    }, testInfo) => {
      test.setTimeout(90000);
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript(
        (mode) => localStorage.setItem("themeMode", mode),
        theme
      );
      await setupDeterministicTestParallel(page, testUser, {
        clearRepertoire: true,
        seedRepertoire: [CATALOG_TUNE_KESH_ID],
      });
      await page.goto("/user-settings/goals");
      const settings = page.getByTestId("settings-modal");
      await expect(settings).toBeVisible({ timeout: 15000 });
      const recall = page.getByTestId(
        "goal-panel-00000000-0000-0000-0000-000000000001"
      );
      await recall.getByRole("button", { name: "Edit", exact: true }).click();
      await page
        .getByTestId("goal-name")
        .fill(
          "Recall — maintaining my repertoire with confident independent playing"
        );
      await page.screenshot({
        path: testInfo.outputPath("goals-expanded.png"),
      });
      const content = page.getByTestId("goal-editor-dialog");
      expect
        .soft(
          await content.evaluate(
            (element) => element.scrollWidth - element.clientWidth
          )
        )
        .toBeLessThanOrEqual(1);
      await page.getByTestId("goal-save").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("goal-save")).toBeInViewport();
      await page.getByTestId("goal-save").click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      await expect(page.getByTestId("goal-editor-dialog")).toHaveCount(0, {
        timeout: 10000,
      });
      await page.screenshot({
        path: testInfo.outputPath("goals-collapsed.png"),
      });
      await page.getByTestId("settings-close-button").click();
      await page.goto(`/tunes/${CATALOG_TUNE_KESH_ID}/practice-history`);
      await page.getByTestId("practice-history-add-button").click();
      const form = page.getByTestId("practice-history-add-form");
      await expect(form).toBeVisible({ timeout: 10000 });
      await form.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("history-add.png") });
      expect
        .soft(
          await form.evaluate(
            (element) => element.scrollWidth - element.clientWidth
          )
        )
        .toBeLessThanOrEqual(1);
      const goal = form.getByTestId("practice-history-entry-goal");
      await goal.selectOption({ label: "Fluency" });
      await page
        .getByTestId("practice-history-save-button")
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByTestId("practice-history-save-button")
      ).toBeInViewport();
      await page.getByTestId("practice-history-discard-button").click();
      await expect(
        page.getByRole("button", { name: "Keep Editing" })
      ).toBeFocused({ timeout: 10000 });
      await page.screenshot({
        path: testInfo.outputPath("history-discard.png"),
      });
      await page
        .getByRole("button", { name: "Discard Changes", exact: true })
        .click();
      await expect(form).toHaveCount(0);
    });
  }
}

// Short-window collapse must not overwrite the user's normal-height preference.
test("short landscape panel can expand and restores its normal-height state", async ({
  page,
  testUser,
}) => {
  await page.setViewportSize({ width: 667, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem("sidebar-collapsed-mobile", "false");
    localStorage.setItem("sidebar-dock-position-mobile", "bottom");
  });
  await setupDeterministicTestParallel(page, testUser, {
    clearRepertoire: true,
    seedRepertoire: [CATALOG_TUNE_KESH_ID],
  });
  await page.goto(`/tunes/${CATALOG_TUNE_KESH_ID}/practice-history`);
  await expect(page.getByTestId("sidebar-collapse-toggle")).toBeVisible({
    timeout: 10000,
  });
  await page.setViewportSize({ width: 667, height: 320 });
  const expand = page.getByRole("button", {
    name: "Expand sidebar",
    exact: true,
  });
  await expect(expand).toBeVisible({ timeout: 10000 });
  await expand.click();
  await page.getByTestId("sidebar-collapse-toggle").click();
  await expect(expand).toBeVisible({ timeout: 10000 });
  expect(
    await page.evaluate(() => localStorage.getItem("sidebar-collapsed-mobile"))
  ).toBe("false");
  await page.setViewportSize({ width: 667, height: 720 });
  await expect(page.getByTestId("sidebar-collapse-toggle")).toBeVisible({
    timeout: 10000,
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: populated history and retention layouts`, async ({
    page,
    testUser,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.addInitScript(
      (mode) => localStorage.setItem("themeMode", mode),
      theme
    );
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [CATALOG_TUNE_KESH_ID],
    });
    await page.goto(`/tunes/${CATALOG_TUNE_KESH_ID}/practice-history`);
    await page.getByTestId("practice-history-add-button").click();
    await page
      .getByTestId("practice-history-practiced-input")
      .fill("2026-04-20T10:15");
    await page
      .getByTestId("practice-history-quality-select")
      .selectOption("easy");
    await page.getByTestId("practice-history-save-button").click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(page.getByTestId("practice-history-add-form")).toHaveCount(0);
    await expect(
      page.getByTestId("practice-history-session-count")
    ).toContainText("1", { timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Clear Filters" })
    ).toHaveCount(0);
    await expect(
      page.getByText("Sessions in view", { exact: true })
    ).toHaveCount(0);
    await page
      .getByTestId("practice-history-goal-filter")
      .selectOption({ label: "Recall" });
    await expect(
      page.getByTestId("practice-history-stability-chart")
    ).toBeVisible({ timeout: 10000 });
    const dueHeader = page.getByRole("button", {
      name: "About Recorded Due Date",
      exact: true,
    });
    await dueHeader.click();
    await expect(page.getByTestId("history-column-info-due")).toContainText(
      "Later practice or schedule changes may have changed the tune's current due date.",
      { timeout: 10000 }
    );
    await page.keyboard.press("Escape");
    await expect(dueHeader).toBeFocused({ timeout: 10000 });
    for (const viewport of layouts) {
      await page.setViewportSize(viewport);
      const table = page.getByTestId("practice-history-events-table");
      await table.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`history-${viewport.width}.png`),
      });
      const container = page.getByTestId("practice-history-container");
      expect
        .soft(await container.evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThanOrEqual(1);
      await page
        .getByTestId("practice-history-stability-chart")
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`charts-${viewport.width}.png`),
      });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/analysis");
    const retention = page.getByTestId("fsrs-retention-chart");
    await expect(retention.locator("canvas")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: testInfo.outputPath("retention.png") });
    const canvas = retention.locator("canvas");
    const before = await canvas.evaluate((el: HTMLCanvasElement) =>
      el.toDataURL()
    );
    // Exercise the shared chart's document-theme contract without navigating
    // away and remounting it (which would hide a missing live-theme update).
    await page.evaluate(() =>
      document.documentElement.classList.toggle("dark")
    );
    await expect
      .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL()), {
        timeout: 10000,
      })
      .not.toBe(before);
    await page.screenshot({
      path: testInfo.outputPath("retention-theme-changed.png"),
    });
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: goal menus, evaluations and recovery remain reachable`, async ({
    page,
    testUser,
  }, testInfo) => {
    test.setTimeout(90000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.addInitScript(
      (mode) => localStorage.setItem("themeMode", mode),
      theme
    );
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [CATALOG_TUNE_KESH_ID],
      scheduleDaysAgo: 1,
      startTab: "practice",
    });
    const tt = new TuneTreesPage(page);
    const row = tt.getRows("scheduled").first();
    const goal = row.getByRole("button", { name: /recall/i }).first();
    const evaluation = page.getByTestId(`recall-eval-${CATALOG_TUNE_KESH_ID}`);
    for (const viewport of layouts) {
      await page.setViewportSize(viewport);
      // Resizing across the grid breakpoint replaces rows. Trial click waits for
      // an attached, reachable replacement without opening or selecting anything.
      await goal.click({ trial: true });
      await goal.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("goal-option-fluency")).toBeVisible({
        timeout: 10000,
      });
      await page.screenshot({
        path: testInfo.outputPath(`goal-menu-${viewport.width}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(goal).toBeFocused({ timeout: 10000 });
      await evaluation.click();
      await expect(page.getByTestId("recall-eval-option-good")).toBeVisible({
        timeout: 10000,
      });
      await page.screenshot({
        path: testInfo.outputPath(`evaluation-${viewport.width}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(evaluation).toBeFocused({ timeout: 10000 });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await evaluation.click();
    await page.getByTestId("recall-eval-option-good").click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.evaluate(
      async ({ rep, tune }) =>
        window.__ttTestApi?.seedPracticeSubmissionRecovery({
          repertoireId: rep,
          tuneId: tune,
          kind: "notes",
        }),
      { rep: testUser.repertoireId, tune: CATALOG_TUNE_KESH_ID }
    );
    await tt.submitEvaluationsButton.click();
    await expect(page.getByTestId("recovery-private-note")).toHaveValue(
      "Private text to preserve",
      { timeout: 10000 }
    );
    for (const viewport of layouts) {
      await page.setViewportSize(viewport);
      const recovery = page.getByTestId("practice-submit-recovery");
      await recovery.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`recovery-${viewport.width}.png`),
      });
      expect
        .soft(await recovery.evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThanOrEqual(1);
      await page.getByTestId("recovery-copy-notes").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("recovery-copy-notes")).toBeInViewport();
      // Geometry alone can pass for controls covered by the docked panel.
      await page
        .getByTestId("recovery-copy-notes")
        .click({ trial: true, timeout: 10000 });
      await page.getByTestId("recovery-notes-saved").check();
      await page
        .getByTestId("recovery-clear-notes")
        .click({ trial: true, timeout: 10000 });
    }
  });
}

test("ladder evaluations use available height and keep the final choice reachable", async ({
  page,
  testUser,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await setupForPracticeTestsParallel(page, testUser, {
    repertoireTunes: [CATALOG_TUNE_KESH_ID],
    scheduleDaysAgo: 1,
    startTab: "practice",
  });
  const tt = new TuneTreesPage(page);
  const row = tt.getRows("scheduled").first();
  await row
    .getByRole("button", { name: /recall/i })
    .first()
    .click();
  await page.getByTestId("goal-option-session_ready").click();
  const evaluation = page.getByTestId(`recall-eval-${CATALOG_TUNE_KESH_ID}`);
  await evaluation.click();
  const menu = page.getByTestId(`recall-eval-menu-${CATALOG_TUNE_KESH_ID}`);
  const last = page.getByTestId("recall-eval-option-session_ready");
  await expect(last).toContainText("Due ", { timeout: 10000 });
  await expect(menu).toHaveCSS("width", "320px");
  const triggerBounds = await evaluation.boundingBox();
  expect(triggerBounds).not.toBeNull();
  // Popper settles after due estimates load; the popup should cover its trigger.
  await expect
    .poll(
      async () => {
        const bounds = await menu.boundingBox();
        return (
          bounds &&
          triggerBounds &&
          bounds.y <= triggerBounds.y + triggerBounds.height / 2 &&
          bounds.y + bounds.height >= triggerBounds.y + triggerBounds.height / 2
        );
      },
      { timeout: 10000 }
    )
    .toBe(true);
  await page.getByTestId("recall-eval-explain").click();
  await expect(last).toContainText("Plays confidently with others", {
    timeout: 10000,
  });
  await expect(evaluation).toContainText("(Not Set)");
  await page.getByTestId("recall-eval-explain").click();
  // Once preview lines arrive, all choices must fit without the old fixed-height cap.
  await expect
    .poll(() => menu.evaluate((el) => el.scrollHeight - el.clientHeight), {
      timeout: 10000,
    })
    .toBeLessThanOrEqual(1);
  await expect(last).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 667, height: 320 });
  await evaluation.click();
  await expect(last).toContainText("Due ", { timeout: 10000 });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport({ ratio: 1 });
  await last.click();
  await expect(evaluation).toContainText("Session-ready", { timeout: 10000 });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await evaluation.click();
  await expect(last).toContainText("Current selection", { timeout: 10000 });
  await expect(last).toContainText("Due ", { timeout: 10000 });
  // Align the selected row with the control, allowing the 16px top viewport margin.
  await expect
    .poll(
      async () => {
        const trigger = await evaluation.boundingBox();
        const choice = await last.boundingBox();
        const popup = await menu.boundingBox();
        if (!trigger || !choice || !popup) return Number.POSITIVE_INFINITY;
        const choiceOffset = choice.y - popup.y + choice.height / 2;
        const expectedCenter = Math.max(
          trigger.y + trigger.height / 2,
          16 + choiceOffset
        );
        return Math.abs(expectedCenter - choice.y - choice.height / 2);
      },
      { timeout: 10000 }
    )
    .toBeLessThanOrEqual(2);
  await page.screenshot({ path: `/tmp/426-overlap-${testUser.userId}.png` });
  await page.keyboard.press("Escape");
  await expect(evaluation).toBeFocused({ timeout: 10000 });
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: shared calendar saves and guards unfinished edits`, async ({
    page,
    testUser,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.addInitScript(
      (mode) => localStorage.setItem("themeMode", mode),
      theme
    );
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
    await page.goto("/user-settings/goals");
    await page.getByTestId("shared-practice-calendar").click();
    const dialog = page.getByTestId("practice-calendar-dialog");
    await expect(dialog).toContainText(
      "not yet applied to practice scheduling",
      { timeout: 10000 }
    );
    await page.getByTestId("calendar-days").fill("4");
    await page.getByTestId("calendar-weekly").fill('{"monday":true}');
    await page.getByTestId("calendar-exceptions").fill("[]");
    await page.getByTestId("calendar-save").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("calendar-save")).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("calendar-editor.png") });
    await page.getByTestId("calendar-save").click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(dialog).toHaveCount(0, { timeout: 10000 });
    await page.reload();
    await page.getByTestId("shared-practice-calendar").click();
    await expect(page.getByTestId("calendar-days")).toHaveValue("4", {
      timeout: 10000,
    });
    await expect(page.getByTestId("calendar-weekly")).toHaveValue(
      '{"monday":true}'
    );
    await page.getByTestId("calendar-days").fill("2");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Keep Editing", exact: true })
      .click();
    await expect(page.getByTestId("calendar-days")).toHaveValue("2");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Discard Changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0, { timeout: 10000 });
    await page.getByTestId("shared-practice-calendar").click();
    await expect(page.getByTestId("calendar-days")).toHaveValue("4", {
      timeout: 10000,
    });
  });
}
