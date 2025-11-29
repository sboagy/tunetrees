import { expect, type Locator, type Page } from "@playwright/test";

declare global {
  interface Window {
    __ttTestUserId?: string;
  }
}

/**
 * Page Object Model for TuneTrees SolidJS PWA
 * Based on legacy React implementation with adaptations for new stack
 */
export class TuneTreesPage {
  readonly page: Page;

  // Navigation & Tabs
  readonly practiceTab: Locator;
  readonly repertoireTab: Locator;
  readonly catalogTab: Locator;
  readonly analysisTab: Locator;

  // TopNav Elements
  readonly playlistDropdown: Locator;
  readonly databaseStatusDropdown: Locator;
  readonly userMenuDropdown: Locator;
  readonly userMenuButton: Locator;
  readonly userEmail: Locator;

  readonly databaseDropdownPanel: Locator;
  readonly userMenuPanel: Locator;

  // Grids
  readonly practiceGrid: Locator;
  readonly repertoireGrid: Locator;
  readonly catalogGrid: Locator;

  // Search & Filters
  readonly searchBox: Locator;
  readonly searchBoxPanel: Locator; // Search box inside filter panel (mobile)
  readonly filtersButton: Locator;
  readonly typeFilter: Locator;
  readonly modeFilter: Locator;
  readonly genreFilter: Locator;
  readonly playlistFilter: Locator;

  // Toolbar Buttons - Generic (may not work on all tabs/viewports)
  readonly addTuneButton: Locator; // Generic by title
  readonly deleteButton: Locator; // Generic by role
  readonly columnsButton: Locator; // Generic by role (text hidden on mobile)

  // Tab-specific Toolbar Buttons (use these for reliable cross-viewport testing)
  readonly catalogAddTuneButton: Locator;
  readonly catalogColumnsButton: Locator;
  readonly catalogAddToRepertoireButton: Locator;
  readonly catalogDeleteButton: Locator;

  readonly repertoireAddTuneButton: Locator;
  readonly repertoireColumnsButton: Locator;
  readonly repertoireAddToReviewButton: Locator;
  readonly repertoireDeleteButton: Locator;

  readonly practiceColumnsButton: Locator;
  // Practice-specific controls
  readonly submitEvaluationsButton: Locator;
  readonly displaySubmittedSwitch: Locator;
  readonly flashcardModeSwitch: Locator;

  // Flashcard view locators
  readonly flashcardView: Locator;
  readonly flashcardHeaderCounter: Locator;
  readonly flashcardPrevButton: Locator;
  readonly flashcardNextButton: Locator;
  readonly flashcardCard: Locator;
  readonly flashcardTitle: Locator;
  readonly flashcardRevealToggle: Locator;
  readonly flashcardRevealButtonMobile: Locator;
  readonly flashcardFieldsMenu: Locator;

  readonly topNavManagePlaylistsPanel: Locator;

  // Tune Editor
  readonly tuneEditorForm: Locator;
  readonly tuneEditorSubmitButton: Locator;
  readonly tuneEditorCancelButton: Locator;
  readonly showPublicToggle: Locator;
  readonly userSettingsButton: Locator;

  readonly userSettingsSchedulingOptionsButton: Locator;
  readonly userSettingsSpacedRepetitionButton: Locator;
  readonly userSettingsAccountButton: Locator;
  readonly userSettingsAvatarButton: Locator;

  readonly settingsMenuToggle: Locator;
  readonly addTuneDialog: Locator;
  readonly sidebarEditTuneButton: Locator;

  readonly tuneEditorContainer: Locator;

  // Login/Auth Elements
  readonly anonymousSignInButton: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly nameInput: Locator;
  readonly signInButton: Locator;
  readonly signUpButton: Locator;
  readonly signUpToggleLink: Locator;
  readonly signOutButton: Locator;
  readonly googleOAuthButton: Locator;
  readonly githubOAuthButton: Locator;

  // Anonymous Banner Elements
  readonly anonymousBanner: Locator;
  readonly anonymousBannerCreateAccountButton: Locator;
  readonly anonymousBannerDismissButton: Locator;

  // Conversion UI Elements
  readonly conversionHeader: Locator;
  readonly conversionInfoBox: Locator;

  // Error Display
  readonly authErrorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Tabs - using data-testid for stability
    this.practiceTab = page.getByTestId("tab-practice");
    this.repertoireTab = page.getByTestId("tab-repertoire");
    this.catalogTab = page.getByTestId("tab-catalog");
    this.analysisTab = page.getByTestId("tab-analysis");

    // TopNav
    this.playlistDropdown = page.getByTestId("playlist-dropdown");
    this.databaseStatusDropdown = page.getByTestId("database-status-dropdown");
    this.userMenuDropdown = page.getByTestId("user-menu-dropdown");
    this.userMenuButton = page.getByTestId("user-menu-button");

    this.userEmail = page.getByText(/.*@.*\.test$/);

    this.databaseDropdownPanel = page.getByTestId("database-dropdown-panel");
    this.userMenuPanel = page.getByTestId("user-menu-panel");

