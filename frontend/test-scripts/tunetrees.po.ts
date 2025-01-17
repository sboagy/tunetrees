import type { Page } from "@playwright/test";
import { checkHealth } from "./check-servers";
import { initialPageLoadTimeout } from "./paths-for-tests";

export class TuneTreesPageObject {
  readonly page: Page;
  pageLocation = "https://localhost:3000";
  initialPageLoadTimeout = 50000;
  readonly currentTuneTitle;
  readonly repertoireTabTrigger;
  readonly filterInput;
  readonly repertoireTab;
  readonly repertoireTunesHeader;
  readonly addToReviewButton;
  readonly submitPracticedTunesButton;
  readonly mainTabGroup;
  readonly practiceTabTrigger;
  readonly practiceTab;

  constructor(page: Page) {
    this.page = page;
    page.on("pageerror", (exception) => {
      console.error(`Uncaught exception: "${exception}"`);
      throw exception;
    });

    // ==== initialize locators ====
    this.currentTuneTitle = page.getByTestId("current-tune-title");
    this.repertoireTabTrigger = page.getByRole("tab", { name: "Repertoire" });
    this.filterInput = page.getByPlaceholder("Filter");

    this.repertoireTab = page.getByTestId("tt-repertoire-tab");

    this.repertoireTunesHeader = page.locator(
      "#tt-repertoire-tunes-header div",
    );

    this.addToReviewButton = this.repertoireTunesHeader.filter({
      hasText: "Add To Review",
    });

    this.mainTabGroup = this.page.getByTestId("tt-main-tabs");

    this.repertoireTabTrigger = this.page.getByRole("tab", {
      name: "Repertoire",
    });

    this.practiceTabTrigger = page.getByRole("tab", { name: "Practice" });
    this.practiceTab = page.getByTestId("tt-practice-tab");

    this.submitPracticedTunesButton = page
      .locator("#tt-scheduled-tunes-header div")
      .filter({
        hasText: "Submit Practiced Tunes",
      });
  }

  async gotoMainPage() {
    await checkHealth();

    await this.page.goto(this.pageLocation, {
      timeout: initialPageLoadTimeout,
      waitUntil: "networkidle",
    });
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForSelector("body");
  }

  async navigateToTune(tuneTitle: string) {
    await this.gotoMainPage();

    await this.mainTabGroup.waitFor({ state: "visible" });

    await this.repertoireTabTrigger.waitFor({
      state: "visible",
    });
    await this.repertoireTabTrigger.click();
    await this.filterInput.click();

    await this.filterInput.fill(tuneTitle);
    await this.page.getByRole("row", { name: tuneTitle }).click();
  }

  async navigateToRepertoireTab() {
    await this.gotoMainPage();

    await this.mainTabGroup.waitFor({ state: "visible" });
    await this.repertoireTab.waitFor({ state: "visible" });

    await this.currentTuneTitle.waitFor({ state: "visible" });

    await this.repertoireTabTrigger.waitFor({
      state: "attached",
      timeout: 5000,
    });
    await this.repertoireTabTrigger.waitFor({
      state: "visible",
      timeout: 5000,
    });

    const isEnabled = await this.repertoireTabTrigger.isEnabled();
    console.log("===> test-practice-1.ts:52 ~ isEnabled", isEnabled);
    await this.repertoireTabTrigger.click({ trial: true, timeout: 60000 });
    await this.repertoireTabTrigger.click({ timeout: 60000 });

    // Make sure the "Add To Review" button is visible
    await this.addToReviewButton.waitFor({ state: "visible" });
  }

  async navigateToPracticeTab() {
    await this.gotoMainPage();

    await this.mainTabGroup.waitFor({ state: "visible" });
    await this.repertoireTab.waitFor({ state: "visible" });

    await this.addToReviewButton.waitFor({ state: "visible", timeout: 60000 });

    await this.currentTuneTitle.waitFor({ state: "visible" });

    await this.practiceTabTrigger.waitFor({ state: "attached", timeout: 5000 });
    await this.practiceTabTrigger.waitFor({ state: "visible", timeout: 5000 });

    const isEnabled = await this.practiceTabTrigger.isEnabled();
    console.log("===> test-practice-1.ts:52 ~ isEnabled", isEnabled);
    await this.practiceTabTrigger.click({ trial: true, timeout: 60000 });

    const responsePromise = this.page.waitForResponse(
      "https://localhost:3000/home",
    );
    await this.practiceTabTrigger.click({ timeout: 60000 });
    await responsePromise;

    await this.practiceTab.waitFor({ state: "attached", timeout: 60000 });
    await this.practiceTab.waitFor({ state: "visible", timeout: 60000 });
    await this.practiceTab.isEnabled();

    await this.submitPracticedTunesButton.isVisible({ timeout: 60000 });

    // Hmmm, not sure what this is/was for.
    // const ttPracticeTab2 = page
    //   .getByTestId("tt-practice-tab")
    //   .locator("div")
    //   .filter({
    //     hasText: "IdEvaluation",
    //   })
    //   .nth(2);
    // await expect(ttPracticeTab2).toBeVisible({ timeout: 60000 });
  }
}
