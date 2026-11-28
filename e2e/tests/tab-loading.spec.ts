import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test("failed tab download keeps navigation usable and recovers on reload", async ({
  page,
  testUser,
}) => {
  const ttPage = new TuneTreesPage(page);
  await setupDeterministicTestParallel(page, testUser, {
    clearRepertoire: false,
    seedRepertoire: [],
  });

  // This suite runs against Vite dev. Fail only the tab module download,
  // leaving authentication, local data and sync requests untouched.
  const tabModule = "**/src/routes/analysis.tsx*";
  await page.route(tabModule, (route) => route.abort("failed"));
  await ttPage.navigateToTab("analysis", { waitForContent: false });
  await expect(page.getByTestId("tab-load-error")).toBeVisible({
    timeout: 15000,
  });

  await ttPage.navigateToTab("practice");
  await expect(ttPage.practiceColumnsButton).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("tab-load-error")).toHaveCount(0);

  await ttPage.navigateToTab("analysis", { waitForContent: false });
  await expect(page.getByTestId("tab-load-error")).toBeVisible({
    timeout: 15000,
  });
  await page.unroute(tabModule);
  await page.getByRole("button", { name: "Reload Page", exact: true }).click();
  await expect(page.getByTestId("analysis-page")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByTestId("tab-load-error")).toHaveCount(0);
});