    // Grids - using data-testid matching tablePurpose prop
    this.practiceGrid = page.getByTestId("tunes-grid-scheduled");
    this.repertoireGrid = page.getByTestId("tunes-grid-repertoire");
    this.catalogGrid = page.getByTestId("tunes-grid-catalog");

    // Search & Filters
    this.searchBox = page.getByPlaceholder(/Search/i);
    this.searchBoxPanel = page.getByTestId("search-box-panel");
    this.filtersButton = page.getByRole("button", { name: "Filter options" });
    this.typeFilter = page.getByRole("button", { name: "Filter by Type" });
    this.modeFilter = page.getByRole("button", { name: "Filter by Mode" });
    this.genreFilter = page.getByRole("button", { name: "Filter by Mode" });
    this.playlistFilter = page.getByRole("button", {
      name: "Filter by Playlist",
    });

    // Generic Toolbar Buttons (may not work reliably across tabs/viewports)
    this.addTuneButton = page.getByRole("button", { name: "Add a new tune" });
    this.deleteButton = page.getByRole("button", { name: /Delete/i });
    this.columnsButton = page.getByRole("button", { name: /Columns/i }); // Text hidden on mobile

    // Tab-specific Toolbar Buttons - Catalog
    this.catalogAddTuneButton = page.getByTestId("catalog-add-tune-button");
    this.catalogColumnsButton = page.getByTestId("catalog-columns-button");
    this.catalogAddToRepertoireButton = page.getByTestId(
      "catalog-add-to-repertoire-button"
    );
    this.catalogDeleteButton = page.getByTestId("catalog-delete-button");

    // Tab-specific Toolbar Buttons - Repertoire
    this.repertoireAddTuneButton = page.getByTestId(
      "repertoire-add-tune-button"
    );
    this.repertoireColumnsButton = page.getByTestId(
      "repertoire-columns-button"
    );
    this.repertoireAddToReviewButton = page.getByTestId("add-to-review-button");
    this.repertoireDeleteButton = page.getByTestId("repertoire-delete-button");

    // Tab-specific Toolbar Buttons - Practice
    this.practiceColumnsButton = page.getByTestId("practice-columns-button");
    this.submitEvaluationsButton = page.getByTestId(
      "submit-evaluations-button"
    );
    this.displaySubmittedSwitch = page.getByTestId("display-submitted-switch");
    this.flashcardModeSwitch = page.getByTestId("flashcard-mode-switch");

    // Flashcard view
    this.flashcardView = page.getByTestId("flashcard-view");
    this.flashcardHeaderCounter = page.getByTestId("flashcard-counter");
    this.flashcardPrevButton = page.getByTestId("flashcard-prev-button");
    this.flashcardNextButton = page.getByTestId("flashcard-next-button");
    this.flashcardCard = page.getByTestId("flashcard-card");
    this.flashcardTitle = page.getByTestId("flashcard-tune-title");
    this.flashcardRevealToggle = page.getByTestId("flashcard-reveal-toggle");
    this.flashcardRevealButtonMobile = page.getByTestId(
      "flashcard-reveal-button"
    );
    this.flashcardFieldsMenu = page.getByTestId("flashcard-fields-menu");

    this.topNavManagePlaylistsPanel = page.getByTestId(
      "top-nav-manage-playlists-panel"
    );

    // Tune Editor
    this.tuneEditorForm = page.getByTestId("tune-editor-form");
    this.tuneEditorSubmitButton = page.getByTestId("tune-editor-save-button");
    this.tuneEditorCancelButton = page.getByTestId("tune-editor-cancel-button");
    // TODO(REFACTOR): Global show-public-toggle removed. Update tests to use per-field override indicators instead.
    this.showPublicToggle = page.getByTestId("override-indicator-title");
    this.userSettingsButton = page.getByTestId("user-settings-button");

    this.userSettingsSchedulingOptionsButton = page.getByRole("link", {
      name: "Scheduling Options",
    });
    this.userSettingsSpacedRepetitionButton = page.getByRole("link", {
      name: "Spaced Repetition",
    });
    this.userSettingsAccountButton = page.getByRole("link", {
      name: "Account",
    });
    this.userSettingsAvatarButton = page.getByRole("link", {
      name: "Avatar",
    });

    this.settingsMenuToggle = page.getByTestId("settings-menu-toggle");

    // Dialogs
    // Match either explicit test id (if component provides it) or the role-based alertdialog
    // this.addTuneDialog = page.locator('[data-testid="add-tune-dialog"], [role="alertdialog"]');
    this.addTuneDialog = page.getByTestId("add-tune-dialog");

    // Match either expanded or collapsed sidebar edit button with a single locator
    this.sidebarEditTuneButton = page
      .getByTestId(/^sidebar-edit-tune-button(?:-collapsed)?$/)
      .last();

    this.tuneEditorContainer = page.getByTestId("tune-editor-container");

