import { expect, type Page } from "@playwright/test";
import { CATALOG_TUNE_COOLEYS_ID } from "../../src/lib/db/catalog-tune-ids";
import {
  setupDeterministicTestParallel,
  setupForRepertoireTestsParallel,
} from "../helpers/practice-scenarios";
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
    | "spaced-repetition"
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

test.describe("GOALS-001: Goals settings", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
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

    await page.getByRole("button", { name: /\+\s*Add Goal|Add Goal/i }).click();

    await page.getByLabel("Name").fill(goalName);
    await page.getByRole("radio", { name: /Base Intervals/i }).check();
    await page.getByLabel(/Interval ladder/i).fill("[0.5, 1, 2, 3]");

    await page.getByRole("button", { name: /^Add Goal$/ }).click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const createdRow = page
      .locator("div", {
        has: page.getByText(goalName, { exact: true }),
      })
      .filter({ hasText: "Base Intervals" })
      .first();

    await expect(createdRow).toBeVisible({ timeout: 10000 });
    await createdRow.getByRole("button", { name: "Edit" }).click();

    const activeEditForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save" }),
    });

    await expect(activeEditForm).toBeVisible({ timeout: 5000 });
    await activeEditForm.getByLabel("Name").fill(updatedGoalName);
    await activeEditForm.getByRole("radio", { name: /FSRS/i }).check();
    await activeEditForm.getByRole("button", { name: "Save" }).click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const updatedRow = page
      .locator("div", { has: page.getByText(updatedGoalName, { exact: true }) })
      .first();

    await expect(updatedRow).toBeVisible({ timeout: 10000 });

    page.once("dialog", (dialog) => dialog.accept());
    await updatedRow.getByRole("button", { name: "Delete" }).click();

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
  });

  test("B: should update goal from badge dropdown and open Goals settings", async ({
    page,
  }) => {
    if (test.info().project.name === "Mobile Chrome") {
      test.skip(
        true,
        "Test uses tbody tr[data-index] and cell selectors not available in mobile stacked list."
      );
    }
    await ttPage.searchForTune("Cooley's", ttPage.repertoireGrid);

    const row = ttPage.repertoireGrid
      .locator("tbody tr[data-index]", { hasText: "Cooley's" })
      .first();
    await expect(row).toBeVisible({ timeout: 10000 });

    const goalTrigger = row.locator("button", { hasText: /recall/i }).first();
    await expect(goalTrigger).toBeVisible({ timeout: 10000 });
    await goalTrigger.click();

    await page.getByRole("menuitem", { name: "session_ready" }).click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect(row.getByText("session_ready")).toBeVisible({
      timeout: 10000,
    });

    const updatedGoalTrigger = row
      .locator("button", { hasText: /session_ready/i })
      .first();
    await updatedGoalTrigger.click();

    await page.getByRole("menuitem", { name: /Edit Goals/i }).click();

    const settingsModal = page.getByTestId("settings-modal");
    await expect(settingsModal).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "Goals", level: 3 })
    ).toBeVisible({ timeout: 10000 });
    await expect(settingsModal.getByTestId("settings-tab-goals")).toBeVisible({
      timeout: 10000,
    });
  });
});
