import { type Page, expect } from "@playwright/test";
import { checkHealth } from "./check-servers";
import { initialPageLoadTimeout } from "./paths-for-tests";

export async function navigateToPracticeTab(page: Page) {
  await checkHealth();

  console.log("===> test-edit-1.ts:88 ~ creating new page for tunetrees");

  await page.goto("https://localhost:3000/home", {
    timeout: initialPageLoadTimeout,
    waitUntil: "networkidle",
  });
  await page.waitForLoadState("domcontentloaded");

  await page.waitForSelector("body");
  const ttMainTabGroup = page.getByTestId("tt-main-tabs");
  await ttMainTabGroup.waitFor({ state: "visible" });
  const ttRepertoireTab = page.getByTestId("tt-repertoire-tab");
  await ttRepertoireTab.waitFor({ state: "visible" });

  const addToReviewButton = page.getByRole("button", { name: "Add To Review" });
  await expect(addToReviewButton).toBeVisible({ timeout: 60000 });

  await page.waitForSelector("#current-tune-title", {
    state: "visible",
    timeout: 60000,
  });

  const practiceTabLocator = page.getByRole("tab", { name: "Practice" });
  await practiceTabLocator.waitFor({ state: "attached", timeout: 5000 });
  await practiceTabLocator.waitFor({ state: "visible", timeout: 5000 });
  await expect(practiceTabLocator).toBeAttached();
  await expect(practiceTabLocator).toBeVisible();
  await expect(practiceTabLocator).toBeEnabled();
  const isEnabled = await practiceTabLocator.isEnabled();
  console.log("===> test-practice-1.ts:52 ~ isEnabled", isEnabled);
  await practiceTabLocator.click({ trial: true, timeout: 60000 });
  const responsePromise = page.waitForResponse("https://localhost:3000/home");
  await practiceTabLocator.click({ timeout: 60000 });
  await responsePromise;

  const ttPracticeTab = page.getByTestId("tt-practice-tab");
  await expect(ttPracticeTab).toBeAttached({ timeout: 60000 });
  await expect(ttPracticeTab).toBeVisible({ timeout: 60000 });
  await expect(ttPracticeTab).toBeEnabled({ timeout: 60000 });

  // const responsePromise = page.waitForResponse("https://localhost:3000/home");
  // await ttPracticeTab.click();
  // await responsePromise;

  const submitPracticedTunesButton = page
    .locator("#tt-scheduled-tunes-header div")
    .filter({
      hasText: "Submit Practiced Tunes",
    });
  await expect(submitPracticedTunesButton).toBeVisible({ timeout: 60000 });

  const ttPracticeTab2 = page
    .getByTestId("tt-practice-tab")
    .locator("div")
    .filter({
      hasText: "IdEvaluation",
    })
    .nth(2);
  await expect(ttPracticeTab2).toBeVisible({ timeout: 60000 });

  // const ttScheduledTunesGrid = page
  //   .getByTestId("tt-practice-tab")
  //   .getByRole("table");
  // await ttScheduledTunesGrid.waitFor({ state: "attached", timeout: 500000 });
  // const ttScheduledTunesGrid = page.getByTestId("tt-scheduled-tunes-grid");
  // await expect(ttScheduledTunesGrid).toBeAttached({ timeout: 5000 });
  // await expect(ttScheduledTunesGrid).toBeVisible({ timeout: 5000 });
  // await expect(ttScheduledTunesGrid).toBeEnabled({ timeout: 5000 });

  const ttReviewSitdownDate = process.env.TT_REVIEW_SITDOWN_DATE;
  console.log(
    `===> test-practice-1.ts:106 ~ check practice tunes for ${ttReviewSitdownDate}`,
  );
}

export async function navigateToRepertoireTab(page: Page) {
  await checkHealth();

  console.log("===> test-edit-1.ts:88 ~ creating new page for tunetrees");

  await page.goto("https://localhost:3000/home", {
    timeout: initialPageLoadTimeout,
    waitUntil: "networkidle",
  });
  await page.waitForLoadState("domcontentloaded");

  await page.waitForSelector("body");
  const ttMainTabGroup = page.getByTestId("tt-main-tabs");
  await ttMainTabGroup.waitFor({ state: "visible" });
  const ttRepertoireTab = page.getByTestId("tt-repertoire-tab");
  await ttRepertoireTab.waitFor({ state: "visible" });

  const addToReviewButton = page.getByRole("button", { name: "Add To Review" });
  await expect(addToReviewButton).toBeVisible({ timeout: 60000 });

  await page.waitForSelector("#current-tune-title", {
    state: "visible",
    timeout: 60000,
  });

  const repertoireTabLocator = page.getByRole("tab", { name: "Repertoire" });
  await repertoireTabLocator.waitFor({ state: "attached", timeout: 5000 });
  await repertoireTabLocator.waitFor({ state: "visible", timeout: 5000 });
  await expect(repertoireTabLocator).toBeAttached();
  await expect(repertoireTabLocator).toBeVisible();
  await expect(repertoireTabLocator).toBeEnabled();
  const isEnabled = await repertoireTabLocator.isEnabled();
  console.log("===> test-practice-1.ts:52 ~ isEnabled", isEnabled);
  await repertoireTabLocator.click({ trial: true, timeout: 60000 });
  await repertoireTabLocator.click({ timeout: 60000 });
  // const responsePromise = page.waitForResponse("https://localhost:3000/home");
  // await repertoireTabLocator.click({ timeout: 60000 });
  // await responsePromise;

  const ttrepertoireTab = page.getByTestId("tt-repertoire-tab");
  await expect(ttrepertoireTab).toBeAttached({ timeout: 60000 });
  await expect(ttrepertoireTab).toBeVisible({ timeout: 60000 });
  await expect(ttrepertoireTab).toBeEnabled({ timeout: 60000 });

  // const responsePromise = page.waitForResponse("https://localhost:3000/home");
  // await ttrepertoireTab.click();
  // await responsePromise;

  const submitPracticedTunesButton = page
    .locator("#tt-repertoire-tunes-header div")
    .filter({
      hasText: "Add To Review",
    });
  await expect(submitPracticedTunesButton).toBeVisible({ timeout: 60000 });
}
