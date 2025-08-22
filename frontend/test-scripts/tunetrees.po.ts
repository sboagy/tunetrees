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
  readonly LatestReviewColumnHeader;
  readonly LatestReviewColumnHeaderSortButton;
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
  // Spaced Repetition settings locators
  readonly spacedRepUpdateButton: Locator;
  readonly optimizeParamsInlineButton: Locator;
  readonly optimizeParamsMainButton: Locator;

  // Password Reset locators
  readonly passwordResetPasswordInput: Locator;
  readonly passwordResetConfirmInput: Locator;
  readonly passwordResetSubmitButton: Locator;
  readonly passwordResetPasswordToggle: Locator;
  readonly passwordResetConfirmToggle: Locator;
  readonly passwordStrengthIndicator: Locator;
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

    // Prefer robust header targeting by anchoring to sort-button testids
    this.idColumnHeaderSortButton = page.getByTestId("col-id-sort-button");
    this.idColumnHeader = page
      .getByRole("columnheader")
      .filter({ has: this.idColumnHeaderSortButton });

    this.scheduledColumnHeaderSortButton = page.getByTestId(
      "col-scheduled-sort-button",
    );
    this.scheduledColumnHeader = page
      .getByRole("columnheader")
      .filter({ has: this.scheduledColumnHeaderSortButton });

    this.LatestReviewColumnHeaderSortButton = page.getByTestId(
      "col-latest_review_date-sort-button",
    );
    this.LatestReviewColumnHeader = page
      .getByRole("columnheader")
      .filter({ has: this.LatestReviewColumnHeaderSortButton });
    this.typeColumnHeaderSortButton = page.getByTestId("col-type-sort-button");
    this.typeColumnHeader = page
      .getByRole("columnheader")
      .filter({ has: this.typeColumnHeaderSortButton });
    this.titleColumnHeaderSortButton = page.getByTestId(
      "col-title-sort-button",
    );
    this.titleColumnHeader = page
      .getByRole("columnheader")
      .filter({ has: this.titleColumnHeaderSortButton });

    this.selectSettingButton = page.getByTestId("tt-select-setting");

    this.tuneEditorSubmitButton = page.getByTestId(
      "tt-tune-editor-submit-button",
    );
    this.tuneEditorCancelButton = page.getByTestId(
      "tt-tune-editor-cancel-button",
    );

    this.tableStatus = this.page.getByTestId("tt-table-status");
    this.toast = this.page.getByTestId("shadcn-toast");

    // Spaced Repetition locators
    this.spacedRepUpdateButton = page.getByTestId("spaced-rep-update-button");
    this.optimizeParamsInlineButton = page.getByTestId(
      "optimize-params-inline-button",
    );
    this.optimizeParamsMainButton = page.getByTestId(
      "optimize-params-main-button",
    );

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
    this.passwordRequirements = page.getByTestId("password-requirements");
  }

  onError = (exception: Error): void => {
    console.error(`Uncaught exception: "${exception.message}"`);
    throw exception;
  };

  async gotoMainPage(waitForTableStatus = true) {
    await checkHealth();

    // Set up error and network monitoring before navigation
    this.setupConsoleErrorHandling();
    this.setupNetworkFailureHandling();

    await this.page.goto(this.pageLocation, {
      timeout: initialPageLoadTimeout,
      waitUntil: "domcontentloaded", // More reliable than networkidle in CI
    });
    this.page.on("pageerror", this.onError);
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForSelector("body");

    // const pageContent = await this.page.content();
    // console.log("Page content after goto:", pageContent.slice(0, 500)); // Log first 500 chars for inspection
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(1000);
    if (waitForTableStatus) {
      const tableStatusTimeout = process.env.CI ? 120_000 : 25_000;
      await this.tableStatus.waitFor({
        state: "visible",
        timeout: tableStatusTimeout,
      });

      // await expect(this.tableStatus).toHaveText("1 of 488 row(s) selected.", {
      //   timeout: 60000,
      // });
      // const tableStatusText = (await this.tableStatus.textContent()) as string;
      // console.log(
      //   "===> tunetrees.po.ts:99 ~ done with gotoMainPage: ",
      //   tableStatusText,
      // );
      await this.waitForTablePopulationToStart();
      await this.page.waitForLoadState("domcontentloaded");
      await this.page.waitForTimeout(1000);
    }
  }

  async waitForTablePopulationToStart() {
    await this.page.waitForSelector("body");
    await expect(this.tableStatus).toBeVisible();
    let rowCount = await this.tunesGridRows.count();
    let iterations = 0;

    // Accept at least 1 populated data row to proceed; some practice scenarios start with a single row
    const maxIterations = 30; // up to ~30s (still under typical test timeout) giving slower CI more time
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
    await this.page.waitForTimeout(100);

    await this.filterInput.isVisible();
    await this.filterInput.isEnabled();
    await this.page.waitForTimeout(500);

    await this.filterInput.click();
    await this.page.waitForTimeout(500);

    await this.filterInput.fill(tuneTitle);

    // Wait until at least 1 data row present; prefer 2 (header + filtered result) but don't hard fail.
    let attempts = 0;
    let rowCount = await this.tunesGridRows.count();
    while (rowCount < 2 && attempts < 40) {
      // up to ~20s
      if (attempts > 1) {
        console.warn(
          `retrying for row count >= 2 (rowCount=${rowCount}). Attempt ${attempts}`,
        );
      }
      await this.page.waitForTimeout(1000);
      rowCount = await this.tunesGridRows.count();
      attempts++;
    }
    if (rowCount < 2) {
      console.warn(
        `navigateToTune(): expected filtered table row not loaded (rowCount=${rowCount}). Proceeding with best-effort click if available.`,
      );
    }
    if (rowCount >= 2) {
      const tuneRow = this.page.getByRole("row").nth(1);
      const firstCell = tuneRow.getByRole("cell").nth(1);
      await firstCell.click();
    } else {
      // Attempt to click any row containing the title
      const fallback = this.page.getByRole("row", { name: tuneTitle }).first();
      if (await fallback.isVisible()) {
        await fallback.click();
      } else {
        throw new Error(
          `navigateToTune(): Unable to locate tune row for title '${tuneTitle}'.`,
        );
      }
    }
    await this.page.waitForTimeout(100);
    // await this.page.getByRole("row", { name: tuneTitle }).click();
  }

  async navigateToRepertoireTab(pauseSecondsAfter = 2) {
    await this.gotoMainPage();

    await this.mainTabGroup.waitFor({ state: "visible" });
    // Click the Repertoire tab trigger first, then wait for the panel to be visible
    await this.repertoireTabTrigger.waitFor({
      state: "attached",
      timeout: 10000,
    });
    await this.repertoireTabTrigger.waitFor({
      state: "visible",
      timeout: 10000,
    });
    const isEnabled = await this.repertoireTabTrigger.isEnabled();
    console.log("===> navigateToRepertoireTab ~ trigger enabled:", isEnabled);
    await this.repertoireTabTrigger.click({ timeout: 60000 });

    await this.repertoireTab.waitFor({ state: "attached", timeout: 60000 });
    await this.repertoireTab.waitFor({ state: "visible", timeout: 60000 });

    // Make sure the "Add To Review" button is visible which indicates grid is rendered
    await this.addToReviewButton.waitFor({ state: "visible", timeout: 60000 });
    await this.waitForTablePopulationToStart();
    await this.page.waitForTimeout(pauseSecondsAfter * 1000);
  }

  async navigateToPracticeTab() {
    await this.gotoMainPage();
    await this.navigateToPracticeTabDirectly();
  }

  async navigateToPracticeTabDirectly() {
    await this.mainTabGroup.waitFor({ state: "visible" });

    await this.practiceTabTrigger.waitFor({
      state: "attached",
      timeout: 10000,
    });
    await this.practiceTabTrigger.waitFor({ state: "visible", timeout: 10000 });
    const isEnabled = await this.practiceTabTrigger.isEnabled();
    console.log("===> navigateToPracticeTab ~ trigger enabled:", isEnabled);

    await this.practiceTabTrigger.click({ timeout: 60000 });

    await this.practiceTab.waitFor({ state: "attached", timeout: 60000 });
    await this.practiceTab.waitFor({ state: "visible", timeout: 60000 });
    await this.practiceTab.isEnabled();

    await this.submitPracticedTunesButton.isVisible({ timeout: 60000 });

    await this.waitForTablePopulationToStart();

    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(1000);

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
    await this.page.waitForTimeout(500);

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
      await expect(this.tableStatus).toContainText("0 of 0 row(s) selected", {
        timeout: 30000,
      });
    }
  }

  async clickWithTimeAfter(
    locator: Locator,
    timeout = Number.NaN,
    timeAfter = 100,
  ) {
    if (Number.isNaN(timeout)) {
      await expect(locator).toBeAttached();
      await expect(locator).toBeVisible();
      await expect(locator).toBeEnabled();
      await locator.click();
    } else {
      await expect(locator).toBeAttached({ timeout: timeout });
      await expect(locator).toBeVisible({ timeout: timeout });
      await expect(locator).toBeEnabled({ timeout: timeout });
      await locator.click({ timeout: timeout });
    }
    await this.page.waitForTimeout(timeAfter); // Allow time for any post-click actions
  }

  // Ensures a locator is truly clickable: visible, attached, enabled, scrolled into view,
  // and passes a Playwright trial click probe before performing a real click elsewhere.
  async ensureClickable(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: "visible", timeout });
    await locator.waitFor({ state: "attached", timeout });
    await expect(locator).toBeEnabled({ timeout });
    // Make sure it is not offscreen/covered
    await locator.scrollIntoViewIfNeeded();

    // Use trial click probes in a short polling loop until Playwright agrees it's clickable
    const start = Date.now();
    let lastErr: unknown = null;
    while (Date.now() - start < timeout) {
      try {
        await locator.click({ trial: true, timeout: Math.min(1000, timeout) });
        return; // success
      } catch (error) {
        lastErr = error;
        // Give layout a moment to settle (animations, overlays, etc.)
        await this.page.waitForTimeout(100);
      }
    }
    // One final attempt to surface a clear error
    try {
      await locator.click({ trial: true, timeout: 500 });
    } catch (error) {
      lastErr = error;
    }
    throw new Error(
      `ensureClickable(): Locator did not become clickable within ${timeout}ms. Last error: ${String(
        lastErr,
      )}`,
    );
  }

  // In tunetrees.po.ts

  async setReviewEval(tuneId: number, evalType: string) {
    // ... (locators setup) ...
    const qualityButton = this.page
      .getByTestId(`${tuneId}_recall_eval`)
      .getByTestId("tt-recal-eval-popover-trigger");

  // Make sure the button is genuinely clickable before clicking
  await this.ensureClickable(qualityButton, 15000);

    // --- Robust Replacement ---
    // Action: Click the button
    // Expected Outcome: The menu becomes visible
    await Promise.all([
      qualityButton.click(),
      this.page
        .getByTestId("tt-recal-eval-group-menu")
        .waitFor({ state: "visible" }),
    ]);

    const responseRecalledButton = this.page.getByTestId(
      `tt-recal-eval-${evalType}`,
    );
  await expect(responseRecalledButton).toBeVisible({ timeout: 60000 });
  await this.ensureClickable(responseRecalledButton, 15000);

    // --- Robust Replacement ---
    // Action: Click the evaluation button
    // Expected Outcome: The popover content disappears (is detached)
    await Promise.all([
      responseRecalledButton.click(),
      this.page
        .getByTestId("tt-recal-eval-popover-content")
        .waitFor({ state: "detached" }),
    ]);
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

    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(1000);

    const topSignInButton = this.page.getByRole("button", { name: "Sign in" });
    await topSignInButton.waitFor({ state: "visible" });
    await expect(topSignInButton).toBeEnabled({ timeout: 50_000 });
    await topSignInButton.click();

    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(2000); // Increased wait for form to fully load

    // Wait for the login dialog to appear and all form elements to be ready
    const userEmailLocator = this.page.getByTestId("user_email");
    await userEmailLocator.waitFor({ state: "visible", timeout: 50_000 });

    // Wait for the password field to also be present to ensure form is fully loaded
    const passwordEntryBox = this.page.getByTestId("user_password");
    await passwordEntryBox.waitFor({ state: "visible", timeout: 50_000 });

    // Wait for the form element to be present to ensure all hidden fields (including CSRF) are loaded
    const loginForm = this.page.locator("form").first();
    await loginForm.waitFor({ state: "attached", timeout: 10_000 });

    // Wait for any hidden CSRF tokens or form setup to complete
    await this.page.waitForTimeout(1500);

    await userEmailLocator.fill(user || "", { timeout: 5000 });
    await this.page.waitForTimeout(10); // helps with the crsf token being set
    await userEmailLocator.press("Tab");
    await passwordEntryBox.fill(pw || "");

    const dialogSignInButton = this.page.getByRole("button", {
      name: "Sign In",
      exact: true,
    });
    await passwordEntryBox.press("Tab");
    await this.page.waitForTimeout(10);

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
    // Use CI-aware timeout: longer in CI environment for reliability
    const loginTimeout = process.env.CI ? 90_000 : 20_000;
    await this.tableStatus.waitFor({
      state: "visible",
      timeout: loginTimeout,
    });

    console.log("===> run-login2.ts:50 ~ ", "Login completed");
  }

  async waitForSuccessfullySubmitted(): Promise<void> {
    await expect(this.toast.last()).toContainText(
      // "Practice successfully submitted",
      "Submitted evaluated tunes.",
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
        const errorText = msg.text();
        const location = msg.location();
        const timestamp = new Date().toISOString();

        console.log(`[${timestamp}] Browser console error:`, errorText);
        console.log(
          `  Location: ${location.url}:${location.lineNumber}:${location.columnNumber}`,
        );

        // Enhanced logging for fetch errors
        if (
          errorText.includes("Failed to fetch") ||
          errorText.includes("TypeError: Failed to fetch")
        ) {
          console.log("  ⚠️  FETCH ERROR DETECTED");
          console.log(`  Error details: ${errorText}`);
          console.log(`  URL where error occurred: ${location.url}`);
        }
      }
      if (msg.type() === "warning") {
        console.log("Browser console warning:", msg.text());
      }
    });
  }

  setupNetworkFailureHandling(): void {
    // Define expected HTTPS-related errors from experimental Next.js setup
    // These errors are expected when running the app with HTTPS on localhost
    // and should not be treated as failures in tests.
    // They are filtered out to avoid cluttering the test logs.
    // This is particularly relevant for Next.js apps running with experimental features.
    // See: https://nextjs.org/docs/app/api-reference/cli/next#using-https-during-development
    const expectedHttpsErrors = [
      "net::ECONNRESET",
      "net::ERR_ABORTED",
      "net::ERR_CERT_AUTHORITY_INVALID",
      "net::ERR_CERT_COMMON_NAME_INVALID",
    ];

    const isDebugMode = process.env.PLAYWRIGHT_DEBUG_NETWORK === "true";

    // Listen for network failures
    this.page.on("requestfailed", (request) => {
      const errorText = request.failure()?.errorText ?? "";
      const url = request.url();
      const method = request.method();
      const timestamp = new Date().toISOString();

      // Check if this is an expected HTTPS error from localhost
      const isExpectedHttpsError = expectedHttpsErrors.some((error) =>
        errorText.includes(error),
      );
      const isLocalhostRequest = url.includes("https://localhost:3000");

      if (isExpectedHttpsError && isLocalhostRequest) {
        // Only log in debug mode for expected errors
        if (isDebugMode) {
          console.log("(DEBUG) Filtered expected HTTPS error:", url, errorText);
        }
      } else {
        // Log unexpected network failures with enhanced details
        console.log(`[${timestamp}] 🚨 Network request failed:`);
        console.log(`  Method: ${method}`);
        console.log(`  URL: ${url}`);
        console.log(`  Error: ${errorText}`);

        // Check if this is a backend API call
        if (url.includes("localhost:8000") || url.includes("/tunetrees/")) {
          console.log("  ⚠️  BACKEND API FAILURE - This is likely your issue!");
          console.log(
            `  🔍 API Endpoint: ${url.split("/tunetrees/")[1] || "unknown"}`,
          );
        }
      }
    });

    // Listen for response errors (like 500 status codes)
    this.page.on("response", (response) => {
      if (response.status() >= 400) {
        const timestamp = new Date().toISOString();
        console.log(
          `[${timestamp}] HTTP ${response.status()} error: ${response.url()}`,
        );

        // Enhanced logging for backend errors
        if (response.url().includes("localhost:8000")) {
          console.log(
            `  🚨 Backend server error - Status: ${response.status()}`,
          );
        }
      }
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

export async function getTuneGridColumnIndex(
  page: Page,
  columnName: string,
): Promise<number | null> {
  const columnLocator = page.getByRole("rowgroup").nth(0);
  for (let i = 0; i < 10; i++) {
    const cell = columnLocator.getByRole("cell").nth(i);
    await expect(cell).toBeVisible();
    const columnText = await cell.innerText();
    if (columnText === columnName) {
      return i; // Return the index of the matching column
    }
  }
  return null; // Return null if no matching column found
}
