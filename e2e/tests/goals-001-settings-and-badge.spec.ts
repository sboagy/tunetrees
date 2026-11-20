import { expect, type Locator, type Page } from "@playwright/test";
import { CATALOG_TUNE_COOLEYS_ID } from "../../src/lib/db/catalog-tune-ids";
import {
  seedSchedulingPluginLocally,
  setupDeterministicTestParallel,
  setupForRepertoireTestsParallel,
} from "../helpers/practice-scenarios";
import { setOfflineForTest } from "../helpers/sync-error-guard";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * GOALS-001: Goals Settings + Repertoire Goal Badge
 * Priority: High
 *
 * Validates the user-facing goals feature set from issue #426:
 * - Goals settings tab CRUD for user-defined goals
 * - Repertoire goal badge dropdown updates goal assignment
 * - Goal badge "Edit Goals…" action opens settings modal on Goals tab
 */

let ttPage: TuneTreesPage;

async function openSettingsTab(
  page: Page,
  tab:
    | "appearance"
    | "catalog-sync"
    | "scheduling-options"
    | "plugins"
    | "goals"
    | "account"
    | "avatar"
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const settingsVisible = await ttPage.userSettingsButton
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (settingsVisible) break;

    await ttPage.userMenuButton.click();
    await page.waitForTimeout(300);
  }

  await expect(ttPage.userSettingsButton).toBeVisible({ timeout: 5000 });
  await ttPage.userSettingsButton.click();

  const settingsModal = page.getByTestId("settings-modal");
  await expect(settingsModal).toBeVisible({ timeout: 15000 });

  const sidebar = settingsModal.getByTestId("settings-sidebar");
  const menuToggle = settingsModal.getByTestId("settings-menu-toggle");
  const targetTab = settingsModal.getByTestId(`settings-tab-${tab}`);

  const hasMobileToggle = await menuToggle
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (hasMobileToggle) {
    const tabBox = await targetTab.boundingBox().catch(() => null);
    const tabLikelyOffCanvas = !tabBox || tabBox.width < 20 || tabBox.x < 0;

    if (tabLikelyOffCanvas) {
      await menuToggle.click();
      await expect
        .poll(
          async () =>
            (await sidebar.boundingBox().catch(() => null))?.width ?? 0,
          { timeout: 5000, intervals: [100, 250, 500] }
        )
        .toBeGreaterThan(150);
    }
  }

  await expect(targetTab).toBeVisible({ timeout: 10000 });
  await targetTab.scrollIntoViewIfNeeded().catch(() => undefined);

  try {
    await targetTab.click({ timeout: 4000 });
  } catch {
    await targetTab.dispatchEvent("click");
  }

  await expect(page.getByTestId("settings-content")).toBeVisible({
    timeout: 10000,
  });
}

async function clickGoalBadgeMenuItem(
  page: Page,
  trigger: Locator,
  itemName: string | RegExp
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
    await expect(trigger).toBeVisible({ timeout: 10000 });

    const menuItem = page.getByRole("menuitem", { name: itemName }).last();
    const menuItemVisible = await menuItem
      .isVisible({ timeout: 250 })
      .catch(() => false);

    if (!menuItemVisible) {
      await trigger.click();
      await expect(menuItem).toBeVisible({ timeout: 5000 });
    }

    const clicked = await menuItem
      .click({ timeout: 2000 })
      .then(() => true)
      .catch(() => menuItem.dispatchEvent("click").then(() => true))
      .catch(() =>
        menuItem
          .evaluate((el) => {
            (el as HTMLElement).click();
          })
          .then(() => true)
      )
      .catch(() => false);

    if (clicked) {
      return;
    }

    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(100);
  }

  await page.getByRole("menuitem", { name: itemName }).last().click();
}

