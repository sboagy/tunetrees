import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * ANALYSIS-001: Analysis Charts Smoke Tests
 * Priority: Medium
 *
 * Verifies that the Analysis page renders all four chart containers and that
 * they are visible to the user after a repertoire has been seeded.
 *
 * These are smoke-level tests: they assert presence and visibility of chart
 * card containers but do not assert exact data values (which depend on the
 * test database state and chart.js canvas rendering).
 */

let ttPage: TuneTreesPage;

test.describe("ANALYSIS-001: Analysis Charts", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Seed a repertoire so that the charts have a repertoire to query against.
    // The seed list can be empty; we only need the repertoire to exist.
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: false,
      seedRepertoire: [],
    });

    await ttPage.navigateToTab("analysis");
    // Wait for the page to settle after navigation
    await expect(page.getByTestId("analysis-page")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("analysis page renders and shows heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /analysis/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("FSRS retention curve card is visible", async ({ page }) => {
    // The card may show data, an empty state, or a loading state —
    // all of which are inside the data-testid container.
    await expect(page.getByTestId("fsrs-retention-chart")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("staleness factor chart card is visible", async ({ page }) => {
    await expect(page.getByTestId("staleness-chart")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("practice heatmap card is visible", async ({ page }) => {
    await expect(page.getByTestId("practice-heatmap")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("repertoire coverage chart card is visible", async ({ page }) => {
    await expect(page.getByTestId("repertoire-coverage-chart")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("all four chart cards are visible simultaneously", async ({ page }) => {
    await expect(page.getByTestId("fsrs-retention-chart")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("staleness-chart")).toBeVisible();
    await expect(page.getByTestId("practice-heatmap")).toBeVisible();
    await expect(page.getByTestId("repertoire-coverage-chart")).toBeVisible();
  });
});
