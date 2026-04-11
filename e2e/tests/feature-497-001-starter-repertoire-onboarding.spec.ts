/**
 * FEATURE-497 (P1): Starter repertoire onboarding
 *
 * These tests intentionally assert stable flow invariants rather than exact
 * tune counts or specific tune titles so the starter template contents can
 * evolve without causing broad E2E churn.
 */

import { test as base, expect, type Page } from "@playwright/test";
import {
  STARTER_TEMPLATES,
  type StarterRepertoireTemplate,
} from "../../src/lib/db/starter-repertoire-templates";
import { waitForPracticeViewSettled } from "../helpers/practice-view";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

const test = base.extend({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture pattern requires empty object
  storageState: async ({}, use) => {
    await use({ cookies: [], origins: [] });
  },
});

const primaryStarterTemplate = STARTER_TEMPLATES[0];

if (!primaryStarterTemplate) {
  throw new Error(
    "FEATURE-497 E2E tests require at least one starter template"
  );
}

async function expectStarterEmptyState(ttPage: TuneTreesPage) {
  await expect(ttPage.onboardingWelcomeHeading).toBeVisible({ timeout: 15000 });
  await expect(ttPage.onboardingCreateRepertoireButton).toBeVisible({
    timeout: 10000,
  });

  for (const template of STARTER_TEMPLATES) {
    await expect(ttPage.getOnboardingStarterCard(template.id)).toBeVisible({
      timeout: 10000,
    });
  }
}

async function signInAnonymouslyToEmptyState(
  ttPage: TuneTreesPage,
  tab: "practice" | "repertoire"
) {
  await ttPage.gotoLogin();
  await ttPage.signInAnonymously();
  await ttPage.navigateToTab(tab, { waitForContent: false });
  await expectStarterEmptyState(ttPage);
}

async function completeStarterOnboardingFlow(
  page: Page,
  ttPage: TuneTreesPage
) {
  await expect(ttPage.onboardingGenreContinueButton).toBeEnabled({
    timeout: 10000,
  });
  await ttPage.onboardingGenreContinueButton.click();
  await expect(ttPage.onboardingChooseGenresHeading).toBeHidden({
    timeout: 30000,
  });

  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {
    return undefined;
  });
  await page.waitForTimeout(500);

  const step3Heading = page.getByRole("heading", { name: /add some tunes/i });
  if (await step3Heading.isVisible().catch(() => false)) {
    const gotItButton = page.getByRole("button", { name: /got it!/i });
    const skipTourButton = page.getByRole("button", { name: /skip tour/i });

    if (await gotItButton.isVisible().catch(() => false)) {
      await gotItButton.click({ timeout: 5000 });
    } else if (await skipTourButton.isVisible().catch(() => false)) {
      await skipTourButton.click({ timeout: 5000 });
    }

    await step3Heading
      .waitFor({ state: "hidden", timeout: 15000 })
      .catch(() => {
        return undefined;
      });
  }

  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {
    return undefined;
  });
}

async function assertStarterPopulatesRepertoireAndPractice(
  page: Page,
  ttPage: TuneTreesPage,
  template: StarterRepertoireTemplate
) {
  await expect(ttPage.repertoireDropdownButton).toContainText(template.name, {
    timeout: 60000,
  });

  await ttPage.navigateToTab("repertoire", { waitForContent: false });
  await ttPage.expectGridHasContent(ttPage.repertoireGrid);

  const repertoireRowCount = await ttPage.getRows("repertoire").count();
  expect(repertoireRowCount).toBeGreaterThan(0);

  await ttPage.navigateToTab("practice", { waitForContent: false });
  const practiceRowCount = await waitForPracticeViewSettled(page, ttPage, {
    expectRows: true,
    timeoutMs: 60000,
  });
  expect(practiceRowCount).toBeGreaterThan(0);
}

test.describe("FEATURE-497: Starter repertoire onboarding", () => {
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page }) => {
    ttPage = new TuneTreesPage(page);
  });

  test("shows starter choices on empty Practice and Repertoire tabs", async () => {
    await signInAnonymouslyToEmptyState(ttPage, "practice");
    await expect(ttPage.repertoireDropdownButton).toContainText(
      "No Repertoire"
    );

    await ttPage.navigateToTab("repertoire", { waitForContent: false });
    await expectStarterEmptyState(ttPage);
  });

  test("canceling starter setup returns to the empty state without creating a repertoire", async () => {
    await signInAnonymouslyToEmptyState(ttPage, "repertoire");

    await ttPage.chooseStarterTemplate(primaryStarterTemplate.id);
    await expect(ttPage.onboardingGenreContinueButton).toBeEnabled({
      timeout: 10000,
    });

    await ttPage.onboardingGenreCancelButton.click();
    await expect(ttPage.onboardingChooseGenresHeading).toBeHidden({
      timeout: 15000,
    });

    await expectStarterEmptyState(ttPage);
    await expect(ttPage.repertoireDropdownButton).toContainText(
      "No Repertoire"
    );
  });

  test("creating a starter from the Practice empty state yields practice rows", async ({
    page,
  }) => {
    test.slow();

    await signInAnonymouslyToEmptyState(ttPage, "practice");
    await ttPage.chooseStarterTemplate(primaryStarterTemplate.id);
    await completeStarterOnboardingFlow(page, ttPage);
    await assertStarterPopulatesRepertoireAndPractice(
      page,
      ttPage,
      primaryStarterTemplate
    );
  });

  for (const template of STARTER_TEMPLATES) {
    test(`creates ${template.id} and populates both Repertoire and Practice`, async ({
      page,
    }) => {
      test.slow();

      await signInAnonymouslyToEmptyState(ttPage, "repertoire");
      await ttPage.chooseStarterTemplate(template.id);
      await completeStarterOnboardingFlow(page, ttPage);
      await assertStarterPopulatesRepertoireAndPractice(page, ttPage, template);
    });
  }
});
