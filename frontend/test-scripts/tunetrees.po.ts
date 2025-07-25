import { type Locator, type Page, expect } from "@playwright/test";
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

  readonly idColumnHeader;
  readonly idColumnHeaderSortButton;
  readonly scheduledColumnHeader;
  readonly scheduledColumnHeaderSortButton;
  readonly typeColumnHeader;
  readonly typeColumnHeaderSortButton;
  readonly titleColumnHeader;
  readonly titleColumnHeaderSortButton;

  readonly selectSettingButton;

  readonly tuneEditorSubmitButton;
  readonly tuneEditorCancelButton;

  readonly tabsMenuButton;
  readonly tabsMenuCatalogChoice;
  readonly catalogTab;
  readonly tableStatus;
  readonly toast;

  // Password Reset locators
  readonly passwordResetPasswordInput: Locator;
  readonly passwordResetConfirmInput: Locator;
  readonly passwordResetSubmitButton: Locator;
  readonly passwordResetPasswordToggle: Locator;
  readonly passwordResetConfirmToggle: Locator;
  readonly passwordStrengthIndicator: Locator;
  readonly passwordStrengthLevel: Locator;
  readonly passwordRequirements: Locator;

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

    this.idColumnHeader = page
      .getByRole("cell", { name: "Id", exact: true })
      .locator("div");
    this.idColumnHeaderSortButton = page
      .getByRole("cell", { name: "Id", exact: true })
      .getByRole("button");
    this.scheduledColumnHeader = page
      .getByRole("cell", { name: "Scheduled", exact: true })
      .locator("div");
    this.scheduledColumnHeaderSortButton = page
      .getByRole("cell", { name: "Scheduled", exact: true })
      .getByRole("button");
    this.typeColumnHeader = page
      .getByRole("cell", { name: "Type", exact: true })
      .locator("div");
    this.typeColumnHeaderSortButton = page
      .getByRole("cell", { name: "Type", exact: true })
      .getByRole("button");
    this.titleColumnHeader = page
      .getByRole("cell", { name: "Title", exact: true })
      .locator("div");
    this.titleColumnHeaderSortButton = page
      .getByRole("cell", { name: "Title", exact: true })
      .getByRole("button");

    this.selectSettingButton = page.getByTestId("tt-select-setting");

    this.tuneEditorSubmitButton = page.getByTestId(
      "tt-tune-editor-submit-button",
    );
    this.tuneEditorCancelButton = page.getByTestId(
      "tt-tune-editor-cancel-button",
    );

    this.tableStatus = this.page.getByText(" row(s) selected.");
    this.toast = this.page.getByTestId("shadcn-toast");

    // Password Reset locators
    this.passwordResetPasswordInput = page.getByTestId(
      "password-reset-password-input",
    );
    this.passwordResetConfirmInput = page.getByTestId(
      "password-reset-confirm-input",
    );
    this.passwordResetSubmitButton = page.getByTestId(
      "password-reset-submit-button",
    );
    this.passwordResetPasswordToggle = page.getByTestId(
      "password-reset-password-toggle",
    );
    this.passwordResetConfirmToggle = page.getByTestId(
      "password-reset-confirm-toggle",
    );
    this.passwordStrengthIndicator = page.getByTestId(
      "password-strength-indicator",
    );
    this.passwordStrengthLevel = page.getByTestId("password-strength-level");
    this.passwordRequirements = page.getByTestId("password-requirements");
  }

  onError = (exception: Error): void => {
    console.error(`Uncaught exception: "${exception.message}"`);
    throw exception;
  };

  async gotoMainPage() {
    await checkHealth();

    await this.page.goto(this.pageLocation, {
      timeout: initialPageLoadTimeout,
      waitUntil: "domcontentloaded", // More reliable than networkidle in CI
    });
    this.page.on("pageerror", this.onError);
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForSelector("body");

    const pageContent = await this.page.content();
    console.log("Page content after goto:", pageContent.slice(0, 500)); // Log first 500 chars for inspection

    await this.tableStatus.waitFor({ state: "visible", timeout: 25_000 });

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

    const maxIterations = 14; // 14 seconds max wait time
    while (rowCount < 2 && iterations < maxIterations) {
      await this.page.waitForTimeout(1000); // wait for 1 second before checking again
      rowCount = await this.tunesGridRows.count();
      iterations++;
    }

    if (iterations >= maxIterations) {
      console.warn(`
    waitForTablePopulationToStart(): Table population check exceeded ${maxIterations} iterations.
    Actual iterations: ${iterations}
    Row count: ${rowCount}.
    `);
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

    await this.page.waitForTimeout(1000);
    await this.filterInput.fill(tuneTitle, { timeout: 90_000 });

    // An exception to the rule that we should not use expect() in PageObjects.
    await expect(this.tunesGridRows).toHaveCount(2, { timeout: 60_000 });

    const tuneRow = this.page.getByRole("row").nth(1);
    await tuneRow.click();
    // await this.page.getByRole("row", { name: tuneTitle }).click();
  }

  async navigateToRepertoireTab(pauseSecondsAfter = 2) {
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
    await this.page.waitForTimeout(pauseSecondsAfter * 1000);
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

  async navigateToIrishTenorBanjoInstrument(
    shouldExpectZeroTable = true,
  ): Promise<void> {
    // Switch from default Irish Flute to Irish Tenor Banjo
    const instrumentSelector1 = this.page
      .getByRole("button", { name: "Instrument: Irish Flute (id-1)" })
      .first();

    // Wait for the button to be visible and enabled
    await instrumentSelector1.waitFor({ state: "visible", timeout: 30000 });
    await instrumentSelector1.waitFor({ state: "attached", timeout: 30000 });
    await expect(instrumentSelector1).toBeEnabled({ timeout: 30000 });

    // Click to open the dropdown
    await instrumentSelector1.click();

    // Wait for the dropdown menu to be visible
    const dropdownMenu = this.page.locator('[role="menu"]').first();
    await dropdownMenu.waitFor({ state: "visible", timeout: 10000 });

    // Wait for the specific Irish Tenor Banjo option to be visible and clickable
    const tenorBanjoOption = this.page.getByText("Irish Tenor Banjo (id-18)");
    await tenorBanjoOption.waitFor({ state: "visible", timeout: 10000 });
    await tenorBanjoOption.waitFor({ state: "attached", timeout: 10000 });

    // Add a small delay to ensure the dropdown is fully rendered
    await this.page.waitForTimeout(500);

    // Click the Irish Tenor Banjo option
    await tenorBanjoOption.click();

    // Wait for the dropdown to close
    await dropdownMenu.waitFor({ state: "detached", timeout: 10000 });

    // Verify the instrument has been switched - wait longer for the UI to update
    const instrumentSelector2 = this.page
      .getByRole("button", { name: "Instrument: Irish Tenor Banjo (id-18)" })
      .first();
    await instrumentSelector2.waitFor({ state: "visible", timeout: 30000 });

    // Wait for any network requests to complete
    await this.page.waitForTimeout(1000);

    // Conditionally check that the table shows zero entries
    if (shouldExpectZeroTable) {
      await expect(this.tableStatus).toContainText(
        "0 of 0 row(s) selected., lapsed: 0, current: 0, future: 0, new: 0",
        { timeout: 30000 },
      );
    }
  }

  async clickWithTimeAfter(locator: Locator, timeout = 9000) {
    await locator.waitFor({ state: "attached", timeout: timeout });
    await locator.waitFor({ state: "visible", timeout: timeout });
    await expect(locator).toBeAttached({ timeout: timeout });
    await expect(locator).toBeVisible({ timeout: timeout });
    await expect(locator).toBeEnabled({ timeout: timeout });
    // await locator.click({ trial: true });
    await locator.click({ timeout: timeout });
  }

  async setReviewEval(tuneId: number, evalType: string) {
    const qualityButton = this.page
      .getByRole("row", { name: `${tuneId} ` })
      .getByTestId("tt-recal-eval-popover-trigger");
    await expect(qualityButton).toBeVisible({ timeout: 60000 });
    await expect(qualityButton).toBeEnabled({ timeout: 60000 });
    await this.clickWithTimeAfter(qualityButton);
    await this.page
      .getByTestId("tt-recal-eval-group-menu")
      .waitFor({ state: "visible", timeout: 60000 });
    const responseRecalledButton = this.page.getByTestId(
      `tt-recal-eval-${evalType}`,
    );
    await expect(responseRecalledButton).toBeVisible({ timeout: 60000 });
    await expect(responseRecalledButton).toBeEnabled({ timeout: 60000 });
    await this.clickWithTimeAfter(responseRecalledButton);
    await this.page
      .getByTestId("tt-recal-eval-popover-content")
      .waitFor({ state: "detached", timeout: 60000 });
  }

  async runLogin(
    user: string | undefined,
    pw: string | undefined,
  ): Promise<void> {
    if (
      !process.env.TEST1_LOGIN_USER_EMAIL ||
      !process.env.TEST1_LOGIN_USER_PASSWORD
    ) {
      console.log("===> run-login2.ts:20 ~ ", "No login credentials found");
      throw new Error("No login credentials found");
    }

    const topSignInButton = this.page.getByRole("button", { name: "Sign in" });
    await topSignInButton.waitFor({ state: "visible" });
    await topSignInButton.click();

    // Wait for the login dialog to appear
    const userEmailLocator = this.page.getByTestId("user_email");
    await userEmailLocator.waitFor({ state: "visible", timeout: 10000 });
    await userEmailLocator.fill(user || "");
    await userEmailLocator.press("Tab");
    const passwordEntryBox = this.page.getByTestId("user_password");
    await passwordEntryBox.fill(pw || "");
    const dialogSignInButton = this.page.getByRole("button", {
      name: "Sign In",
      exact: true,
    });
    await passwordEntryBox.press("Tab");

    await this.page.waitForFunction(
      (button) => {
        const btn = button as HTMLButtonElement;
        return !btn.disabled;
      },
      await dialogSignInButton.elementHandle(),
      { timeout: 2000 },
    );

    await dialogSignInButton.click();

    // Not sure why the following doesn't work.
    // await this.addToRepertoireButton.waitFor({
    //   state: "visible",
    //   timeout: 30_000,
    // });
    //
    // instead, we'll wait for the tableStatus to be visible.
    await this.tableStatus.waitFor({ state: "visible", timeout: 20_000 });

    console.log("===> run-login2.ts:50 ~ ", "Login completed");
  }

  async waitForSuccessfullySubmitted(): Promise<void> {
    await expect(this.toast.last()).toContainText(
      "Practice successfully submitted",
      { timeout: 60000 },
    );
  }

  async navigateToCatalogTab(): Promise<void> {
    // Open the tabs menu to access Catalog
    await this.tabsMenuButton.click();
    await this.tabsMenuCatalogChoice.click();

    await expect(this.catalogTab).toBeVisible();
    await this.catalogTab.click();

    // Verify we can see the Add To Repertoire button
    await expect(this.addToRepertoireButton).toBeVisible();
    await expect(this.addToRepertoireButton).toBeEnabled();

    await this.page.waitForTimeout(2000);
  }

  async addTuneToSelection(tune_id: string): Promise<void> {
    await this.page.evaluate((tuneId: number) => {
      window.scrollToTuneById?.(tuneId);
    }, Number(tune_id));

    await this.page.waitForTimeout(1000);

    const tuneCheckbox = this.page
      .getByTestId(`${tune_id}_select`)
      .getByTestId("tt-row-checkbox");

    await expect(tuneCheckbox).toBeVisible();
    await expect(tuneCheckbox).toBeEnabled();
    await tuneCheckbox.check();
    await expect(tuneCheckbox).toBeChecked();
  }

  async scrollToTuneById(tuneId: number): Promise<void> {
    await this.page.evaluate((id: number) => {
      if (window.scrollToTuneById) {
        window.scrollToTuneById(id);
      } else {
        console.warn(`scrollToTuneById function not defined for tune ID ${id}`);
      }
    }, tuneId);
    await this.page.waitForTimeout(500); // Allow time for scrolling
  }

  async expectTuneInTableAndClick(
    tune_id: number,
    tune_name: string,
  ): Promise<void> {
    await this.scrollToTuneById(tune_id);

    const tuneRow = this.page
      .getByRole("row")
      .filter({ hasText: String(tune_id) })
      .filter({ hasText: tune_name });

    await expect(tuneRow).toBeVisible({ timeout: 10000 });

    await tuneRow.click();
  }

  async expectTuneUnselected(tune_id: string): Promise<void> {
    const tuneCheckbox = this.page
      .getByTestId(`${tune_id}_select`)
      .getByTestId("tt-row-checkbox");

    await expect(tuneCheckbox).toBeVisible();
    await expect(tuneCheckbox).toBeEnabled();

    // Add debugging to see the actual state
    const isChecked = await tuneCheckbox.isChecked();
    console.log(`Tune ${tune_id} checkbox state: ${isChecked}`);

    // Wait a bit for potential state changes
    await this.page.waitForTimeout(200);

    // Check state again after waiting
    const isCheckedAfter = await tuneCheckbox.isChecked();
    console.log(`Tune ${tune_id} checkbox state after wait: ${isCheckedAfter}`);

    await expect(tuneCheckbox).not.toBeChecked({ timeout: 100 });
  }

  setupConsoleErrorHandling(): void {
    // Set up error handling for console errors
    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("Browser console error:", msg.text());
      }
    });
  }

  setupNetworkFailureHandling(): void {
    // Listen for network failures
    this.page.on("requestfailed", (request) => {
      console.log(
        "Network request failed:",
        request.url(),
        request.failure()?.errorText,
      );
    });
  }
}

export interface INavigateToPracticeTabStandaloneParams {
  page: Page;
  practiceTabTrigger: Locator;
}

export async function navigateToPracticeTabStandalone(
  page: Page,
): Promise<void> {
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.navigateToPracticeTab();
}

export async function navigateToRepertoireTabStandalone(page: Page) {
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.navigateToRepertoireTab();
}
