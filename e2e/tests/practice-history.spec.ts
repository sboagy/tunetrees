import { expect, type Page } from "@playwright/test";
import {
  CATALOG_TUNE_BANISH_MISFORTUNE,
  CATALOG_TUNE_COOLEYS_ID,
  CATALOG_TUNE_KESH_ID,
} from "../../src/lib/db/catalog-tune-ids";
import { applyDeterministicFsrsConfig } from "../helpers/fsrs-test-config";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";
import { BASE_URL } from "../test-config";

/**
 * PRACTICE-HISTORY: Read-only history, FSRS labels, analytics, and navigation
 * Priority: High
 */

let ttPage: TuneTreesPage;

async function gotoPracticeHistory(page: Page, tuneId: string) {
  await page.goto(`${BASE_URL}/tunes/${tuneId}/practice-history`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("practice-history-container")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText("Loading practice history...", { exact: false })
  ).toHaveCount(0, {
    timeout: 20_000,
  });
}

test.describe("PRACTICE-HISTORY: Viewing Records", () => {
  test.beforeEach(async ({ page, testUser }) => {
    await applyDeterministicFsrsConfig(page);
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [CATALOG_TUNE_BANISH_MISFORTUNE],
    });

    await gotoPracticeHistory(page, CATALOG_TUNE_BANISH_MISFORTUNE);
  });

  test("shows an empty state for tunes without practice records", async ({
    page,
  }) => {
    await expect(
      page.getByText("No practice records found for this tune.")
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("practice-history-add-button")).toBeVisible();
  });
});

