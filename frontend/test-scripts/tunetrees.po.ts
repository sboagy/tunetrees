import { type Locator, type Page, expect } from "@playwright/test";
import { initialPageLoadTimeout } from "./paths-for-tests";

export class TuneTreesPageObject {
  readonly page: Page;
  // Use relative path so Playwright's baseURL applies (HTTPS locally, HTTP in CI)
  pageLocation = "/";
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
  // Practice header controls
  readonly showSubmittedToggle: Locator;
  readonly addTunesButton: Locator;
  readonly addTunesCountInput: Locator;
  readonly addTunesConfirmButton: Locator;
  readonly tableFooter: Locator;
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
      "col-latest_due-sort-button",
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

    // Practice header controls
    this.showSubmittedToggle = page.getByTestId("toggle-show-submitted");
    this.addTunesButton = page.getByTestId("practice-add-tunes-button");
    this.addTunesCountInput = page.getByTestId("practice-add-count-input");
    this.addTunesConfirmButton = page.getByTestId("practice-add-confirm");
    this.tableFooter = page.getByTestId("tt-table-footer");

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

  setupPageErrorHandling(): void {
    // Filter transient page errors typical in Next.js dev (especially with HTTPS + server actions)
    const ignoreSubstrings = [
      "TypeError: Failed to fetch",
      "AggregateError: An error occurred in the Server Components render",
      // Next.js dev occasionally emits manifest parse errors mid-reload
      // which are transient and recover on the next request
      "SyntaxError: Unexpected end of JSON input",
      "Unexpected end of JSON input",
      // Next.js dev RSC bug seen intermittently under concurrency
      "Invariant: Expected clientReferenceManifest to be defined",
    ];
    this.page.on("pageerror", (exception) => {
      const msg = exception?.message ?? String(exception);
      const isIgnorable = ignoreSubstrings.some((s) => msg.includes(s));
      if (isIgnorable) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] (ignored pageerror) ${msg}`);
        return; // swallow transient dev error
      }
      // Re-throw all other page errors to fail fast
      this.onError(exception);
    });
  }

  async gotoMainPage(waitForTableStatus = true) {
    // Set up error and network monitoring before navigation
    this.setupConsoleErrorHandling();
    this.setupPageErrorHandling();
    this.setupNetworkFailureHandling();

    const navResponse = await this.page.goto(this.pageLocation, {
      timeout: initialPageLoadTimeout,
      waitUntil: "domcontentloaded", // More reliable than networkidle in CI
    });
    // If Next.js dev serves an occasional 500 on first request, reload once
    if (navResponse && navResponse.status() >= 500) {
      console.log(
        `Initial navigation returned ${navResponse.status()}, reloading once...`,
      );
      await this.page.waitForTimeout(250);
      await this.page.reload({ waitUntil: "domcontentloaded" });
    }
    // Page errors already handled via filtered setupPageErrorHandling()
    await this.page.waitForLoadState("domcontentloaded");
    // Only require the body to be attached; visibility can be affected by transient dev overlays
    await this.page.waitForSelector("body", { state: "attached" });

    // const pageContent = await this.page.content();
    // console.log("Page content after goto:", pageContent.slice(0, 500)); // Log first 500 chars for inspection
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(1000);
    if (waitForTableStatus) {
      const tableStatusTimeout = process.env.CI ? 120_000 : 25_000;
      try {
        await this.tableStatus.waitFor({
          state: "visible",
          timeout: tableStatusTimeout,
        });
      } catch {
        // Fallback: if tableStatus is slow, ensure main UI is ready and proceed.
        const mainTabsVisible = await this.mainTabGroup
          .isVisible({ timeout: 10_000 })
          .catch(() => false);
        if (!mainTabsVisible) {
          // Try one soft reload to recover from a bad initial render/SSR 500
          await this.page.reload({ waitUntil: "domcontentloaded" });
          await this.mainTabGroup.waitFor({
            state: "visible",
            timeout: 10_000,
          });
        }
      }

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
      await this.page.waitForTimeout(500);
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

    await this.ensureClickable(this.repertoireTabTrigger);
    await this.clickWithTimeAfter(this.repertoireTabTrigger);

    // Wait for the filter input to be visible and enabled before interacting with it
    await expect(this.filterInput).toBeVisible({ timeout: 10000 });
    await expect(this.filterInput).toBeEnabled({ timeout: 10000 });

    await this.ensureClickable(this.filterInput);
    // The ensureClickable helper already confirms the input is ready.
    // We can now safely interact with it.
    // Using `fill` is generally more reliable than `click` then `type` as it clears the field first.
    // Playwright's `fill` has built-in auto-waiting, making manual waits unnecessary.
    await this.filterInput.fill(tuneTitle);

    await this.waitForTablePopulationToStart();

    const rowCount = await this.tunesGridRows.count();
    if (rowCount < 2) {
      console.warn(
        `navigateToTune(): expected filtered table row not loaded (rowCount=${rowCount}). Proceeding with best-effort click if available.`,
      );
    }

    // Helper to perform the click on the desired tune row/cell
    const clickDesiredTune = async () => {
      let currentRowCount = await this.tunesGridRows.count();
      let attempts = 0;
      while (currentRowCount < 2 && attempts < 10) {
        await this.page.waitForTimeout(1000);
        currentRowCount = await this.tunesGridRows.count();
        attempts++;
      }
      if (currentRowCount >= 2) {
        // Determine Title column index (fallback to column 1 if not found)
        let titleColIdx = await getTuneGridColumnIndex(this.page, "Title");
        if (titleColIdx === null) titleColIdx = 1;

        // Search first few rows for an exact title match
        let clicked = false;
        const maxAttempts = 6;
        for (let attempt = 1; attempt <= maxAttempts && !clicked; attempt++) {
          const maxCheck = Math.min(currentRowCount - 1, 10);
          for (let i = 1; i <= maxCheck; i++) {
            const row = this.page.getByRole("row").nth(i);
            const titleCell = row.getByRole("cell").nth(titleColIdx);
            const text = (await titleCell.textContent())?.trim();
            if (text === tuneTitle) {
              const idCell = row.getByRole("cell").nth(1);
              await this.clickWithTimeAfter(idCell);
              clicked = true;
              break;
            }
          }
          if (!clicked) {
            await this.page.waitForTimeout(300);
          }
        }
        if (!clicked) {
          // const tuneRow = this.page.getByRole("row").nth(1);
          // const firstCell = tuneRow.getByRole("cell").nth(1);
          // await this.clickWithTimeAfter(firstCell);
          throw new Error(
            `navigateToTune(): Unable to locate tune row for title '${tuneTitle}'.`,
          );
        }
      } else {
        // // Attempt to click any row containing the title
        // const fallback = this.page
        //   .getByRole("row", { name: tuneTitle })
        //   .first();
        // if (await fallback.isVisible()) {
        //   await this.clickWithTimeAfter(fallback);
        // } else {
        //   throw new Error(
        //     `navigateToTune(): Unable to locate tune row for title '${tuneTitle}'.`,
        //   );
        // }
        throw new Error(
          `navigateToTune(): Unable to locate tune row for title '${tuneTitle}'.`,
        );
      }
    };

    // Initial attempt
    await clickDesiredTune();
    await this.page.waitForTimeout(300);

    // Wait until the detail pane reflects the selected tune to ensure editor fields can preload
    const titleVisible = await this.currentTuneTitle
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!titleVisible) {
      console.warn(
        `navigateToTune(): current-tune-title not visible after first click. Retrying click...`,
      );
      // Retry clicking the desired tune
      await clickDesiredTune();
      await this.page.waitForTimeout(300);
    }

    // If still not visible, perform a soft reload and repeat once
    const titleVisibleAfterRetry = await this.currentTuneTitle
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (!titleVisibleAfterRetry) {
      console.warn(
        `navigateToTune(): current-tune-title still hidden. Performing a soft reload and retrying once...`,
      );
      await this.page.reload({ waitUntil: "domcontentloaded" });
      await this.navigateToRepertoireTabDirectly(1);

      // Re-apply the filter and selection
      await expect(this.filterInput).toBeVisible({ timeout: 10_000 });
      await expect(this.filterInput).toBeEnabled({ timeout: 10_000 });
      await this.filterInput.fill("");
      await this.filterInput.fill(tuneTitle);
      await this.waitForTablePopulationToStart();
      await clickDesiredTune();
      await this.page.waitForTimeout(300);
    }

    await expect(this.currentTuneTitle).toBeVisible({ timeout: 15_000 });
    await expect(this.currentTuneTitle).toContainText(tuneTitle, {
      timeout: 15_000,
    });
    // await this.page.getByRole("row", { name: tuneTitle }).click();
  }

  async navigateToRepertoireTab(pauseSecondsAfter = 2) {
    const mainTabVisible = await this.mainTabGroup
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (!mainTabVisible) {
      await this.gotoMainPage();
    }
    await this.navigateToRepertoireTabDirectly(pauseSecondsAfter);
  }

  async navigateToRepertoireTabDirectly(pauseSecondsAfter = 2) {
    // Ensure main tabs are visible; if not, recover by reloading the main page
    try {
      await this.mainTabGroup.waitFor({ state: "visible", timeout: 10_000 });
    } catch {
      console.warn(
        "navigateToRepertoireTabDirectly(): mainTabGroup not visible; attempting recovery via gotoMainPage()",
      );
      await this.gotoMainPage(false);
      await this.mainTabGroup.waitFor({ state: "visible", timeout: 20_000 });
    }
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
    } else {
      await expect(this.tableStatus).toContainText("row(s) selected", {
        timeout: 30000,
      });
    }
    await this.page.waitForTimeout(2000);
    // Wait for grid to finish client-side loading indicators
    const loadingTimeout = process.env.CI ? 60_000 : 20_000;
    await expect(this.tunesGrid).not.toContainText("Loading...", {
      timeout: loadingTimeout,
    });
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

    await this.page.waitForLoadState("domcontentloaded");

    // Make sure it is not offscreen/covered (ignore detach during React re-render)
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 500 });
    } catch {
      // If it detached during re-render, we'll rely on the retry loop below
    }

    // Use trial click probes in a short polling loop until Playwright agrees it's clickable
    const start = Date.now();
    let lastErr: unknown = null;
    while (Date.now() - start < timeout) {
      try {
        await locator.click({ trial: true, timeout: Math.min(1000, timeout) });
        return; // success
      } catch (error) {
        lastErr = error;
        // If the element detached between checks, wait for it to reattach
        try {
          await locator.waitFor({ state: "attached", timeout: 500 });
        } catch {
          // ignore and continue
        }
        // Give layout a moment to settle (animations, overlays, etc.)
        await this.page.waitForTimeout(100);
      }
    }
    // One final attempt to surface a clear error
    try {
      await locator.click({ trial: true, timeout: 500 });
    } catch (_error) {
      lastErr = _error;
    }
    throw new Error(
      `ensureClickable(): Locator did not become clickable within ${timeout}ms. Last error: ${String(
        lastErr,
      )}`,
    );
  }

  // In tunetrees.po.ts

  async setReviewEval(tuneId: number, evalType: string) {
    // Use a more specific locator to find the row, which is more robust
    const row = this.page.locator(`[data-row-id="${tuneId}"]`);
    await expect(row).toBeVisible({ timeout: 60000 });

    const qualityButton = row.getByTestId("tt-recal-eval-popover-trigger");

    // Use a helper to ensure the button is ready to be clicked
    await this.ensureClickable(qualityButton);

    // Open the popover and wait for it to be visible (robust in headless)
    const popoverContent = this.page.getByTestId(
      "tt-recal-eval-popover-content",
    );

    // First attempt
    await qualityButton.click();
    // Wait for the content to at least attach to the DOM
    try {
      await popoverContent.waitFor({ state: "attached", timeout: 5_000 });
    } catch {
      // If it didn't attach quickly, try clicking again (headless can miss the first click)
      await this.ensureClickable(qualityButton, 5_000);
      await qualityButton.click();
    }

    // Now wait for visible with a generous timeout
    try {
      await popoverContent.waitFor({ state: "visible", timeout: 20_000 });
    } catch {
      // As a fallback, one more click in case the first closed it immediately or an animation hid it
      await this.ensureClickable(qualityButton, 5_000);
      await qualityButton.click();
      await popoverContent.waitFor({ state: "visible", timeout: 10_000 });
    }

    // Click the evaluation option and wait for popover to close
    const responseRecalledButton = this.page.getByTestId(
      `tt-recal-eval-${evalType}`,
    );
    await this.ensureClickable(responseRecalledButton);

    await Promise.all([
      responseRecalledButton.click(),
      popoverContent.waitFor({ state: "hidden" }),
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
    await this.page.waitForTimeout(20);

    await this.page.waitForFunction(
      (button) => {
        const btn = button as HTMLButtonElement;
        return !btn.disabled;
      },
      await dialogSignInButton.elementHandle(),
      { timeout: 2000 },
    );

    await this.clickWithTimeAfter(dialogSignInButton);

    // Not sure why the following doesn't work.
    // await this.addToRepertoireButton.waitFor({
    //   state: "visible",
    //   timeout: 30_000,
    // });
    //
    // instead, we'll wait for the tableStatus to be visible.
    // Use CI-aware timeout: longer in CI environment for reliability
    await this.tableStatus.isVisible();
    const tableStatusTimeout = process.env.CI ? 120_000 : 25_000;
    await expect(this.tableStatus).toContainText("row(s) selected", {
      timeout: tableStatusTimeout,
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

  async addTunesViaDialog(count: number): Promise<void> {
    await this.ensureClickable(this.addTunesButton);
    await this.addTunesButton.click();
    await this.addTunesCountInput.waitFor({ state: "visible", timeout: 10000 });
    await this.addTunesCountInput.fill(String(count));
    await this.addTunesConfirmButton.click();
  }

  async navigateToCatalogTab(): Promise<void> {
    // Step 1: If Catalog trigger already exists, try normal activation
    await this.page.waitForLoadState("domcontentloaded");

    const hasCatalogTrigger = await this.catalogTab
      .isVisible()
      .catch(() => false);
    if (!hasCatalogTrigger) {
      // Open the tabs menu to access Catalog
      await this.ensureClickable(this.tabsMenuButton);
      await this.clickWithTimeAfter(this.tabsMenuButton);

      // Wait for the menu containing the catalog choice to be visible
      const dropdownMenu = this.page.locator('[role="menu"]').first();
      await dropdownMenu.waitFor({ state: "visible", timeout: 5000 });
      await this.tabsMenuCatalogChoice.waitFor({
        state: "visible",
        timeout: 5000,
      });

      // Ensure the Catalog tab is not enabled in the menu
      const menuChecked =
        await this.tabsMenuCatalogChoice.getAttribute("aria-checked");
      if (menuChecked !== "true") {
        // await this.ensureClickable(this.tabsMenuCatalogChoice);
        await this.clickWithTimeAfter(this.tabsMenuCatalogChoice);
      } else {
        // Close the menu using Escape
        await this.page.keyboard.press("Escape");
        await dropdownMenu
          .waitFor({ state: "hidden", timeout: 3000 })
          .catch(() =>
            dropdownMenu.waitFor({ state: "detached", timeout: 3000 }),
          );
      }

      // Re-check if the Catalog trigger is now attached/visible
      // hasCatalogTrigger = await this.catalogTab.isVisible().catch(() => false);
      await expect(this.catalogTab).toBeVisible();
      await this.page.waitForLoadState("domcontentloaded");
      await this.page.waitForTimeout(2000);
      return;
    }

    await this.clickWithTimeAfter(this.catalogTab);

    await this.page.waitForLoadState("domcontentloaded");

    // Verify we can see the Add To Repertoire button
    await expect(this.addToRepertoireButton).toBeVisible();

    await this.page.waitForTimeout(2000);
  }

  async addTuneToSelection(tune_id: string): Promise<void> {
    await this.page.evaluate((tuneId: number) => {
      window.scrollToTuneById?.(tuneId);
    }, Number(tune_id));

    await this.page.waitForTimeout(1000);

    // Wait for grid to finish any loading indicators
    const loadingTimeout = process.env.CI ? 60_000 : 20_000;
    try {
      await expect(this.tunesGrid).not.toContainText("Loading...", {
        timeout: loadingTimeout,
      });
    } catch {
      // proceed regardless; some views may not show this indicator
    }

    const tuneCheckbox = this.page
      .getByTestId(`${tune_id}_select`)
      .getByTestId("tt-row-checkbox");

    // Robust wait with retries: if not visible at first, try to re-scroll and retry
    const ensureVisibleAndCheck = async () => {
      await tuneCheckbox
        .waitFor({ state: "attached", timeout: 10_000 })
        .catch(() => undefined);
      const visible = await tuneCheckbox.isVisible().catch(() => false);
      if (!visible) {
        // Retry scroll and short wait
        await this.page.evaluate((tuneId: number) => {
          window.scrollToTuneById?.(tuneId);
        }, Number(tune_id));
        await this.page.waitForTimeout(500);
      }
      await expect(tuneCheckbox).toBeVisible({ timeout: 10_000 });
      await expect(tuneCheckbox).toBeEnabled({ timeout: 10_000 });
      await tuneCheckbox.check();
      await expect(tuneCheckbox).toBeChecked({ timeout: 10_000 });
    };

    try {
      await ensureVisibleAndCheck();
    } catch {
      // One last fallback: small delay and retry once more before failing
      console.warn(
        `addTuneToSelection(${tune_id}): initial selection failed, retrying after short delay...`,
      );
      await this.page.waitForTimeout(1000);
      await ensureVisibleAndCheck();
    }
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
    const tuneIdTestIdStr = `${tune_id}_id`;
    const tuneIdCell = this.page.getByTestId(tuneIdTestIdStr);
    await this.clickWithTimeAfter(tuneIdCell);
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

    await expect(tuneCheckbox).not.toBeChecked();
  }

  setupConsoleErrorHandling(): void {
    // Set up error handling for console errors
    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        const errorText = msg.text();
        const location = msg.location();

        // Filter out the known 404 for user preferences to reduce log noise
        if (
          errorText.includes("Failed to load resource") &&
          errorText.includes("404") &&
          location.url.includes("/api/preferences/prefs_spaced_repetition")
        ) {
          return;
        }

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
        const text = msg.text();
        // Filter out the noisy CSS preload warning from Next.js
        if (text.includes("was preloaded using link preload but not used")) {
          return;
        }
        console.log("Browser console warning:", text);
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
      // Treat local baseURL as expected; allow http/https and IPv4/IPv6 loopback
      let isLocalhostRequest = false;
      try {
        const u = new URL(url);
        const host = u.hostname;
        const port = u.port || (u.protocol === "https:" ? "443" : "80");
        isLocalhostRequest =
          (host === "localhost" ||
            host === "127.0.0.1" ||
            host === "::1" ||
            host === "[::1]") &&
          port === "3000";
      } catch {
        isLocalhostRequest = false;
      }

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
      const url = response.url();
      // Ignore the known 404 for user preferences as it has a graceful fallback
      if (
        response.status() === 404 &&
        url.includes("/api/preferences/prefs_spaced_repetition")
      ) {
        return;
      }

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
