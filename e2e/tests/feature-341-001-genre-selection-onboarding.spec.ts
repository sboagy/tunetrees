/**
 * FEATURE-341 (P1): Anonymous genre selection onboarding
 */

import { expect } from "@playwright/test";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

let ttPage: TuneTreesPage;

test.describe("FEATURE-341: Anonymous genre selection onboarding", () => {
  test.beforeEach(async ({ page }) => {
    ttPage = new TuneTreesPage(page);
    await ttPage.gotoLogin();
  });

  test("requires at least one genre selection", async () => {
    await ttPage.signInAnonymouslyToGenreSelection("E2E Genre Repertoire");

    // Genre dialog opens with no genres pre-selected, so Continue is already
    // disabled and Clear all is disabled. Select all first, then clear to
    // verify that Continue becomes disabled again.
    await expect(ttPage.onboardingGenreSelectAllButton).toBeVisible({
      timeout: 15000,
    });
    await ttPage.onboardingGenreSelectAllButton.click();
    await expect(ttPage.onboardingGenreContinueButton).toBeEnabled({
      timeout: 10000,
    });

    await expect(ttPage.onboardingGenreClearAllButton).toBeEnabled({
      timeout: 5000,
    });
    await ttPage.onboardingGenreClearAllButton.click();

    await expect(ttPage.onboardingGenreContinueButton).toBeDisabled({
      timeout: 10000,
    });

    await ttPage.onboardingGenreCheckboxes.first().click();
    await expect(ttPage.onboardingGenreContinueButton).toBeEnabled({
      timeout: 10000,
    });
  });

  test("continues to catalog after selecting genres", async ({ page }) => {
    await ttPage.signInAnonymouslyToGenreSelection("E2E Catalog Repertoire");

    // Genre dialog opens with no genres pre-selected — just select Blues directly.
    await expect(ttPage.onboardingGenreSearchInput).toBeVisible({
      timeout: 15000,
    });
    await ttPage.page
      .getByRole("checkbox", { name: "Blues - Blues", exact: true })
      .click();

    await expect(ttPage.onboardingGenreContinueButton).toBeEnabled({
      timeout: 10000,
    });
    await ttPage.onboardingGenreContinueButton.click();

    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await page.getByRole("button", { name: "Got it!" }).click();

    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await page.waitForURL(/\?tab=catalog/, { timeout: 15000 });
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 15000 });
    await expect(ttPage.onboardingGenreContinueButton).toBeHidden({
      timeout: 10000,
    });
  });
});