test.describe("PRACTICE-HISTORY: Manual Backfill", () => {
  test.beforeEach(async ({ page, testUser }) => {
    await applyDeterministicFsrsConfig(page);
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [CATALOG_TUNE_KESH_ID],
    });

    await gotoPracticeHistory(page, CATALOG_TUNE_KESH_ID);
  });

  test("adds a practice entry with FSRS labels and shows analytics", async ({
    page,
  }) => {
    await page.getByTestId("practice-history-add-button").click();

    await expect(page.getByTestId("practice-history-add-form")).toBeVisible({
      timeout: 10_000,
    });

    await page
      .getByTestId("practice-history-practiced-input")
      .fill("2026-04-20T10:15");
    await page
      .getByTestId("practice-history-quality-select")
      .selectOption("easy");

    await page.getByTestId("practice-history-save-button").click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    const grid = page.locator("table").first();
    await expect(grid).toBeVisible({ timeout: 10_000 });
    await expect(grid.getByText("Easy")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByTestId("practice-history-quality-chart")
    ).toHaveCount(0);
    await page
      .getByTestId("practice-history-goal-filter")
      .selectOption({ label: "Recall" });
    await expect(page.getByTestId("practice-history-analytics")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByTestId("practice-history-quality-chart")
    ).toBeVisible();
    await expect(
      page.getByTestId("practice-history-stability-chart")
    ).toBeVisible();
  });

  test("records Fluency and scopes the entire history view to the selected goal", async ({
    page,
  }) => {
    await page.getByTestId("practice-history-add-button").click();
    await page
      .getByTestId("practice-history-practiced-input")
      .fill("2026-04-18T09:00");
    await page
      .getByTestId("practice-history-quality-select")
      .selectOption("good");
    await page.getByTestId("practice-history-save-button").click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    await expect(page.getByTestId("practice-history-add-form")).toHaveCount(0);
    await page.getByTestId("practice-history-add-button").click();
    await page
      .getByTestId("practice-history-entry-goal")
      .selectOption({ label: "Fluency" });
    await page
      .getByTestId("practice-history-practiced-input")
      .fill("2026-04-19T09:00");
    await page
      .getByTestId("practice-history-quality-select")
      .selectOption("fluent");
    await page.getByTestId("practice-history-save-button").click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    const table = page.getByTestId("practice-history-events-table");
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(
      page.getByTestId("practice-history-quality-chart")
    ).toHaveCount(0);
    await page
      .getByTestId("practice-history-goal-filter")
      .selectOption({ label: "Recall" });
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.getByText("Good", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(table.getByText("Fluent", { exact: true })).toHaveCount(0);
    await expect(
      table.getByRole("columnheader", { name: "Stability", exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByTestId("practice-history-quality-chart")
    ).toBeVisible({ timeout: 10_000 });
    await page
      .getByTestId("practice-history-goal-filter")
      .selectOption({ label: "Fluency" });
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.getByText("Fluent", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(table.getByText("Good", { exact: true })).toHaveCount(0);
    await expect(
      table.getByRole("columnheader", { name: "Ladder position" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByTestId("practice-history-quality-chart")
    ).toHaveCount(0);
    await page.getByTestId("practice-history-add-button").click();
    await expect(
      page.getByTestId("practice-history-entry-goal").locator("option:checked")
    ).toHaveText("Fluency");
    await page.getByTestId("practice-history-discard-button").click();
    await table
      .getByRole("button", { name: "Delete entry", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Delete practice entry?" })
      .getByRole("button", { name: "Delete entry", exact: true })
      .click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    await expect(page.getByTestId("practice-history-goal-filter")).toHaveValue(
      ""
    );
    await expect(table.getByText("Good", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("practice-history-add-button").click();
    await expect(
      page.getByTestId("practice-history-entry-goal").locator("option:checked")
    ).toHaveText("Recall");
  });

  test("rejects a future practice date without writing history", async ({
    page,
  }) => {
    await page.getByTestId("practice-history-add-button").click();
    await page
      .getByTestId("practice-history-practiced-input")
      .fill("2099-04-18T09:00");
    await page.getByTestId("practice-history-save-button").click();
    await expect(page.getByRole("alert")).toContainText(
      "Practice date cannot be in the future",
      { timeout: 10_000 }
    );
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await expect(page.getByTestId("practice-history-add-form")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("keeps saved history rows read-only", async ({ page }) => {
    await page.getByTestId("practice-history-add-button").click();
    await page
      .getByTestId("practice-history-practiced-input")
      .fill("2026-04-18T09:00");
    await page
      .getByTestId("practice-history-quality-select")
      .selectOption("good");
    await page.getByTestId("practice-history-save-button").click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(page.locator("tbody input")).toHaveCount(0);
    await expect(page.locator("tbody select")).toHaveCount(0);
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });
});

test.describe("PRACTICE-HISTORY: Deleting Records", () => {
  test.beforeEach(async ({ page, testUser }) => {
    await applyDeterministicFsrsConfig(page);
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [CATALOG_TUNE_COOLEYS_ID],
    });

    await gotoPracticeHistory(page, CATALOG_TUNE_COOLEYS_ID);

    await page.getByTestId("practice-history-add-button").click();
    await page
      .getByTestId("practice-history-practiced-input")
      .fill("2026-04-21T08:30");
    await page
      .getByTestId("practice-history-quality-select")
      .selectOption("hard");
    await page.getByTestId("practice-history-save-button").click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("deletes an existing practice record after confirmation", async ({
    page,
  }) => {
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);

    await rows.first().getByRole("button", { name: "Delete entry" }).click();
    const confirmation = page.getByRole("dialog", {
      name: "Delete practice entry?",
    });
    await expect(confirmation).toBeVisible({ timeout: 10_000 });
    await expect(rows).toHaveCount(1);
    await confirmation
      .getByRole("button", { name: "Delete entry", exact: true })
      .click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(rows).toHaveCount(0);
    await expect(
      page.getByText("No practice records found for this tune.")
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("PRACTICE-HISTORY: Navigation", () => {
  test.beforeEach(async ({ page, testUser }) => {
    await applyDeterministicFsrsConfig(page);
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [CATALOG_TUNE_KESH_ID],
    });

    await ttPage.navigateToTab("repertoire");
  });

  test("cancel returns to the previous grid route when opened from the sidebar", async ({
    page,
  }) => {
    await ttPage.searchForTune("Kesh", ttPage.repertoireGrid);
    const firstRow = ttPage.getRows("repertoire").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await ttPage.selectGridRow(firstRow);
    await ttPage.ensureTuneInfoExpanded({ timeoutMs: 10_000 });

    await page.getByTestId("sidebar-practice-history-link").click();
    await expect(page.getByTestId("practice-history-container")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/tunes\/[^/]+\/practice-history/);

    await page.getByTestId("practice-history-cancel-button").click();

    await expect(
      page,
      "cancel should restore the originating repertoire grid URL"
    ).toHaveURL(
      (url) =>
        url.pathname === "/" &&
        url.searchParams.get("tab") === "repertoire" &&
        url.searchParams.get("r_q") === "Kesh",
      { timeout: 20_000 }
    );
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10_000 });
  });
});
