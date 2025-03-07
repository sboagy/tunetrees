import { type Page, expect } from "@playwright/test";
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
  readonly rowLocator;
  readonly tunesGrid;
  readonly tunesGridRows;
  readonly addToRepertoireButton;
  readonly newTuneButton;
  readonly addTuneButton;
  readonly addtuneUrlOrTitleInput;
  readonly addtuneButtonNew;
  readonly addtuneButtonImport;

  readonly selectSettingButton;

  readonly tuneEditorSubmitButton;
  readonly tuneEditorCancelButton;

  readonly tabsMenuButton;
  readonly tabsMenuCatalogChoice;
  readonly catalogTab;
  readonly tableStatus;

  constructor(page: Page) {
    this.page = page;

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
    this.rowLocator = page.getByRole("row");

    this.tunesGrid = page.getByTestId("tunes-grid");
    this.tunesGridRows = this.tunesGrid.locator("tr");

    this.tabsMenuButton = page.getByRole("button", { name: "Tabs" });
    this.tabsMenuCatalogChoice = page.getByRole("menuitemcheckbox", {
      name: "Catalog",
    });

    this.catalogTab = page.getByRole("tab", { name: "Catalog" });

    this.addToRepertoireButton = page
      .locator("#tt-all-tunes-header div")
      .filter({ hasText: "Add To Repertoire" });

    this.newTuneButton = page.getByTestId("tt-new-tune-button");

    this.addTuneButton = page
      // .getByTestId("tt-catalog-tab")
      .getByTestId("tt-import-button");

    this.addtuneUrlOrTitleInput = page.getByTestId(
      "addtune-url-or-title-input",
    );

    this.addtuneButtonNew = page.getByTestId("addtune-button-new");
    this.addtuneButtonImport = page.getByTestId("addtune-button-import");

    this.selectSettingButton = page.getByTestId("tt-select-setting");

    this.tuneEditorSubmitButton = page.getByTestId(
      "tt-tune-editor-submit-button",
    );
    this.tuneEditorCancelButton = page.getByTestId(
      "tt-tune-editor-cancel-button",
    );

    this.tableStatus = this.page.getByText(" row(s) selected.");
  }

  onError = (exception: Error): void => {
    console.error(`Uncaught exception: "${exception.message}"`);
    throw exception;
  };

  async gotoMainPage() {
    await checkHealth();

    await this.page.goto(this.pageLocation, {
      timeout: initialPageLoadTimeout,
      waitUntil: "networkidle",
    });
    this.page.on("pageerror", this.onError);
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForSelector("body");
    await this.tableStatus.waitFor({ state: "visible", timeout: 20_0000 });

    // await expect(this.tableStatus).toHaveText("1 of 488 row(s) selected.", {
    //   timeout: 60000,
    // });
    const tableStatusText = (await this.tableStatus.textContent()) as string;
    console.log(
      "===> tunetrees.po.ts:99 ~ done with gotoMainPage: ",
      tableStatusText,
    );
    await this.waitForTablePopulationToStart();
  }

  async waitForTablePopulationToStart() {
    await this.page.waitForSelector("body");
    await expect(this.tableStatus).toBeVisible();
    let rowCount = await this.tunesGridRows.count();
    let iterations = 0;

    while (rowCount < 2 && iterations < 12) {
      await this.page.waitForTimeout(1000); // wait for 1 second before checking again
      rowCount = await this.tunesGridRows.count();
      iterations++;
    }

    if (iterations >= 12) {
      console.warn("Table population check exceeded 12 iterations.");
    }
  }

  async navigateToTune(tuneTitle: string) {
    await this.mainTabGroup.waitFor({ state: "visible" });

    await this.repertoireTabTrigger.waitFor({
      state: "visible",
    });
    await this.repertoireTabTrigger.click();

    await this.filterInput.waitFor({ state: "visible" });
    await this.filterInput.waitFor({ state: "attached" });
    await this.filterInput.click();

    await this.filterInput.fill(tuneTitle, { timeout: 90_000 });

    // An exception to the rule that we should not use expect() in PageObjects.
    await expect(this.tunesGridRows).toHaveCount(2, { timeout: 60_000 });

    const tuneRow = this.page.getByRole("row").nth(1);
    await tuneRow.click();
    // await this.page.getByRole("row", { name: tuneTitle }).click();
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
    await this.waitForTablePopulationToStart();
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

    await this.waitForTablePopulationToStart();

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