    // Login/Auth Elements
    this.anonymousSignInButton = page.getByRole("button", {
      name: /Use on this Device Only/i,
    });
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByRole("textbox", { name: "Password" });
    this.nameInput = page.getByLabel("Name");
    this.signInButton = page.getByRole("button", { name: /^Sign In$/i });
    this.signUpButton = page.getByRole("button", { name: /Create Account/i });
    this.signUpToggleLink = page.getByRole("button", {
      name: /Sign up|Don't have an account/i,
    });
    this.signOutButton = page.getByRole("button", { name: /Sign Out/i });
    this.googleOAuthButton = page.getByRole("button", {
      name: /Continue with Google/i,
    });
    this.githubOAuthButton = page.getByRole("button", {
      name: /Continue with GitHub/i,
    });

    // Anonymous Banner Elements
    this.anonymousBanner = page.locator(
      ".bg-gradient-to-r.from-blue-500.to-blue-600"
    );
    this.anonymousBannerCreateAccountButton = this.anonymousBanner.getByRole(
      "button",
      { name: /Create Account/i }
    );
    this.anonymousBannerDismissButton = this.anonymousBanner.getByRole(
      "button",
      { name: /Dismiss/i }
    );

    // Conversion UI Elements
    this.conversionHeader = page.getByRole("heading", {
      name: /Backup Your Data/i,
    });
    this.conversionInfoBox = page.locator(
      "text=Your local data will be preserved"
    );