test.describe("GOALS-001: Goals settings", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
  });

  test("saves collapsed goal drafts together and guards Settings dismissal", async ({
    page,
  }) => {
    await openSettingsTab(page, "goals");
    const recall = page.getByTestId(
      "goal-panel-00000000-0000-0000-0000-000000000001"
    );
    const fluency = page.getByTestId(
      "goal-panel-00000000-0000-0000-0000-000000000003"
    );
    await expect(page.getByTestId("goal-save")).toBeDisabled();
    await recall.getByRole("button", { name: "Edit", exact: true }).click();
    await recall.getByTestId("goal-minimum").fill("2");
    await recall.getByRole("button", { name: "Collapse", exact: true }).click();
    await fluency.getByRole("button", { name: "Edit", exact: true }).click();
    await fluency.getByTestId("goal-minimum").fill("1");
    await page.getByTestId("settings-close-button").click();
    await expect(
      page.getByRole("heading", { name: "Discard changes?" })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Keep editing" })
    ).toBeFocused();
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(fluency.getByTestId("goal-minimum")).toHaveValue("1");
    await page.getByTestId("goal-save").click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(page.getByTestId("goal-save")).toBeDisabled({
      timeout: 10000,
    });
    await page.reload();
    await openSettingsTab(page, "goals");
    await recall.getByRole("button", { name: "Edit", exact: true }).click();
    await fluency.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(recall.getByTestId("goal-minimum")).toHaveValue("2");
    await expect(fluency.getByTestId("goal-minimum")).toHaveValue("1");
  });

  test("reveals invalid collapsed goals before saving and preserves other edits", async ({
    page,
  }) => {
    await openSettingsTab(page, "goals");
    const recall = page.getByTestId(
      "goal-panel-00000000-0000-0000-0000-000000000001"
    );
    const fluency = page.getByTestId(
      "goal-panel-00000000-0000-0000-0000-000000000003"
    );
    await recall.getByRole("button", { name: "Edit", exact: true }).click();
    await recall.getByTestId("goal-name").fill("");
    await recall.getByRole("button", { name: "Collapse", exact: true }).click();
    await fluency.getByRole("button", { name: "Edit", exact: true }).click();
    await fluency.getByTestId("goal-minimum").fill("1");
    await page.getByTestId("goal-save").click();
    await expect(recall.getByTestId("goal-name")).toBeFocused({
      timeout: 10000,
    });
    await expect(fluency.getByTestId("goal-minimum")).toHaveValue("1");
    await page.getByTestId("settings-close-button").click();
    await page
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
    await expect(page.getByTestId("settings-modal")).toHaveCount(0, {
      timeout: 10000,
    });
    await openSettingsTab(page, "goals");
    await recall.getByRole("button", { name: "Edit", exact: true }).click();
    await fluency.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(recall.getByTestId("goal-name")).toHaveValue("Recall");
    await expect(fluency.getByTestId("goal-minimum")).toHaveValue("0");
  });

  test("persists the per-goal same-day FSRS option", async ({ page }) => {
    await openSettingsTab(page, "goals");
    const editRecall = page.getByTestId(
      "goal-edit-00000000-0000-0000-0000-000000000001"
    );
    await editRecall.click();
    await ttPage.goalFsrsAdvanced.click();
    const sameDay = page.getByTestId("goal-allow-same-day-reviews");
    await expect(sameDay).not.toBeChecked();
    await sameDay.check();
    await page.getByTestId("goal-save").click();
    await expect(page.getByTestId("goal-editor")).toHaveCount(0, {
      timeout: 10000,
    });
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.reload();
    await openSettingsTab(page, "goals");
    await editRecall.click();
    await ttPage.goalFsrsAdvanced.click();
    await expect(sameDay).toBeChecked();
  });

  test("C: selects named plugin actions and preserves personal labels after offline save", async ({
    page,
    context,
    testUser,
  }) => {
    const goalName = `custom_scheduler_${test.info().workerIndex}_${Date.now()}`;
    await seedSchedulingPluginLocally(page, {
      userId: testUser.userId,
      name: "Named action scheduler",
      script: `
        function describeGoalSchedulerV1() {
          return { apiVersion: 1, stateVersion: 1, compatibleStateVersions: [1], actions: [
            { id: "advance", label: "Advance", description: "Review tomorrow" },
            { id: "repeat", label: "Repeat", description: "Review in six hours" }
          ] };
        }
        function scheduleGoalV1(input) {
          const hours = input.evaluation.actionId === "repeat" ? 6 : 24;
          return { due: new Date(Date.parse(input.practiced) + hours * 3600000).toISOString(), state: {} };
        }
      `,
    });
    await openSettingsTab(page, "goals");
    await page.getByTestId("goal-add").click();
    await page.getByTestId("goal-name").fill(goalName);
    await page
      .getByTestId("goal-scheduler")
      .selectOption({ label: "Named action scheduler (custom scheduler)" });
    await expect(page.getByTestId("goal-choice-label-0")).toHaveValue(
      "Advance",
      { timeout: 10000 }
    );
    await page.getByTestId("goal-choice-label-0").fill("At tempo");
    await page.getByTestId("goal-choice-action-0").selectOption("repeat");
    // Inspection loads the sandbox before going offline; saving must still use
    // the locally stored script and declarations, not contact a remote service.
    await setOfflineForTest(context, true);
    await page.getByTestId("goal-save").click();
    await expect(page.getByTestId("goal-editor")).toHaveCount(0, {
      timeout: 10000,
    });
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    const row = page.locator("section[data-testid^='goal-panel-']").filter({
      has: page.getByRole("heading", {
        name: goalName,
        exact: true,
      }),
    });
    await expect(row).toContainText("Custom scheduler", { timeout: 10000 });
    await setOfflineForTest(context, false);
    await page.reload();
    await openSettingsTab(page, "goals");
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByTestId("goal-plugin-reload")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("goal-choice-label-0")).toHaveValue(
      "At tempo",
      { timeout: 10000 }
    );
    await expect(page.getByTestId("goal-choice-action-0")).toHaveValue(
      "repeat",
      { timeout: 10000 }
    );
  });

  test("A: should create, edit, and delete a user-defined goal", async ({
    page,
  }) => {
    await openSettingsTab(page, "goals");

    await expect(
      page.getByRole("heading", { name: "Goals", level: 3 })
    ).toBeVisible({ timeout: 10000 });

    const goalName = `e2e_goal_${test.info().workerIndex}_${Date.now()}`;
    const updatedGoalName = `${goalName}_updated`;

    await page.getByTestId("goal-add").click();
    await page.getByTestId("goal-name").fill(goalName);
    await page
      .getByTestId("goal-description")
      .fill("Build confidence at session tempo");
    await page
      .getByTestId("goal-scheduler")
      .selectOption("builtin:interval-ladder");
    await page.getByTestId("goal-intervals").fill("0.5, 1, 2, 3");
    await page.getByTestId("goal-minimum").fill("0");
    await page.getByTestId("goal-unlimited").check();
    await page.getByTestId("goal-choice-label-0").fill("Start again slowly");
    await page.getByTestId("goal-save").click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const createdRow = page
      .locator("section[data-testid^='goal-panel-']")
      .filter({
        has: page.getByRole("heading", { name: goalName, exact: true }),
      });
    await expect(createdRow).toBeVisible({ timeout: 10000 });
    await expect(createdRow).toContainText("Build confidence at session tempo");
    await expect(createdRow).toContainText("Unlimited");
    await createdRow.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByTestId("goal-choice-label-0")).toHaveValue(
      "Start again slowly"
    );
    await expect(page.getByTestId("goal-intervals")).toHaveValue(
      "0.5, 1, 2, 3"
    );
    await page.getByTestId("goal-name").fill(updatedGoalName);
    await page.getByTestId("goal-scheduler").selectOption("builtin:fsrs6");
    await page.getByTestId("goal-save").click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const updatedRow = page
      .locator("section[data-testid^='goal-panel-']")
      .filter({
        has: page.getByRole("heading", { name: updatedGoalName, exact: true }),
      });
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
    await updatedRow.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByTestId("goal-delete").click();
    await page
      .getByTestId("goal-replacement")
      .selectOption({ label: "Recall" });
    await page.getByTestId("goal-confirm-delete").click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect(page.getByText(updatedGoalName, { exact: true })).toHaveCount(
      0,
      { timeout: 10000 }
    );
  });
});

