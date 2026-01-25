import { expect, type Locator, type Page } from "@playwright/test";
import {
  clearTunetreesClientStorage,
  gotoE2eOrigin,
} from "../helpers/local-db-lifecycle";
import { BASE_URL } from "../test-config";

declare global {
  interface Window {
    __ttTestUserId?: string;
  }
}

type OnboardingRepertoireArgs = {
  name?: string | null;
  default_genre?: string | null;
  instrument?: string | null;
  genres_filter?: string[] | null;
};

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
  readonly logoDropdown: Locator;
  readonly logoDropdownButton: Locator;
  readonly logoDropdownPanel: Locator;
  readonly logoDropdownAboutButton: Locator;
  readonly logoDropdownWhatsNewLink: Locator;
  readonly playlistDropdown: Locator;
  readonly playlistDropdownButton: Locator;
  readonly databaseStatusDropdown: Locator;
  readonly databaseStatusButton: Locator;
  readonly userMenuDropdown: Locator;
  readonly userMenuButton: Locator;
  readonly userEmail: Locator;

  readonly databaseDropdownPanel: Locator;
  readonly userMenuPanel: Locator;

  // About Dialog Elements
  readonly aboutDialog: Locator;
  readonly aboutVersion: Locator;
  readonly aboutBuild: Locator;
  readonly aboutBranch: Locator;
  readonly aboutEnvironment: Locator;
  readonly aboutGithubLink: Locator;
  readonly aboutDocsLink: Locator;
  readonly aboutCloseButton: Locator;

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
  readonly clearFilters: Locator;

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
  readonly repertoireRemoveButton: Locator;

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

  readonly userSettingsCatalogSyncButton: Locator;
  readonly userSettingsSchedulingOptionsButton: Locator;
  readonly userSettingsSpacedRepetitionButton: Locator;
  readonly userSettingsAccountButton: Locator;
  readonly userSettingsAvatarButton: Locator;

  readonly settingsMenuToggle: Locator;
  readonly addTuneDialog: Locator;
  readonly sidebarEditTuneButton: Locator;
  readonly sidebarExpandButton: Locator;
  readonly sidebarCollapseButton: Locator;

  readonly tuneEditorContainer: Locator;

  // Notes Panel
  readonly notesPanel: Locator;
  readonly notesCount: Locator;
  readonly notesAddButton: Locator;
  readonly notesSaveButton: Locator;
  readonly notesCancelButton: Locator;
  readonly notesNewEditor: Locator;
  readonly notesList: Locator;
  readonly notesEmptyMessage: Locator;
  readonly notesNoTuneMessage: Locator;
  readonly notesLoading: Locator;

  // References Panel
  readonly referencesPanel: Locator;
  readonly referencesCount: Locator;
  readonly referencesAddButton: Locator;
  readonly referencesAddForm: Locator;
  readonly referencesEditForm: Locator;
  readonly referencesList: Locator;
  readonly referencesNoTuneMessage: Locator;
  readonly referencesLoading: Locator;

  // Reference Form
  readonly referenceForm: Locator;
  readonly referenceUrlInput: Locator;
  readonly referenceTitleInput: Locator;
  readonly referenceTypeSelect: Locator;
  readonly referenceCommentInput: Locator;
  readonly referenceFavoriteCheckbox: Locator;
  readonly referenceSubmitButton: Locator;
  readonly referenceCancelButton: Locator;

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

  // Date Rollover Banner Elements
  readonly dateRolloverBanner: Locator;
  readonly dateRolloverRefreshButton: Locator;

  // Conversion UI Elements
  readonly conversionHeader: Locator;
  readonly conversionInfoBox: Locator;

  // Onboarding Elements
  readonly onboardingWelcomeHeading: Locator;
  readonly onboardingCreateRepertoireButton: Locator;
  readonly onboardingChooseGenresHeading: Locator;
  readonly onboardingGenreSearchInput: Locator;
  readonly onboardingGenreSelectAllButton: Locator;
  readonly onboardingGenreClearAllButton: Locator;
  readonly onboardingGenreContinueButton: Locator;
  readonly onboardingGenreCheckboxes: Locator;

  // Error Display
  readonly authErrorMessage: Locator;

  // Sync & Offline Status Elements
  readonly syncStatusIndicator: Locator;
  readonly syncButton: Locator;
  readonly offlineIndicator: Locator;
  readonly pendingChangesCount: Locator;
  readonly syncProgressIndicator: Locator;

  // Standard stable factors for test
  readonly REPERTOIRE_SIZE = 419;
  readonly MAX_DAILY_TUNES = 7;
  readonly ENABLE_FUZZ = false;
  readonly SCHEDULE_NEW_TUNES_AUTOMATICALLY = true;

  constructor(page: Page) {
    this.page = page;

    // Tabs - using data-testid for stability
    this.practiceTab = page.getByTestId("tab-practice");
    this.repertoireTab = page.getByTestId("tab-repertoire");
    this.catalogTab = page.getByTestId("tab-catalog");
    this.analysisTab = page.getByTestId("tab-analysis");

    // TopNav
    this.logoDropdown = page.getByTestId("logo-dropdown");
    this.logoDropdownButton = page.getByTestId("logo-dropdown-button");
    this.logoDropdownPanel = page.getByTestId("logo-dropdown-panel");
    this.logoDropdownAboutButton = page.getByTestId(
      "logo-dropdown-about-button"
    );
    this.logoDropdownWhatsNewLink = page.getByTestId(
      "logo-dropdown-whats-new-link"
    );
    this.playlistDropdown = page.getByTestId("playlist-dropdown");
    this.playlistDropdownButton = page.getByTestId("playlist-dropdown-button");
    this.databaseStatusDropdown = page.getByTestId("database-status-dropdown");
    this.databaseStatusButton = page.getByTestId("database-status-button");
    this.userMenuDropdown = page.getByTestId("user-menu-dropdown");
    this.userMenuButton = page.getByTestId("user-menu-button");

    this.userEmail = page.getByText(/.*@.*\.test$/);

    this.databaseDropdownPanel = page.getByTestId("database-dropdown-panel");
    this.userMenuPanel = page.getByTestId("user-menu-panel");

    // About Dialog
    this.aboutDialog = page.getByTestId("about-dialog");
    this.aboutVersion = page.getByTestId("about-version");
    this.aboutBuild = page.getByTestId("about-build");
    this.aboutBranch = page.getByTestId("about-branch");
    this.aboutEnvironment = page.getByTestId("about-environment");
    this.aboutGithubLink = page.getByTestId("about-github-link");
    this.aboutDocsLink = page.getByTestId("about-docs-link");
    this.aboutCloseButton = page.getByTestId("about-close-button");

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
    this.genreFilter = page.getByRole("button", { name: "Filter by Genre" });
    this.playlistFilter = page.getByRole("button", {
      name: "Filter by Playlist",
    });
    this.clearFilters = page.getByRole("button", { name: /^Clear All/i });

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
    this.repertoireRemoveButton = page.getByTestId("repertoire-remove-button");

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

    this.userSettingsCatalogSyncButton = page.getByRole("link", {
      name: "Catalog & Sync",
    });
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

    // Sidebar expand/collapse buttons (for mobile responsive layout)
    this.sidebarExpandButton = page.getByRole("button", {
      name: "Expand sidebar",
    });
    this.sidebarCollapseButton = page.getByRole("button", {
      name: "Collapse sidebar",
    });

    this.tuneEditorContainer = page.getByTestId("tune-editor-container");

    // Notes Panel
    this.notesPanel = page.getByTestId("notes-panel");
    this.notesCount = page.getByTestId("notes-count");
    this.notesAddButton = page.getByTestId("notes-add-button");
    this.notesSaveButton = page.getByTestId("notes-save-button");
    this.notesCancelButton = page.getByTestId("notes-cancel-button");
    this.notesNewEditor = page.getByTestId("notes-new-editor");
    this.notesList = page.getByTestId("notes-list");
    this.notesEmptyMessage = page.getByTestId("notes-empty-message");
    this.notesNoTuneMessage = page.getByTestId("notes-no-tune-message");
    this.notesLoading = page.getByTestId("notes-loading");

    // References Panel
    this.referencesPanel = page.getByTestId("references-panel");
    this.referencesCount = page.getByTestId("references-count");
    this.referencesAddButton = page.getByTestId("references-add-button");
    this.referencesAddForm = page.getByTestId("references-add-form");
    this.referencesEditForm = page.getByTestId("references-edit-form");
    this.referencesList = page.getByTestId("references-list");
    this.referencesNoTuneMessage = page.getByTestId(
      "references-no-tune-message"
    );
    this.referencesLoading = page.getByTestId("references-loading");

    // Reference Form
    this.referenceForm = page.getByTestId("reference-form");
    this.referenceUrlInput = page.getByTestId("reference-url-input");
    this.referenceTitleInput = page.getByTestId("reference-title-input");
    this.referenceTypeSelect = page.getByTestId("reference-type-select");
    this.referenceCommentInput = page.getByTestId("reference-comment-input");
    this.referenceFavoriteCheckbox = page.getByTestId(
      "reference-favorite-checkbox"
    );
    this.referenceSubmitButton = page.getByTestId("reference-submit-button");
    this.referenceCancelButton = page.getByTestId("reference-cancel-button");

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

    // Date Rollover Banner Elements
    this.dateRolloverBanner = page.getByTestId("date-rollover-banner");
    this.dateRolloverRefreshButton = page.getByTestId(
      "date-rollover-refresh-button"
    );

    // Conversion UI Elements
    this.conversionHeader = page.getByRole("heading", {
      name: /Backup Your Data/i,
    });
    this.conversionInfoBox = page.locator(
      "text=Your local data will be preserved"
    );

    // Onboarding Elements
    this.onboardingWelcomeHeading = page.getByRole("heading", {
      name: /Welcome to TuneTrees/i,
    });
    this.onboardingCreateRepertoireButton = page.getByTestId(
      "onboarding-create-repertoire"
    );
    this.onboardingChooseGenresHeading = page.getByRole("heading", {
      name: /Choose additional genres to download/i,
    });
    this.onboardingGenreSearchInput = page.getByTestId(
      "onboarding-genre-search"
    );
    this.onboardingGenreSelectAllButton = page.getByTestId(
      "onboarding-genre-select-all"
    );
    this.onboardingGenreClearAllButton = page.getByTestId(
      "onboarding-genre-clear-all"
    );
    this.onboardingGenreContinueButton = page.getByTestId(
      "onboarding-genre-continue"
    );
    this.onboardingGenreCheckboxes = page
      .getByTestId("onboarding-genre")
      .locator("input[type='checkbox']");

    // Error Display
    this.authErrorMessage = page.locator(".bg-red-50, .bg-red-900\\/20");

    // Sync & Offline Status Elements
    this.syncStatusIndicator = page.getByTestId("sync-status-indicator");
    this.syncButton = page.getByTestId("sync-button");
    this.offlineIndicator = page.getByTestId("offline-indicator");
    this.pendingChangesCount = page.getByTestId("pending-changes-count");
    this.syncProgressIndicator = page.getByTestId("sync-progress-indicator");
  }

  // ===== Authentication Helper Methods =====

  /**
   * Wait for the authenticated "home" UI to be available.
   * In practice, the presence of the top nav tabs indicates the SPA is mounted and auth has resolved.
   */
  async waitForHome(opts?: { timeoutMs?: number }) {
    const timeoutMs = opts?.timeoutMs ?? 30_000;
    await expect(this.practiceTab).toBeVisible({ timeout: timeoutMs });
  }

  /**
   * Navigate to login page and clear any existing auth state
   */
  async gotoLogin() {
    // Clear cookies first (this works without a page)
    await this.page.context().clearCookies();

    // Use a same-origin static page so we can clear storage without booting the SPA.
    await gotoE2eOrigin(this.page);
    await clearTunetreesClientStorage(this.page, {
      preserveAuth: false,
      deleteAllIndexedDbs: true,
    });

    await this.page.goto(`${BASE_URL}/login`, {
      waitUntil: "domcontentloaded",
    });
  }

  /**
   * Sign in anonymously and wait for app to load
   * Automatically dismisses onboarding overlay if shown
   */
  async signInAnonymously(repertoire: OnboardingRepertoireArgs | null = null) {
    await this.anonymousSignInButton.click();
    // Wait for redirect to home and app to load
    await this.page.waitForURL(/\/$|\/\?/, { timeout: 15000 });

    // Wait longer for database initialization and onboarding check
    // The app has a 500ms delay before showing onboarding, so we need to wait
    await this.page.waitForTimeout(1500);

    if (repertoire) {
      const completed =
        await this.completeOnboardingWithPlaylistConfig(repertoire);
      if (!completed) {
        await this.dismissOnboardingIfPresent();
      }
    } else {
      // Dismiss onboarding overlay if it appears (for new users)
      await this.dismissOnboardingIfPresent();
    }

    // Ensure the app shell is actually ready before returning to the test.
    await this.waitForHome({ timeoutMs: 30_000 });
  }

  /**
   * Sign in anonymously and complete onboarding by creating a playlist.
   * Use this when tests need to interact with repertoire functionality.
   *
   * @param playlistName - Name for the new playlist (default: "Test Playlist")
   */
  async signInAnonymouslyWithPlaylist(playlistName = "Test Playlist") {
    await this.signInAnonymously({ name: playlistName });
  }

  /**
   * Sign in anonymously and stop at the genre selection onboarding step.
   */
  async signInAnonymouslyToGenreSelection(playlistName = "Test Playlist") {
    await this.anonymousSignInButton.click();
    // Wait for redirect to home and app to load
    await this.page.waitForURL(/\/$|\/\?/, { timeout: 15000 });

    // Wait longer for database initialization and onboarding check
    await this.page.waitForTimeout(1500);

    await this.startOnboardingWithPlaylist(playlistName);
    await expect(this.onboardingChooseGenresHeading).toBeVisible({
      timeout: 15000,
    });
    await expect(this.onboardingGenreSearchInput).toBeVisible({
      timeout: 15000,
    });
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
    await this.completeOnboardingWithPlaylistConfig({ name: playlistName });
  }

  private async completeOnboardingWithPlaylistConfig(
    opts: OnboardingRepertoireArgs
  ): Promise<boolean> {
    const playlistName = opts.name?.trim() || "Test Playlist";
    const didStart = await this.startOnboardingWithPlaylist(playlistName, opts);
    if (!didStart) return false;

    await this.applyOnboardingGenreSelection(opts.genres_filter ?? null);

    // Now we should be on step 3 (view-catalog) - skip that
    await this.page.waitForTimeout(500);
    const step3Heading = this.page.getByRole("heading", {
      name: /add some tunes/i,
    });
    const step3Visible = await step3Heading.isVisible().catch(() => false);
    if (step3Visible) {
      const gotItButton = this.page.getByRole("button", {
        name: /got it!/i,
      });
      const skipButton = this.page.getByRole("button", {
        name: /skip tour/i,
      });

      const gotItVisible = await gotItButton.isVisible().catch(() => false);
      const skipVisible = await skipButton.isVisible().catch(() => false);

      if (gotItVisible) {
        await gotItButton.click({ timeout: 2000 });
      } else if (skipVisible) {
        await skipButton.click({ timeout: 2000 });
      }
      await step3Heading.waitFor({ state: "hidden", timeout: 3000 });
    }

    return true;
  }

  private async applyOnboardingGenreSelection(genresFilter: string[] | null) {
    const chooseGenresVisible = await this.onboardingChooseGenresHeading
      .isVisible()
      .catch(() => false);
    if (!chooseGenresVisible) return;

    await expect(this.onboardingGenreSearchInput).toBeVisible({
      timeout: 15000,
    });
    await expect(this.onboardingGenreCheckboxes.first()).toBeVisible({
      timeout: 15000,
    });

    if (genresFilter && genresFilter.length > 0) {
      await this.onboardingGenreClearAllButton.click({ timeout: 3000 });
      for (const genre of genresFilter) {
        await this.setOnboardingGenreChecked(genre, true);
      }
    } else {
      const continueEnabled = await this.onboardingGenreContinueButton
        .isEnabled()
        .catch(() => false);
      if (!continueEnabled) {
        await this.onboardingGenreSelectAllButton.click({ timeout: 3000 });
      }
    }

    await this.onboardingGenreContinueButton.click({ timeout: 5000 });
    await this.onboardingGenreContinueButton.waitFor({
      state: "hidden",
      timeout: 15000,
    });
  }

  private async setOnboardingGenreChecked(
    genreIdOrName: string,
    checked: boolean
  ) {
    const trimmed = genreIdOrName.trim();
    if (!trimmed) return;

    const checkboxById = this.page.getByTestId(
      `onboarding-genre-checkbox-${trimmed}`
    );
    if ((await checkboxById.count()) > 0) {
      await checkboxById.scrollIntoViewIfNeeded();
      if (await checkboxById.isDisabled().catch(() => false)) {
        const isChecked = await checkboxById.isChecked().catch(() => false);
        if (checked && !isChecked) {
          throw new Error(`Onboarding genre ${trimmed} is disabled`);
        }
        return;
      }
      await checkboxById.setChecked(checked);
      return;
    }

    const list = this.page.getByTestId("onboarding-genre");
    const checkboxByLabel = list
      .locator("label", { hasText: trimmed })
      .first()
      .locator('input[type="checkbox"]');

    await expect(checkboxByLabel).toBeVisible({ timeout: 5000 });
    await checkboxByLabel.scrollIntoViewIfNeeded();
    if (await checkboxByLabel.isDisabled().catch(() => false)) {
      const isChecked = await checkboxByLabel.isChecked().catch(() => false);
      if (checked && !isChecked) {
        throw new Error(`Onboarding genre ${trimmed} is disabled`);
      }
      return;
    }
    await checkboxByLabel.setChecked(checked);
  }

  /**
   * Start onboarding by creating a playlist. Returns true if onboarding was shown.
   */
  private async startOnboardingWithPlaylist(
    playlistName = "Test Playlist",
    opts?: OnboardingRepertoireArgs
  ): Promise<boolean> {
    // Wait for the app to potentially show onboarding (600ms delay + buffer)
    await this.page.waitForTimeout(1000);

    const isVisible = await this.onboardingWelcomeHeading
      .isVisible()
      .catch(() => false);

    if (!isVisible) return false;

    // Click "Create Playlist" button to open the playlist editor dialog
    await this.onboardingCreateRepertoireButton.click({ timeout: 3000 });

    // Wait for playlist editor dialog to appear
    const playlistDialog = this.page.getByTestId("playlist-editor-dialog");
    await playlistDialog.waitFor({ state: "visible", timeout: 5000 });

    // Fill in the repertoire name
    const nameInput = playlistDialog.getByLabel(/Repertoire Name|Name/i);
    await nameInput.fill(playlistName);

    const defaultGenre = opts?.default_genre?.trim();
    if (defaultGenre) {
      const genreSelect = playlistDialog.locator("#genre-default");
      await this.selectOptionByTextOrValue(genreSelect, defaultGenre);
    }

    const instrument = opts?.instrument?.trim();
    if (instrument) {
      const instrumentSelect = playlistDialog.locator("#instrument-ref");
      await this.selectOptionByTextOrValue(instrumentSelect, instrument);
    }

    // Click "Create" or "Save" button
    const saveButton = playlistDialog.getByTestId("save-playlist-button");
    await saveButton.click({ timeout: 3000 });

    // Wait for dialog to close
    await playlistDialog.waitFor({ state: "hidden", timeout: 5000 });
    return true;
  }

  private async selectOptionByTextOrValue(
    select: Locator,
    desired: string
  ): Promise<boolean> {
    const desiredNormalized = desired.trim().toLowerCase();
    const options = select.locator("option");

    await expect
      .poll(async () => options.count(), {
        timeout: 5000,
        intervals: [100, 250, 500],
      })
      .toBeGreaterThan(0);

    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const option = options.nth(i);
      const value = (await option.getAttribute("value"))?.trim();
      const label = (await option.textContent())?.trim();

      if (value && value.toLowerCase() === desiredNormalized) {
        await select.selectOption({ value });
        return true;
      }

      if (label?.toLowerCase().includes(desiredNormalized)) {
        await select.selectOption({ label });
        return true;
      }
    }

    console.warn(`Onboarding: unable to match select option for "${desired}"`);
    return false;
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

  async setSchedulingPrefs(
    overrides: {
      playlistSize?: number;
      enableFuzz?: boolean;
      maxReviews?: number;
      scheduleNewTunesAutomatically?: boolean;
    } = {}
  ) {
    const config = {
      playlistSize: overrides.playlistSize ?? this.REPERTOIRE_SIZE,
      enableFuzz: overrides.enableFuzz ?? this.ENABLE_FUZZ,
      maxReviews: overrides.maxReviews ?? this.MAX_DAILY_TUNES,
      scheduleNewTunesAutomatically:
        overrides.scheduleNewTunesAutomatically ??
        this.SCHEDULE_NEW_TUNES_AUTOMATICALLY,
    };

    await this.page.addInitScript(
      (cfg: {
        playlistSize: number;
        enableFuzz: boolean;
        maxReviews: number;
        scheduleNewTunesAutomatically: boolean;
      }) => {
        (window as any).__TUNETREES_TEST_PLAYLIST_SIZE__ = cfg.playlistSize;
        (window as any).__TUNETREES_TEST_ENABLE_FUZZ__ = cfg.enableFuzz;
        (window as any).__TUNETREES_TEST_MAX_REVIEWS_PER_DAY__ = cfg.maxReviews;
        (window as any).__TUNETREES_TEST_SCHEDULE_NEW_TUNES_AUTOMATICALLY__ =
          cfg.scheduleNewTunesAutomatically;
      },
      config
    );
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
   * Expand the sidebar if it's collapsed (mobile responsive layout).
   * On desktop, the sidebar is always expanded, so this is a no-op.
   * On mobile, after clicking a row the sidebar is collapsed and needs to be expanded.
   */
  async ensureSidebarExpanded(opts?: { timeoutMs?: number }) {
    const timeoutMs = opts?.timeoutMs ?? 8000;

    // Desktop often has no expand/collapse buttons.
    const [expandVisibleInitial, collapseVisibleInitial] = await Promise.all([
      this.sidebarExpandButton.isVisible({ timeout: 500 }).catch(() => false),
      this.sidebarCollapseButton.isVisible({ timeout: 500 }).catch(() => false),
    ]);
    if (!expandVisibleInitial && !collapseVisibleInitial) return;

    // Already expanded.
    if (collapseVisibleInitial) return;

    // On mobile, the expand button can appear a bit after a row is clicked.
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const collapseVisible = await this.sidebarCollapseButton
        .isVisible({ timeout: 250 })
        .catch(() => false);
      if (collapseVisible) return;

      const expandVisible = await this.sidebarExpandButton
        .isVisible({ timeout: 250 })
        .catch(() => false);
      if (expandVisible) {
        const expandEnabled = await this.sidebarExpandButton
          .isEnabled()
          .catch(() => true);
        if (expandEnabled) {
          await this.sidebarExpandButton.click({ timeout: 5000 });
          await this.page.waitForTimeout(300);
          return;
        }
      }

      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Navigate to app and wait for initial load
   */
  async goto(url = `${BASE_URL}`) {
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

    await expect(tab).toBeVisible({ timeout: 20_000 });
    await expect(tab).toBeEnabled({ timeout: 20_000 });

    // Avoid short "trial" clicks: they can flake under CI load.
    // Let Playwright's normal click retry within a reasonable timeout.
    const [selectedBefore, currentBefore] = await Promise.all([
      tab.getAttribute("aria-selected"),
      tab.getAttribute("aria-current"),
    ]);
    const isActiveBefore =
      selectedBefore === "true" || currentBefore === "page";

    if (!isActiveBefore) {
      await tab.scrollIntoViewIfNeeded().catch(() => undefined);
      await tab.click({ timeout: 10_000 });
    }

    // Wait for the tab to become active.
    // Tabs may indicate this via `aria-selected="true"` or `aria-current="page"`.
    await expect
      .poll(
        async () => {
          const [selected, current] = await Promise.all([
            tab.getAttribute("aria-selected"),
            tab.getAttribute("aria-current"),
          ]);
          return selected === "true" || current === "page";
        },
        { timeout: 10_000, intervals: [100, 250, 500, 1000] }
      )
      .toBe(true);

    // Wait for tab-specific, always-present UI before asserting on grids.
    // Some grids only mount when data is loaded and non-empty.
    const sentinel =
      tabId === "practice"
        ? this.practiceColumnsButton
        : tabId === "repertoire"
          ? this.repertoireColumnsButton
          : tabId === "catalog"
            ? this.catalogColumnsButton
            : undefined;
    if (sentinel) {
      await sentinel.scrollIntoViewIfNeeded().catch(() => undefined);
      await expect(sentinel).toBeVisible({ timeout: 20_000 });
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
      // Best-effort: if the grid is mounted, wait for it; otherwise allow
      // callers to assert on loading/empty states as needed.
      const initialCount = await grid.count().catch(() => 0);
      if (initialCount === 0) {
        await expect
          .poll(async () => (await grid.count().catch(() => 0)) > 0, {
            timeout: 4000,
            intervals: [100, 250, 500, 1000],
          })
          .toBe(true)
          .catch(() => undefined);
      }

      const finalCount = await grid.count().catch(() => 0);
      if (finalCount > 0) {
        await expect(grid).toBeVisible({ timeout: 20_000 });
      }
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
        await this.page.waitForTimeout(50); // Trying to help flaky test
        await this.filtersButton.click();
        await expect(this.searchBoxPanel).toBeVisible();
        await expect(this.searchBoxPanel).toBeAttached();
        await expect(this.searchBoxPanel).toBeEnabled();
      }

      await this.searchBoxPanel.fill(tuneTitle);
      await this.page.waitForTimeout(2000); // Wait for virtualized grid to update

      // Ensure the filter panel is closed so the grid is interactable.
      // (The panel may already be open from earlier steps.)
      const panelStillVisible = await this.searchBoxPanel
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (panelStillVisible) {
        const filtersVisible = await this.filtersButton
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        if (filtersVisible) {
          await this.page.waitForTimeout(50); // Trying to help flaky test
          await this.filtersButton.click();
        } else {
          await this.page.keyboard.press("Escape").catch(() => {});
        }
        await this.page.waitForTimeout(300);
      }
    }

    // Wait for the search results to settle: either empty state appears or
    // at least one row is present.
    const noTunesFound = this.page.getByText("No tunes found");
    const dataRows = grid.locator("tbody tr[data-index], tbody tr");

    await expect
      .poll(
        async () => {
          const emptyVisible = await noTunesFound
            .isVisible({ timeout: 250 })
            .catch(() => false);
          if (emptyVisible) return "empty";

          const rowCount = await dataRows.count().catch(() => 0);
          if (rowCount > 0) return "rows";

          return "pending";
        },
        { timeout: 15_000, intervals: [100, 250, 500, 1000] }
      )
      .not.toBe("pending");

    const noTunesVisible = await noTunesFound
      .isVisible({ timeout: 250 })
      .catch(() => false);
    if (!noTunesVisible) {
      await expect(grid).toBeVisible({ timeout: 10_000 });
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
   * Find a tune row by ID in a specific grid.
   * Useful for finding rows by tune ID, but not so useful
   * when the ID column isn't showing (except for "scheduled" can use the
   * evaluation control to locate)
   */
  getTuneRowById(tuneId: string, grid: Locator): Locator {
    if (grid === this.practiceGrid) {
      return this.getRowInPracticeGridByTuneId(tuneId);
    }
    return grid.locator(`tr:has-text("${tuneId}")`);
  }

  /**
   * Find a tune row by ID in the practice grid.
   * Useful for locating a row when the ID column is not showing.
   */
  getRowInPracticeGridByTuneId(tuneId: string): Locator {
    const row = this.page
      .getByTestId(`recall-eval-${tuneId}`) // RecallEvalComboBox DropdownMenu.Trigger
      .locator("..") // div?
      .locator("..") // cell
      .locator(".."); // row
    return row;
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
      // Note: Delete button only exists on catalog tab, not on repertoire
      const deleteBtn =
        tab === "catalog" ? this.catalogDeleteButton : this.deleteButton;

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
  async filterByGenre(genre: string) {
    await this.filtersButton.click();
    await this.page.waitForTimeout(500);
    await this.genreFilter.click();
    await this.page.waitForTimeout(500);

    const option = this.page.getByRole("checkbox", {
      name: genre,
    });

    await option.isVisible();
    await option.setChecked(true);
    await this.page.waitForTimeout(1000);
    await this.filtersButton.click();
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

    await option.isVisible();
    await option.setChecked(true);
    await this.page.waitForTimeout(1000);

    await this.filtersButton.click();
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

  async enableFlashcardMode(timeoutAfter: number = 800) {
    await this.flashcardModeSwitch.click();
    await expect(this.flashcardView).toBeVisible({ timeout: 15_000 });

    if (typeof timeoutAfter === "number") {
      await this.page.waitForTimeout(timeoutAfter);
    }
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

  async goNextCard(waitAfter: number = 800) {
    await this.waitForNextCardButtonToBeEnabled();
    await this.flashcardNextButton.click();
    await this.page.waitForTimeout(waitAfter);
  }

  async goPrevCard(waitAfter: number = 800) {
    await this.waitForPrevCardButtonToBeEnabled();
    await this.flashcardPrevButton.click();
    await this.page.waitForTimeout(waitAfter);
  }

  async revealCard() {
    await expect(this.flashcardRevealToggle).toBeVisible({ timeout: 10_000 });
    const before =
      (await this.flashcardRevealToggle.getAttribute("aria-label")) || "";
    await this.flashcardRevealToggle.click();
    await expect(this.flashcardRevealToggle).not.toHaveAttribute(
      "aria-label",
      before,
      { timeout: 5000 }
    );
  }

  /**
   * Ensure a specific reveal state without toggling blindly.
   * desired = true -> ensure Back is shown; desired = false -> ensure Front is shown.
   * Uses aria-label on the reveal toggle which reflects the action ("Show back" when on front, "Show front" when on back).
   */
  async ensureReveal(desiredBack: boolean) {
    await expect(this.flashcardRevealToggle).toBeVisible({ timeout: 10_000 });
    await expect(this.flashcardRevealToggle).toBeEnabled({ timeout: 10_000 });
    await this.page.waitForTimeout(100);

    const desiredLabel = desiredBack ? /Show front/i : /Show back/i;
    for (let i = 0; i < 2; i++) {
      const label =
        (await this.flashcardRevealToggle.getAttribute("aria-label")) || "";
      const currentlyBack = /Show front/i.test(label); // if button says "Show front", we are on Back
      if (currentlyBack === desiredBack) {
        await expect(this.flashcardRevealToggle).toHaveAttribute(
          "aria-label",
          desiredLabel,
          { timeout: 5000 }
        );
        return;
      }

      await this.flashcardRevealToggle.click();
      await this.page.waitForTimeout(200);

      await expect(this.flashcardRevealToggle).toHaveAttribute(
        "aria-label",
        desiredLabel,
        { timeout: 5000 }
      );
    }
  }

  parseTuneIdFromRecallEvalTestId(testId: string | null): string | null {
    if (!testId) return null;
    if (!testId.startsWith("recall-eval-")) return null;
    const tuneId = testId.slice("recall-eval-".length);

    // Basic UUID sanity check (36 chars with hyphens)
    if (tuneId.length !== 36) return null;
    if (tuneId[8] !== "-" || tuneId[13] !== "-" || tuneId[18] !== "-") {
      return null;
    }

    return tuneId;
  }

  async setRowEvaluation(
    whichRow: Locator,
    evalValue: string,
    doTimeouts: boolean | number = true
  ) {
    const allowed = ["again", "hard", "good", "easy", "not-set"] as const;
    if (!allowed.includes(evalValue as (typeof allowed)[number])) {
      throw new Error(
        `Invalid evaluation value "${evalValue}". Expected one of: ${allowed.join(
          ", "
        )}`
      );
    }
    const evalDropdown = whichRow.locator("[data-testid^='recall-eval-']");
    await expect(evalDropdown).toBeVisible({ timeout: 5000 });

    const dropdownTestId = await evalDropdown.getAttribute("data-testid");
    const tuneId = this.parseTuneIdFromRecallEvalTestId(dropdownTestId);
    if (!tuneId) {
      throw new Error(
        `Expected tuneId to be present on recall evaluation dropdown (data-testid=${String(
          dropdownTestId
        )})`
      );
    }

    const menu = this.page.getByTestId(`recall-eval-menu-${tuneId}`);

    for (let attempt = 0; attempt < 3; attempt++) {
      // ACT: Select rating
      await evalDropdown.click({ delay: 50 });

      try {
        await expect(menu).toBeVisible({ timeout: 3000 });
      } catch {
        // Under load (esp. Mobile Chrome), opening the dropdown can be flaky.
        // Avoid hanging until the full test timeout; back out and retry.
        try {
          await this.page.keyboard.press("Escape");
        } catch {}

        if (doTimeouts) {
          const delay = typeof doTimeouts === "number" ? doTimeouts : 200;
          await this.page.waitForTimeout(delay);
        }
        continue;
      }

      const whichOption = menu.getByTestId(`recall-eval-option-${evalValue}`);
      try {
        await expect(whichOption).toBeVisible({ timeout: 4000 });
        await expect(whichOption).toBeEnabled({ timeout: 4000 });
        await whichOption.click({ trial: true, timeout: 3000 });
        await whichOption.click({ timeout: 3000 });
      } catch {
        // Menu items can detach during quick re-renders; back out and retry.
        try {
          await this.page.keyboard.press("Escape");
        } catch {}
        if (doTimeouts) {
          const delay = typeof doTimeouts === "number" ? doTimeouts : 200;
          await this.page.waitForTimeout(delay);
        }
        continue;
      }
      await expect(menu)
        .toBeHidden({ timeout: 3000 })
        .catch(() => undefined);

      if (doTimeouts) {
        const delay = typeof doTimeouts === "number" ? doTimeouts : 50;
        await this.page.waitForTimeout(delay);
      }
      return;
    }

    throw new Error(
      `Failed to select evaluation ${evalValue} for tune ${tuneId} after retries`
    );
  }

  /**
   * Selects a spaced-repetition evaluation value for the currently displayed flashcard.
   *
   * This helper is designed to be resilient against transient UI states in E2E runs:
   * it ensures the card back is revealed when necessary, opens the evaluation combobox,
   * waits for the requested option to become attached/visible/enabled, performs a trial
   * click to validate clickability (not covered / correct hit target), then clicks to
   * select it and verifies the option list closes and the button label reflects the
   * chosen value.
   *
   * @param value - The evaluation to select. Defaults to `"good"`. Use `"not-set"` to clear the evaluation.
   *
   * @throws {Error} If the evaluation option does not disappear after selection (menu did not close).
   * @throws {Error} If the evaluation cannot be set after multiple retries.
   * @throws If Playwright assertions or interactions fail while waiting for or clicking the option.
   *
   * @remarks
   * - Uses multiple retry loops to mitigate flakiness due to animations, delayed renders, or focus issues.
   * - Assumes the first matching `recall-eval-*` control is the intended combobox for the card.
   * - Verifies the final selected value by matching the evaluation button text (e.g., `"good:"` or `"(Not Set)"`).
   */
  async selectFlashcardEvaluation(
    value: "again" | "hard" | "good" | "easy" | "not-set" = "good",
    timeoutAfter: number = 500
  ) {
    const nOuterAttempts = 6;
    for (let outerAttempt = 0; outerAttempt < nOuterAttempts; outerAttempt++) {
      try {
        await expect(this.flashcardView).toBeVisible({ timeout: 15_000 });

        // Open the evaluation combobox within the flashcard view (avoid picking up
        // any recall-eval controls that might exist elsewhere on the page).
        const evalButton = this.flashcardView.getByTestId(
          /^recall-eval-[0-9a-f-]+$/i
        );
        console.log(`outerAttempt: ${outerAttempt}`);
        await expect(evalButton).toBeVisible({ timeout: 10_000 });
        await evalButton.scrollIntoViewIfNeeded();
        await expect(evalButton).toBeEnabled({ timeout: 10_000 });

        const dropdownTestId = await evalButton.getAttribute("data-testid");
        const tuneId = this.parseTuneIdFromRecallEvalTestId(dropdownTestId);
        if (!tuneId) {
          throw new Error(
            `Expected tuneId to be present on flashcard recall evaluation dropdown (data-testid=${String(
              dropdownTestId
            )})`
          );
        }

        const menu = this.page.getByTestId(`recall-eval-menu-${tuneId}`);

        // Under load (esp. Mobile Chrome), opening the dropdown can be flaky.
        // Retry a couple of times, and ensure the card back is revealed if needed.
        let menuOpened = false;
        for (let openAttempt = 0; openAttempt < 3; openAttempt++) {
          await evalButton.click({ trial: true, timeout: 5000 });
          await evalButton.click({ timeout: 5000 });

          try {
            await expect(menu).toBeVisible({ timeout: 4000 });
            menuOpened = true;
            break;
          } catch {
            try {
              await this.ensureReveal(true);
            } catch {}
            try {
              await this.page.keyboard.press("Escape");
            } catch {}
            await this.page.waitForTimeout(200);
          }
        }

        if (!menuOpened) {
          throw new Error(
            `Failed to open recall evaluation menu for tune ${tuneId}`
          );
        }

        const optionTestId = `recall-eval-option-${value}`;
        const option = menu.getByTestId(optionTestId);
        await expect(option).toBeVisible({ timeout: 5000 });
        await expect(option).toBeEnabled({ timeout: 5000 });

        await option.click({ trial: true, timeout: 5000 });
        await option.click({ timeout: 5000 });

        await expect(menu)
          .toBeHidden({ timeout: 5000 })
          .catch(() => undefined);

        const expectedLabel = value === "not-set" ? "(Not Set)" : `${value}:`;
        await expect
          .poll(async () => (await evalButton.textContent()) ?? "", {
            timeout: 8000,
            intervals: [100, 250, 500, 1000],
          })
          .toMatch(new RegExp(expectedLabel, "i"));
        break;
      } catch (err) {
        if (outerAttempt === nOuterAttempts - 1) throw err;
      }
    }
    if (typeof timeoutAfter === "number") {
      await this.page.waitForTimeout(timeoutAfter);
    }
  }

  async openFlashcardFieldsMenu() {
    // Mobile Chrome can be slow to attach/render the menu; retry a couple times.
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.practiceColumnsButton.scrollIntoViewIfNeeded();
      await expect(this.practiceColumnsButton).toBeVisible({ timeout: 5000 });
      await expect(this.practiceColumnsButton).toBeEnabled({ timeout: 5000 });
      await this.practiceColumnsButton.click();

      try {
        await expect(this.flashcardFieldsMenu).toBeVisible({ timeout: 6000 });
        return;
      } catch {
        // Back out and retry.
        try {
          await this.page.keyboard.press("Escape");
        } catch {}
        await this.page.waitForTimeout(300);
      }
    }

    // Last attempt: throw a useful assertion error.
    await expect(this.flashcardFieldsMenu).toBeVisible({ timeout: 6000 });
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
      if (desired) {
        await expect(checkbox).toBeChecked({ timeout: 3000 });
      } else {
        await expect(checkbox).not.toBeChecked({ timeout: 3000 });
      }
    }
    // Click outside to close menu (click Columns/Fields button again)
    await this.practiceColumnsButton.click();
    await expect(this.flashcardFieldsMenu)
      .toBeHidden({ timeout: 5000 })
      .catch(() => undefined);
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

  // ===== Notes Panel helpers =====

  /**
   * Get a note item by its ID
   */
  getNoteItem(noteId: string): Locator {
    return this.page.getByTestId(`note-item-${noteId}`);
  }

  /**
   * Get the drag handle for a specific note
   */
  getNoteDragHandle(noteId: string): Locator {
    return this.page.getByTestId(`note-drag-handle-${noteId}`);
  }

  /**
   * Get the edit button for a specific note
   */
  getNoteEditButton(noteId: string): Locator {
    return this.page.getByTestId(`note-edit-button-${noteId}`);
  }

  /**
   * Get the delete button for a specific note
   */
  getNoteDeleteButton(noteId: string): Locator {
    return this.page.getByTestId(`note-delete-button-${noteId}`);
  }

  /**
   * Get the content display for a specific note (read mode)
   */
  getNoteContent(noteId: string): Locator {
    return this.page.getByTestId(`note-content-${noteId}`);
  }

  /**
   * Get the editor container for a specific note (edit mode)
   */
  getNoteEditor(noteId: string): Locator {
    return this.page.getByTestId(`note-editor-${noteId}`);
  }

  /**
   * Get all note items in the list
   */
  getAllNoteItems(): Locator {
    return this.page.locator('[data-testid^="note-item-"]');
  }

  /**
   * Add a new note with the given content
   */
  async addNote(content: string) {
    await this.notesAddButton.click();
    await expect(this.notesNewEditor).toBeVisible({ timeout: 10000 });
    // Type into Jodit editor
    const joditEditor = this.notesNewEditor.locator(".jodit-wysiwyg");
    await joditEditor.click();
    await joditEditor.fill(content);

    // Poll until save button is enabled (editor may initialize asynchronously)
    const maxRetries = 500;
    const retryDelayMs = 10;
    let saveEnabled = false;
    for (let i = 0; i < maxRetries; i++) {
      saveEnabled = await this.notesSaveButton.isEnabled().catch(() => false);
      if (saveEnabled) break;
      await this.page.waitForTimeout(retryDelayMs);
    }
    if (!saveEnabled) {
      await this.page.screenshot({
        path: `test-results/notes-save-button-timeout-${Date.now()}.png`,
      });
      throw new Error(
        "Notes save button did not become enabled within timeout"
      );
    }

    await this.notesSaveButton.click();
    // Wait for Jodit editor to disappear indicating save completed
    await expect(joditEditor).not.toBeVisible({ timeout: 10000 });
    // await this.page.waitForLoadState("networkidle", { timeout: 15000 });
  }

  // ===== References Panel helpers =====

  /**
   * Get a reference item by its ID
   */
  getReferenceItem(referenceId: string): Locator {
    return this.page.getByTestId(`reference-item-${referenceId}`);
  }

  /**
   * Get the drag handle for a specific reference
   */
  getReferenceDragHandle(referenceId: string): Locator {
    return this.page.getByTestId(`reference-drag-handle-${referenceId}`);
  }

  /**
   * Get the edit button for a specific reference
   */
  getReferenceEditButton(referenceId: string): Locator {
    return this.page.getByTestId(`reference-edit-button-${referenceId}`);
  }

  /**
   * Get the delete button for a specific reference
   */
  getReferenceDeleteButton(referenceId: string): Locator {
    return this.page.getByTestId(`reference-delete-button-${referenceId}`);
  }

  /**
   * Get the link button for a specific reference
   */
  getReferenceLink(referenceId: string): Locator {
    return this.page.getByTestId(`reference-link-${referenceId}`);
  }

  /**
   * Get all reference items in the list
   */
  getAllReferenceItems(): Locator {
    return this.page.locator('[data-testid^="reference-item-"]');
  }

  /**
   * Add a new reference with the given URL
   */
  async addReference(
    url: string,
    options?: {
      title?: string;
      type?: string;
      comment?: string;
      favorite?: boolean;
    }
  ) {
    await this.referencesAddButton.click();
    await expect(this.referenceForm).toBeVisible({ timeout: 10000 });
    await this.referenceUrlInput.fill(url);
    if (options?.title) {
      await this.referenceTitleInput.fill(options.title);
    }
    if (options?.type) {
      await this.referenceTypeSelect.selectOption(options.type);
    }
    if (options?.comment) {
      await this.referenceCommentInput.fill(options.comment);
    }
    if (options?.favorite) {
      await this.referenceFavoriteCheckbox.check();
    }
    await this.referenceSubmitButton.click();
    await this.page.waitForLoadState("networkidle", { timeout: 15000 });
  }

  /**
   * Delete all notes from the currently selected tune.
   * Useful for test cleanup to ensure a clean state.
   */
  async deleteAllNotes() {
    // Wait for notes panel to be visible
    const notesPanel = this.page.getByTestId("notes-panel");
    await notesPanel.waitFor({ state: "visible", timeout: 5000 }).catch(() => {
      // Panel not visible - may be a different layout, skip
    });

    // Keep deleting notes until there are none left
    let maxIterations = 20; // Safety limit
    while (maxIterations > 0) {
      maxIterations--;

      // Find all delete buttons in notes panel
      const deleteButtons = notesPanel.locator(
        '[data-testid^="note-delete-button-"]'
      );
      const count = await deleteButtons.count();

      if (count === 0) {
        break; // No more notes to delete
      }

      const nativeDialog = this.page
        .waitForEvent("dialog", { timeout: 1000 })
        .catch(() => null);

      // Click the first delete button
      await deleteButtons.first().click();

      // Prefer the native dialog if it appears; otherwise use the in-app confirm dialog
      const dialog = await nativeDialog;
      if (dialog) {
        await dialog.accept();
      } else {
        const confirmDialog = this.page.getByTestId(
          "note-delete-confirm-dialog"
        );
        const confirmButton = this.page.getByTestId(
          "note-delete-confirm-submit"
        );

        await confirmDialog.waitFor({ state: "visible", timeout: 5000 });
        await confirmButton.click();
        await confirmDialog.waitFor({ state: "hidden", timeout: 5000 });
      }

      // Wait briefly for UI to settle
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Delete all references from the currently selected tune.
   * Useful for test cleanup to ensure a clean state.
   */
  async deleteAllReferences() {
    // Wait for references panel to be visible
    const refsPanel = this.page.getByTestId("references-panel");
    await refsPanel.waitFor({ state: "visible", timeout: 5000 }).catch(() => {
      // Panel not visible - may be a different layout, skip
    });

    // Keep deleting references until there are none left
    let maxIterations = 20; // Safety limit
    while (maxIterations > 0) {
      maxIterations--;

      // Find all delete buttons in references panel
      const deleteButtons = refsPanel.locator(
        '[data-testid^="reference-delete-button-"]'
      );
      const count = await deleteButtons.count();

      if (count === 0) {
        break; // No more references to delete
      }

      const nativeDialog = this.page
        .waitForEvent("dialog", { timeout: 1000 })
        .catch(() => null);

      // Click the first delete button
      await deleteButtons.first().click();

      const dialog = await nativeDialog;
      if (dialog) {
        await dialog.accept();
      } else {
        // Fallback if a custom dialog is introduced in the future
        const confirmButton = this.page
          .getByTestId("reference-delete-confirm-submit")
          .first();
        const confirmDialog = this.page.getByTestId(
          "reference-delete-confirm-dialog"
        );

        await Promise.all([
          confirmDialog
            .waitFor({ state: "visible", timeout: 5000 })
            .catch(() => {}),
          confirmButton
            .waitFor({ state: "visible", timeout: 5000 })
            .catch(() => {}),
        ]);

        if (await confirmButton.isVisible()) {
          await confirmButton.click();
          await confirmDialog
            .waitFor({ state: "hidden", timeout: 5000 })
            .catch(() => {});
        }
      }

      await this.page.waitForTimeout(300);
    }
  }

  async getSyncOutboxCount(): Promise<number> {
    return await this.page.evaluate(async () => {
      const api = (window as any).__ttTestApi;
      if (!api) throw new Error("__ttTestApi not available");
      return await api.getSyncOutboxCount();
    });
  }

  async getStableSyncOutboxCount(opts?: {
    timeoutMs?: number;
    stableForMs?: number;
    pollIntervalMs?: number;
  }): Promise<number> {
    const timeoutMs = opts?.timeoutMs ?? 5_000;
    const stableForMs = opts?.stableForMs ?? 1_000;
    const pollIntervalMs = opts?.pollIntervalMs ?? 250;

    const startMs = Date.now();
    let last = await this.getSyncOutboxCount();
    let stableMs = 0;

    while (Date.now() - startMs < timeoutMs) {
      await this.page.waitForTimeout(pollIntervalMs);
      const current = await this.getSyncOutboxCount();
      if (current === last) {
        stableMs += pollIntervalMs;
        if (stableMs >= stableForMs) return current;
      } else {
        last = current;
        stableMs = 0;
      }
    }

    return last;
  }
}
