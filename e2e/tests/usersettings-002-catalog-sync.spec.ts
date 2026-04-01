import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * USERSETTINGS-002: Catalog & Sync
 * Priority: High
 *
 * Verifies the Catalog & Sync settings page renders and responds to selection changes.
 */

let ttPage: TuneTreesPage;

async function openCatalogSync(page: import("@playwright/test").Page) {
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
  const catalogSyncTab = settingsModal.getByTestId("settings-tab-catalog-sync");

  const hasMobileToggle = await menuToggle
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (hasMobileToggle) {
    const tabBox = await catalogSyncTab.boundingBox().catch(() => null);
    const tabLikelyOffCanvas =
      !tabBox || tabBox.width < 20 || tabBox.x + tabBox.width < 0;

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

  await expect(catalogSyncTab).toBeVisible({ timeout: 10000 });
  await catalogSyncTab.scrollIntoViewIfNeeded().catch(() => undefined);
  try {
    await catalogSyncTab.click({ timeout: 4000 });
  } catch {
    await catalogSyncTab.dispatchEvent("click");
  }

  await expect(page.getByTestId("settings-genre-save")).toBeVisible({
    timeout: 15000,
  });
}

test.describe("USERSETTINGS-002: Catalog & Sync", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });

    await openCatalogSync(page);
  });

  test("renders catalog sync controls", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Catalog & Sync" })
    ).toBeVisible({ timeout: 5000 });

    await expect(page.getByTestId("settings-genre-search")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("settings-genre-select-all")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("settings-genre-clear-all")).toBeVisible({
      timeout: 5000,
    });

    const checkboxes = page.locator(
      '[data-testid^="settings-genre-checkbox-"]'
    );
    await expect
      .poll(() => checkboxes.count(), {
        timeout: 15000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThan(0);

    await expect(page.getByTestId("settings-genre-save")).toBeDisabled({
      timeout: 5000,
    });
  });

  test("enables save after changing selection", async ({ page }) => {
    const checkboxes = page.locator(
      '[data-testid^="settings-genre-checkbox-"]'
    );
    await expect
      .poll(() => checkboxes.count(), {
        timeout: 15000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThan(0);

    const firstCheckbox = checkboxes.first();
    const wasChecked = await firstCheckbox.isChecked();
    await firstCheckbox.setChecked(!wasChecked);

    await expect(page.getByTestId("settings-genre-save")).toBeEnabled({
      timeout: 5000,
    });
  });

  test("persists selection after closing", async ({ page }) => {
    const selectable = page.locator(
      '[data-testid^="settings-genre-checkbox-"]:not(:disabled)'
    );
    await expect
      .poll(() => selectable.count(), {
        timeout: 15000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThan(1);

    // Deterministic selection: clear all (keeps locked), then check two enabled genres.
    await page.getByTestId("settings-genre-clear-all").click();

    const first = selectable.first();
    const second = selectable.nth(1);
    await first.setChecked(true);
    await second.setChecked(true);

    const expectedSelected = await page
      .locator('[data-testid^="settings-genre-checkbox-"]:checked')
      .count();

    const saveButton = page.getByTestId("settings-genre-save");
    await saveButton.click();
    await expect(saveButton).toHaveText(/Save Changes/i, { timeout: 20000 });
    await expect(saveButton).toBeDisabled({ timeout: 20000 });

    await page.getByTestId("settings-close-button").click();
    await page
      .getByTestId("settings-modal")
      .waitFor({ state: "hidden", timeout: 10000 });

    await openCatalogSync(page);

    const checkboxes = page.locator(
      '[data-testid^="settings-genre-checkbox-"]'
    );
    await expect
      .poll(() => checkboxes.count(), {
        timeout: 15000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThan(0);

    await expect
      .poll(
        async () =>
          page
            .locator('[data-testid^="settings-genre-checkbox-"]:checked')
            .count(),
        { timeout: 30000, intervals: [200, 500, 1000] }
      )
      .toBe(expectedSelected);
  });
});