test.describe("GOALS-001: Repertoire goal badge", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [CATALOG_TUNE_COOLEYS_ID],
    });

    await ttPage.navigateToTab("repertoire");
    await ttPage.ensureGridView("repertoire");
  });

  test("B: should update goal from badge dropdown and open Goals settings", async ({
    page,
  }) => {
    await ttPage.searchForTune("Cooley's", ttPage.repertoireGrid);

    const row = ttPage.repertoireGrid
      .locator("tbody tr[data-index]", { hasText: "Cooley's" })
      .first();
    await expect(row).toBeVisible({ timeout: 10000 });

    const goalTrigger = row.locator("button", { hasText: /recall/i }).first();
    await expect(goalTrigger).toBeVisible({ timeout: 10000 });
    await clickGoalBadgeMenuItem(page, goalTrigger, /^Session ready/);
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect(row.getByText("Session ready", { exact: true })).toBeVisible({
      timeout: 10000,
    });

    const updatedGoalTrigger = row
      .locator("button", { hasText: /Session ready/i })
      .first();
    await clickGoalBadgeMenuItem(page, updatedGoalTrigger, /Edit Goals/i);

    const settingsModal = page.getByTestId("settings-modal");
    await expect(settingsModal).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "Goals", level: 3 })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      settingsModal.getByTestId("settings-tab-goals")
    ).toHaveAttribute("aria-current", "page");
  });
});