    // Error Display
    this.authErrorMessage = page.locator(".bg-red-50, .bg-red-900\\/20");
  }

  // ===== Authentication Helper Methods =====

  /**
   * Navigate to login page and clear any existing auth state
   */
  async gotoLogin() {
    // Clear cookies first (this works without a page)
    await this.page.context().clearCookies();

    // Navigate to login page first (required before accessing localStorage)
    await this.page.goto("http://localhost:5173/login");
    await this.page.waitForLoadState("domcontentloaded");

    // Now clear localStorage and IndexedDB (page must be loaded first)
    await this.page.evaluate(async () => {
      localStorage.clear();
      // Clear IndexedDB
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    });

    // Reload the page to apply cleared state
    await this.page.reload();
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Sign in anonymously and wait for app to load
   * Automatically dismisses onboarding overlay if shown
   */
  async signInAnonymously() {
    await this.anonymousSignInButton.click();
    // Wait for redirect to home and app to load
    await this.page.waitForURL(/\/$|\/\?/, { timeout: 15000 });

    // Wait longer for database initialization and onboarding check
    // The app has a 500ms delay before showing onboarding, so we need to wait
    await this.page.waitForTimeout(1500);

    // Dismiss onboarding overlay if it appears (for new users)
    await this.dismissOnboardingIfPresent();
  }

  /**
   * Sign in anonymously and complete onboarding by creating a playlist.
   * Use this when tests need to interact with repertoire functionality.
   *
   * @param playlistName - Name for the new playlist (default: "Test Playlist")
   */
  async signInAnonymouslyWithPlaylist(playlistName = "Test Playlist") {
    await this.anonymousSignInButton.click();
    // Wait for redirect to home and app to load
    await this.page.waitForURL(/\/$|\/\?/, { timeout: 15000 });

    // Wait longer for database initialization and onboarding check
    // The app has a 500ms delay before showing onboarding, so we need to wait
    await this.page.waitForTimeout(1500);

    // Complete onboarding by creating a playlist (instead of skipping)
    await this.completeOnboardingWithPlaylist(playlistName);
  }

  /**
   * Dismiss onboarding overlay if it is visible.
   * The app has a bug where onboarding can appear with a 500ms+ delay,
   * so we need to wait long enough and be aggressive about dismissing.
   */
  async dismissOnboardingIfPresent() {
    const welcomeHeading = this.page.getByRole("heading", {
      name: /Welcome to TuneTrees/i,
    });
    const skipTourButton = this.page
      .locator('button:has-text("Skip Tour")')
      .last();

    // Wait for the app to potentially show onboarding (600ms delay + buffer)
    await this.page.waitForTimeout(1000);

    // Try up to 5 times to ensure onboarding is dismissed
    for (let attempt = 0; attempt < 5; attempt++) {
      const isVisible = await welcomeHeading.isVisible().catch(() => false);

      if (isVisible) {
        try {
          await skipTourButton.click({ timeout: 2000 });
          // Wait for it to disappear
          await welcomeHeading.waitFor({ state: "hidden", timeout: 3000 });
        } catch {
          // Click might have failed, wait and retry
          await this.page.waitForTimeout(500);
          continue;
        }
      }

      // Wait to see if it re-appears
      await this.page.waitForTimeout(800);

      const stillVisible = await welcomeHeading.isVisible().catch(() => false);
      if (!stillVisible) {
        // It's gone and stayed gone - success!
        return;
      }
    }
  }

  /**
   * Complete onboarding by creating a playlist (instead of skipping).
   * This is required for tests that need to use repertoire functionality.
   *
   * @param playlistName - Name for the new playlist (default: "Test Playlist")
   */
  async completeOnboardingWithPlaylist(playlistName = "Test Playlist") {
    const welcomeHeading = this.page.getByRole("heading", {
      name: /Welcome to TuneTrees/i,
    });
    const createPlaylistButton = this.page.locator(
      'button:has-text("Create Playlist")'
    );

    // Wait for the app to potentially show onboarding (600ms delay + buffer)
    await this.page.waitForTimeout(1000);

    // Check if onboarding is visible
    const isVisible = await welcomeHeading.isVisible().catch(() => false);

    if (isVisible) {
      // Click "Create Playlist" button to open the playlist editor dialog
      await createPlaylistButton.click({ timeout: 3000 });

      // Wait for playlist editor dialog to appear
      const playlistDialog = this.page.getByRole("dialog");
      await playlistDialog.waitFor({ state: "visible", timeout: 5000 });

      // Fill in the playlist name
      const nameInput = playlistDialog.getByLabel(/Playlist Name|Name/i);
      await nameInput.fill(playlistName);

      // Click "Create" or "Save" button
      const saveButton = playlistDialog.getByRole("button", {
        name: /Create|Save/i,
      });
      await saveButton.click({ timeout: 3000 });

      // Wait for dialog to close
      await playlistDialog.waitFor({ state: "hidden", timeout: 5000 });

      // Now we should be on step 2 (view-catalog) - skip that
      await this.page.waitForTimeout(500);
      const step2Heading = this.page.getByRole("heading", {
        name: /add some tunes/i,
      });
      const step2Visible = await step2Heading.isVisible().catch(() => false);
      if (step2Visible) {
        const skipButton = this.page
          .locator('button:has-text("Skip Tour")')
          .last();
        await skipButton.click({ timeout: 2000 });
        await step2Heading.waitFor({ state: "hidden", timeout: 3000 });
      }
    }
  }

  /**
   * Sign up with email/password
   */
  async signUp(email: string, password: string, name: string) {
    await this.signUpToggleLink.click();
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signUpButton.click();
  }

  /**
   * Convert anonymous user to registered account
   * Assumes already on login page with ?convert=true
   */
  async convertAnonymousAccount(email: string, password: string, name: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signUpButton.click();
    // Wait for conversion to complete and redirect
    await this.page.waitForURL(/\/$|\/\?/, { timeout: 25000 });
    await this.page.waitForTimeout(2000); // Allow sync to start
  }

  /**
   * Sign out via user menu
   */
  async signOut() {
    await this.userMenuButton.click();
    await this.signOutButton.click();
    // Wait for redirect to login
    await this.page.waitForURL(/\/login/, { timeout: 10000 });
  }

  /**
   * Re-login if session was lost (e.g., after clearing IndexedDB).
   * Loops until either the practice tab is visible (still logged in) or
   * login form is detected and credentials are entered.
   *
   * @param email - User's email address
   * @param password - User's password (default: ALICE_TEST_PASSWORD from env)
   * @param maxAttempts - Maximum retry attempts (default: 10)
   * @throws Error if unable to log in after max attempts
   */
  async ensureLoggedIn(
    email: string,
    userId: string,
    password: string = "",
    maxAttempts = 10
  ): Promise<void> {
    // Doing this unconditionally, early on, seems to avoid what I think
    // may be a lagging page.evaluate (i.e. it logs out while the evaluate is still running?).
    await this.page.evaluate((userId) => {
      window.__ttTestUserId = userId;
    }, userId);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const loginVisible = await this.anonymousSignInButton
        .isVisible()
        .catch(() => false);

      if (loginVisible) {
        console.log(`Seem to be logged out, logging back in as ${email}`);
        if (password === "") {
          const password = process.env.ALICE_TEST_PASSWORD;
          if (!password) {
            throw Error("ALICE_TEST_PASSWORD must be set in the environment");
          }
        }
        await this.emailInput.fill(email);
        await this.page.locator('input[type="password"]').fill(password);
        await this.signInButton.click();

        // Wait for practice tab to appear after login
        for (let attempt2 = 0; attempt2 < maxAttempts; attempt2++) {
          const practiceTabVisible = await this.practiceTab
            .isVisible()
            .catch(() => false);
          if (practiceTabVisible) {
            console.log(
              `Practice tab visible after login, logged in as ${email}`
            );
            return;
          }
          await this.page.waitForTimeout(1000);
        }

        // Failed to see practice tab after login - attach diagnostics
        await this.page.screenshot(); // Captured for debugging
        console.log("Login failure - screenshot captured");
        console.log(
          "Login failure - page content available via page.content()"
        );

        throw new Error(
          `Unable to log in as ${email} after multiple attempts. Check console for diagnostics.`
        );
      }

      // Check if already logged in (practice tab visible)
      const practiceTabVisible = await this.practiceTab
        .isVisible()
        .catch(() => false);
      if (practiceTabVisible) {
        console.log(`Practice tab visible, still logged in as ${email}`);
        return;
      }

      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Check if anonymous banner is visible
   */
  async isAnonymousBannerVisible(): Promise<boolean> {
    try {
      await this.anonymousBanner.waitFor({ state: "visible", timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Dismiss the anonymous banner
   */
  async dismissAnonymousBanner() {
    await this.anonymousBannerDismissButton.click();
    await this.anonymousBanner.waitFor({ state: "hidden", timeout: 5000 });
  }

  /**
   * Click "Create Account" on the anonymous banner
   */
  async clickCreateAccountOnBanner() {
    // Ensure onboarding overlay is dismissed first (may block banner button)
    await this.dismissOnboardingIfPresent();

    // Ensure the button is visible and ready
    await this.anonymousBannerCreateAccountButton.waitFor({
      state: "visible",
      timeout: 5000,
    });

    // Click and immediately check if navigation starts
    await this.anonymousBannerCreateAccountButton.click();

    // Wait for navigation to login page with convert parameter
    await this.page.waitForURL(/\/login\?convert=true/, { timeout: 10000 });
  }

  /**
   * Open the sidebar tune editor for currently selected tune and wait until core inputs are visible.
   * Avoids Playwright's networkidle which can hang due to persistent websocket connections.
   */
  async openTuneEditor() {
    await this.sidebarEditTuneButton.click();
    await this.page.waitForTimeout(100); // Allow sync to start
    await expect(this.tuneEditorForm).toBeVisible({ timeout: 10000 });
    // Title input is a reliable readiness indicator
    const titleInput = this.page.getByTestId("tune-editor-input-title");
    await expect(titleInput).toBeVisible({ timeout: 10000 });
  }

  /**
   * Navigate to app and wait for initial load
   */
  async goto(url = "http://localhost:5173") {
    await this.page.goto(url);
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(2000); // Allow sync to start
  }

  /**
   * Finds the index of a column in a grid by its header text.
   * @param gridTestId The data-testid of the grid container.
   * @param columnHeaderText The text to search for in the header (case-insensitive).
   * @returns The zero-based index of the column.
   */
  async getColumnIndexByHeaderText(
    gridTestId: string,
    columnHeaderText: string
  ) {
    const headers = this.page.locator(`[data-testid='${gridTestId}'] thead th`);
    const headerTexts = await headers.allTextContents();
    const columnIndex = headerTexts.findIndex((text) =>
      new RegExp(columnHeaderText, "i").test(text)
    );

    // Ensure the column was found
    expect(columnIndex).toBeGreaterThan(-1);

    return columnIndex;
  }

  /**
   * Navigate to a specific tab by ID
   */
  async navigateToTab(
    tabId: "practice" | "repertoire" | "catalog" | "analysis"
  ) {
    const tab = this.page.getByTestId(`tab-${tabId}`);

    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();

    // Wait for the tab to become selected via ARIA
    // Some tabs use aria-selected, others use aria-current="page".
    const hasAriaSelected = (await tab.getAttribute("aria-selected")) !== null;
    if (hasAriaSelected) {
      await expect(tab).toHaveAttribute("aria-selected", "true", {
        timeout: 5000,
      });
    } else {
      await expect(tab).toHaveAttribute("aria-current", "page", {
        timeout: 5000,
      });
    }

    // Then wait for the corresponding grid/content to be visible
    const grid =
      tabId === "practice"
        ? this.practiceGrid
        : tabId === "repertoire"
          ? this.repertoireGrid
          : tabId === "catalog"
            ? this.catalogGrid
            : undefined;
    if (grid) {
      await expect(grid).toBeVisible({ timeout: 10000 });
    }
  }

  /**
   * Search for a tune and wait for results
   * Returns the grid for further assertions
   * Handles responsive layout: search box in toolbar (desktop) or filter panel (mobile)
   */
  async searchForTune(tuneTitle: string, grid: Locator): Promise<void> {
    // Check if toolbar search box is visible (desktop view)
    const isToolbarSearchVisible = await this.searchBox
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (isToolbarSearchVisible) {
      // Desktop: use toolbar search box
      await this.searchBox.fill(tuneTitle);
      await this.page.waitForTimeout(2000); // Wait for virtualized grid to update
    } else {
      // Mobile: open filter panel if needed and use search box inside
      const isPanelSearchVisible = await this.searchBoxPanel
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      if (!isPanelSearchVisible) {
        await this.filtersButton.click();
        await this.page.waitForTimeout(500); // Wait for panel to open
      }

      await this.searchBoxPanel.fill(tuneTitle);
      await this.page.waitForTimeout(2000); // Wait for virtualized grid to update
      // Close the panel if we opened it (toggle Filters button) or try Esc as a fallback
      if (!isPanelSearchVisible) {
        const filtersVisible = await this.filtersButton
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        if (filtersVisible) {
          await this.filtersButton.click();
        } else {
          await this.page.keyboard.press("Escape").catch(() => {});
        }
        await this.page.waitForTimeout(300);
      }
    }

    // Verify grid is visible after search
    if (!this.page.getByText("No tunes found").isVisible()) {
      await expect(grid).toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * Find a tune link by name in a specific grid
   * Works with virtualized grids by looking for links
   * Returns .first() to handle duplicate tune names
   */
  async getTuneLink(tuneName: string, grid: Locator): Promise<Locator> {
    return grid.getByRole("link", { name: tuneName }).first();
  }

  /**
   * Find a tune row by ID in a specific grid
   * Useful for checking private tunes (UUIDs)
   */
  async getTuneRowById(tuneId: string, grid: Locator): Promise<Locator> {
    return grid.locator(`tr:has-text("${tuneId}")`);
  }

  getRows(gridId: string): Locator {
    return this.page.locator(
      `[data-testid="tunes-grid-${gridId}"] tbody tr[data-index]`
    );
  }

  /**
   * Verify a tune is visible in the grid
   * Handles virtualized grids by searching within the grid context
   */
  async expectTuneVisible(tuneName: string, grid: Locator, timeout = 5000) {
    const tuneLink = await grid.getByRole("cell", { name: tuneName }).first();
    await expect(tuneLink).toBeVisible({ timeout });
  }

  /**
   * Click a tune to select it
   */
  async clickTune(tuneName: string, grid: Locator) {
    const tuneLink = await this.getTuneLink(tuneName, grid);
    await tuneLink.click();
  }

  /**
   * Verify toolbar buttons are visible
   * Uses tab-specific locators for reliable cross-viewport testing
   * @param options - Which buttons to check and which tab's toolbar
   */
  async expectToolbarVisible(
    options: {
      addTune?: boolean;
      addToRepertoire?: boolean;
      delete?: boolean;
      columns?: boolean;
      tab?: "catalog" | "repertoire" | "practice";
    } = {}
  ) {
    const tab = options.tab || "catalog"; // Default to catalog for backwards compat

    if (options.addTune) {
      const button =
        tab === "catalog"
          ? this.catalogAddTuneButton
          : tab === "repertoire"
            ? this.repertoireAddTuneButton
            : this.addTuneButton;
      await expect(button).toBeVisible({ timeout: 5000 });
    }
    if (options.addToRepertoire) {
      await expect(this.catalogAddToRepertoireButton).toBeVisible({
        timeout: 5000,
      });
    }
    if (options.delete !== undefined) {
      const deleteBtn =
        tab === "catalog"
          ? this.catalogDeleteButton
          : tab === "repertoire"
            ? this.repertoireDeleteButton
            : this.deleteButton;

      if (options.delete) {
        await expect(deleteBtn).toBeVisible();
        await expect(deleteBtn).toBeEnabled();
      } else {
        const visible = await deleteBtn
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        if (visible) {
          await expect(deleteBtn).toBeDisabled();
        }
      }
    }
    if (options.columns) {
      const columnsBtn =
        tab === "catalog"
          ? this.catalogColumnsButton
          : tab === "repertoire"
            ? this.repertoireColumnsButton
            : tab === "practice"
              ? this.practiceColumnsButton
              : this.columnsButton;
      await expect(columnsBtn).toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * Verify column headers are visible by their IDs
   * Uses data-testid="ch-{columnId}" pattern for stable selection
   * @param columnIds - Array of column IDs like ["title", "mode", "type"]
   */
  async expectColumnsVisible(columnIds: string[]) {
    for (const id of columnIds) {
      const header = this.page.getByTestId(`ch-${id.toLowerCase()}`);
      await expect(header).toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * Filter by type (Jig, Reel, etc.)
   */
  async filterByType(type: string) {
    await this.filtersButton.click();
    await this.page.waitForTimeout(500);
    await this.typeFilter.click();
    await this.page.waitForTimeout(500);

    const typePanel = this.page.getByText("AirBDnceFlingFling/");
    const option = typePanel.getByRole("checkbox", { name: type });

    if (await option.isVisible({ timeout: 1000 })) {
      await option.setChecked(true);
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Clear search box
   * Handles responsive layout: search box in toolbar (desktop) or filter panel (mobile)
   */
  async clearSearch() {
    // Check if toolbar search box is visible (desktop view)
    const isToolbarSearchVisible = await this.searchBox
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (isToolbarSearchVisible) {
      // Desktop: use toolbar search box
      await this.searchBox.clear();
    } else {
      // Mobile: open filter panel if needed and use search box inside
      const isPanelSearchVisible = await this.searchBoxPanel
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      if (!isPanelSearchVisible) {
        await this.filtersButton.click();
        await this.page.waitForTimeout(500); // Wait for panel to open
      }

      await this.searchBoxPanel.clear();
    }

    await this.page.waitForTimeout(500);
  }

  /**
   * Wait for sync to complete after auth
   * Used in test setup
   */
  async waitForSync(timeout = 7000) {
    await this.page.waitForTimeout(timeout);
  }

  /**
   * Verify user is logged in
   */
  async expectLoggedIn(email: string) {
    await expect(this.page.getByText(email)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Verify no loading state is shown
   */
  async expectNoLoading() {
    await this.page.waitForTimeout(3000);
    await expect(this.page.locator('[role="progressbar"]')).not.toBeVisible();
    await expect(this.page.getByText(/Loading/i)).not.toBeVisible();
  }

  /**
   * Verify no errors are shown
   */
  async expectNoErrors() {
    await expect(this.page.getByText(/error/i)).not.toBeVisible();
    await expect(this.page.getByText(/failed/i)).not.toBeVisible();
  }

  /**
   * Check if grid has content (for virtualized grids, check for cells)
   */
  async expectGridHasContent(grid: Locator) {
    // Wait for grid to be visible first
    await expect(grid).toBeVisible({ timeout: 40000 });

    // Check for table cells
    const cells = grid.locator("td");

    // Wait for at least one cell to appear (30s timeout)
    await expect(cells.first()).toBeVisible({ timeout: 30000 });

    const cellCount = await cells.count();
    expect(cellCount).toBeGreaterThan(0);
  }

  /**
   * Verify filters panel is visible
   * Uses filter button selectors to avoid matching other "Mode" elements
   */
  async expectFiltersVisible() {
    await expect(this.typeFilter).toBeVisible({ timeout: 5000 });
    await expect(this.modeFilter).toBeVisible({ timeout: 5000 });
    await expect(this.genreFilter).toBeVisible({ timeout: 5000 });
  }

  /**
   * Verify search box is visible (either toolbar or panel)
   * Handles responsive layout automatically
   */
  async expectSearchBoxVisible() {
    const isToolbarSearchVisible = await this.searchBox
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (isToolbarSearchVisible) {
      await expect(this.searchBox).toBeVisible({ timeout: 5000 });
    } else {
      // Mobile: check if panel search box is visible or can be made visible
      const isPanelSearchVisible = await this.searchBoxPanel
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      if (isPanelSearchVisible) {
        await expect(this.searchBoxPanel).toBeVisible({ timeout: 5000 });
      } else {
        // Panel not open yet, but filters button should be available to open it
        await expect(this.filtersButton).toBeVisible({ timeout: 5000 });
      }
    }
  }

  /**
   * Open user menu dropdown
   * Handles responsive layout: desktop shows email text, mobile shows only icon
   */
  async openUserMenu() {
    await this.userMenuButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Verify user menu button is visible
   * On desktop, checks for email text; on mobile, checks for button with data-testid
   */
  async expectUserMenuVisible(email?: string) {
    // Check if button is visible
    await expect(this.userMenuButton).toBeVisible({ timeout: 5000 });

    // On desktop, email text should be visible
    if (email) {
      const emailVisible = await this.page
        .getByText(email)
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      if (emailVisible) {
        await expect(this.page.getByText(email)).toBeVisible({ timeout: 5000 });
      }
      // On mobile, email text is hidden but button is still there
    }
  }

  // ===== Flashcard helpers =====

  async enableFlashcardMode() {
    await this.flashcardModeSwitch.click();
    await expect(this.flashcardView).toBeVisible({ timeout: 5000 });
  }

  async disableFlashcardMode() {
    await this.flashcardModeSwitch.click();
    await expect(this.flashcardView).not.toBeVisible({ timeout: 5000 });
  }

  async waitForNextCardButtonToBeEnabled(
    maxRetries: number = 100,
    retryDelayMs: number = 200
  ): Promise<number> {
    for (let i = 0; i < maxRetries; i++) {
      const isEnabled = await this.flashcardNextButton
        .isEnabled({ timeout: 500 })
        .catch(() => false);
      if (isEnabled) return i;
      await this.page.waitForTimeout(retryDelayMs);
    }
    await this.page.screenshot({
      path: `test-results/flashcard-wait-for-next-card_button-timeout-${Date.now()}.png`,
    });
    throw new Error("Next button did not become enabled within timeout");
  }

  async waitForPrevCardButtonToBeEnabled(
    maxRetries: number = 100,
    retryDelayMs: number = 200
  ): Promise<number> {
    for (let i = 0; i < maxRetries; i++) {
      const isEnabled = await this.flashcardPrevButton
        .isEnabled({ timeout: 500 })
        .catch(() => false);
      if (isEnabled) return i;
      await this.page.waitForTimeout(retryDelayMs);
    }
    await this.page.screenshot({
      path: `test-results/flashcard-wait-for-previous-card_button-timeout-${Date.now()}.png`,
    });
    throw new Error("Previous button did not become enabled within timeout");
  }

  async goNextCard() {
    await this.waitForNextCardButtonToBeEnabled();
    await this.flashcardNextButton.click();
  }

  async goPrevCard() {
    await this.waitForPrevCardButtonToBeEnabled();
    await this.flashcardPrevButton.click();
  }

  async revealCard() {
    // Prefer desktop toggle; fall back to mobile button
    const desktopVisible = await this.flashcardRevealToggle
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (desktopVisible) {
      await this.flashcardRevealToggle.click();
      return;
    }
    const mobileVisible = await this.flashcardRevealButtonMobile
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (mobileVisible) {
      await this.flashcardRevealButtonMobile.click();
    }
  }

  /**
   * Ensure a specific reveal state without toggling blindly.
   * desired = true -> ensure Back is shown; desired = false -> ensure Front is shown.
   * Uses aria-label on the reveal toggle which reflects the action ("Show back" when on front, "Show front" when on back).
   */
  async ensureReveal(desiredBack: boolean) {
    // Try desktop toggle first
    const desktopVisible = await this.flashcardRevealToggle
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (desktopVisible) {
      for (let i = 0; i < 2; i++) {
        const label =
          (await this.flashcardRevealToggle.getAttribute("aria-label")) || "";
        const currentlyBack = /Show front/i.test(label); // if button says "Show front", we are on Back
        if (currentlyBack === desiredBack) return;
        await this.flashcardRevealToggle.click();
      }
      return;
    }
    // Fallback to mobile button: we can only toggle; assume initial is front
    const mobileVisible = await this.flashcardRevealButtonMobile
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (mobileVisible) {
      if (desiredBack) {
        await this.flashcardRevealButtonMobile.click();
      }
    }
  }

  async selectFlashcardEvaluation(
    value: "again" | "hard" | "good" | "easy" | "not-set" = "good"
  ) {
    // Open the first (and only) evaluation combobox in the card
    const evalButton = this.page
      .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
      .first();
    // If not immediately clickable, ensure the back of the card is revealed
    const clickable = await evalButton
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!clickable) {
      await this.ensureReveal(true);
    }
    await evalButton.click();
    const optionTestId = `recall-eval-option-${value}`;
    await this.page.getByTestId(optionTestId).click();
  }

  async openFlashcardFieldsMenu() {
    await this.practiceColumnsButton.click();
    await expect(this.flashcardFieldsMenu).toBeVisible({ timeout: 2000 });
  }

  async toggleFlashcardField(
    face: "front" | "back",
    fieldId: string,
    desired?: boolean
  ) {
    await this.openFlashcardFieldsMenu();
    const checkbox = this.page.getByTestId(`ffv-${face}-${fieldId}`);
    if (desired === undefined) {
      await checkbox.click();
    } else {
      const isChecked = await checkbox.isChecked().catch(() => false);
      if (isChecked !== desired) {
        await checkbox.click();
      }
    }
    // Click outside to close menu (click Columns/Fields button again)
    await this.practiceColumnsButton.click();
  }

  async getFlashcardCounterText(): Promise<string> {
    return (await this.flashcardHeaderCounter.textContent())?.trim() || "";
  }

  async getFlashcardTitle(): Promise<string> {
    return (await this.flashcardTitle.textContent())?.trim() || "";
  }

  /**
   * Wait for flashcard counter to stabilize and return the total count value.
   * Polls the counter text and extracts the "of X" value, retrying until a valid count is found.
   * @param maxRetries - max number of polling attempts (default: 100)
   * @param retryDelayMs - delay between retries in ms (default: 200)
   * @returns total count from counter (e.g., "5 of 10" returns 10)
   */
  async waitForCounterValue(
    maxRetries: number = 100,
    retryDelayMs: number = 200,
    countToWaitUpTo = 1,
    waitGTE = true
  ): Promise<number> {
    let total = 0;
    for (let i = 0; i < maxRetries; i++) {
      const counterText = await this.flashcardHeaderCounter.textContent();
      total = parseInt(counterText?.split(" of ")[1] || "0", 10);
      if (waitGTE && total >= countToWaitUpTo) {
        return total;
      } else if (!waitGTE && total <= countToWaitUpTo) {
        return total;
      }
      await this.page.waitForTimeout(retryDelayMs);
    }
    await this.page.screenshot({
      path: `test-results/flashcard-counter-timeout-${Date.now()}.png`,
    });
    throw new Error(
      `Counter value did not stabilize within ${maxRetries * retryDelayMs}ms`
    );
  }

  // ===== Tune Editor form helpers =====

  /**
   * Open the Genre select in the Tune Editor and choose an option.
   * Uses the Trigger button next to the "Genre:" label.
   */
  async selectGenreInTuneEditor(optionLabel: string) {
    // Find the trigger near the Genre label within the form
    const trigger = this.tuneEditorForm
      .getByRole("button", { name: /select genre/i })
      .or(
        this.tuneEditorForm
          .locator("label:has-text('Genre:')")
          .locator("xpath=../following-sibling::*")
          .locator("button")
          .first()
      );
    await trigger.click();
    await this.page
      .getByRole("listbox")
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => {});
    await this.page.getByRole("option", { name: optionLabel }).first().click();
  }

  /**
   * Open the Type select in the Tune Editor and choose an option.
   * Uses the Trigger button next to the "Type:" label.
   */
  async selectTypeInTuneEditor(optionLabel: string) {
    const trigger = this.tuneEditorForm
      .getByRole("button", { name: /select tune type/i })
      .or(
        this.tuneEditorForm
          .locator("label:has-text('Type:')")
          .locator("xpath=../following-sibling::*")
          .locator("button")
          .first()
      );
    await trigger.click();
    await this.page
      .getByRole("listbox")
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => {});
    await this.page.getByRole("option", { name: optionLabel }).first().click();
  }
}
