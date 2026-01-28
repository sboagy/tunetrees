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
    await ttPage.signInAnonymouslyToGenreSelection("E2E Genre Playlist");

    await expect(ttPage.onboardingGenreClearAllButton).toBeVisible({
      timeout: 15000,
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
    await ttPage.signInAnonymouslyToGenreSelection("E2E Catalog Playlist");

    await expect(ttPage.onboardingGenreClearAllButton).toBeVisible({
      timeout: 15000,
    });
    await ttPage.onboardingGenreClearAllButton.click();
    await ttPage.onboardingGenreCheckboxes.first().click();

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
