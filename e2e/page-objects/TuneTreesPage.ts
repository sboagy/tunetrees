import { expect, type Locator, type Page } from "@playwright/test";
import { applyDeterministicFsrsConfig } from "../helpers/fsrs-test-config";
import {
  clearTunetreesClientStorage,
  gotoE2eOrigin,
} from "../helpers/local-db-lifecycle";
import { BASE_URL } from "../test-config";

declare global {
  interface Window {
    __ttTestUserId?: string;
  }
  // eslint-disable-next-line no-var
  var __ttTestUserId: string | undefined;
}

type TabType = "catalog" | "repertoire" | "practice";
type TabId = "practice" | "repertoire" | "catalog" | "analysis" | "setlists";

type OnboardingRepertoireArgs = {
  name?: string | null;
  default_genre?: string | null;
  instrument?: string | null;
  genres_filter?: string[] | null;
};

const OVERFLOW_MENU_MAX_RETRIES = 3;
const OVERFLOW_MENU_RETRY_DELAY_MS = 150;

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
  readonly setlistsTab: Locator;

  // TopNav Elements
  readonly logoDropdown: Locator;
  readonly logoDropdownButton: Locator;
  readonly logoDropdownPanel: Locator;
  readonly logoDropdownAboutButton: Locator;
  readonly logoDropdownWhatsNewLink: Locator;
  readonly repertoireDropdown: Locator;
  readonly repertoireDropdownButton: Locator;
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
  readonly aboutCreditsSection: Locator;
  readonly aboutWaveSurferCredit: Locator;
  readonly aboutWaveSurferLicense: Locator;
  readonly aboutGithubLink: Locator;
  readonly aboutDocsLink: Locator;
  readonly aboutCloseButton: Locator;

  // Grids
  readonly practiceGrid: Locator;
  readonly repertoireGrid: Locator;
  readonly catalogGrid: Locator;
  readonly setlistsViewGrid: Locator;
  readonly setlistsLibraryGrid: Locator;
  readonly setlistsEditorGrid: Locator;

  // Setlists
  readonly setlistsGroupSelect: Locator;
  readonly setlistsGroupSelectMobile: Locator;
  readonly setlistsSetlistSelect: Locator;
  readonly setlistsSetlistSelectMobile: Locator;
  readonly setlistsOverflowButton: Locator;
  readonly setlistsEditButton: Locator;
  readonly setlistsNewButton: Locator;
  readonly setlistsDoneEditingButton: Locator;
  readonly setlistsDeleteButton: Locator;
  readonly setlistsPrintButton: Locator;
  readonly setlistsEmailButton: Locator;
  readonly setlistsColumnsButton: Locator;
  readonly setlistsLibrarySearch: Locator;
  readonly setlistsAddSelectedButton: Locator;
  readonly setlistsRemoveSelectedButton: Locator;
  readonly setlistsExpandLibraryButton: Locator;
  readonly setlistBuildHeaderToggle: Locator;
  readonly setlistEditorNameInput: Locator;
  readonly setlistEditorNameInputCollapsed: Locator;
  readonly setlistEditorDescriptionInput: Locator;
  readonly setlistsLibraryColumnsButton: Locator;
  readonly setlistsEditorColumnsButton: Locator;
  readonly setlistsLibraryPanelOverflowButton: Locator;
  readonly setlistsSetlistPanelOverflowButton: Locator;
  readonly setlistsLibraryDisplayOptionsMenuButton: Locator;
  readonly setlistsEditorDisplayOptionsMenuButton: Locator;
  readonly setlistsLibraryHideDesktopButton: Locator;
  readonly setlistsLibraryHideButton: Locator;
  readonly setlistsLibraryEmptyState: Locator;
  readonly setlistsEditorEmptyState: Locator;
  readonly setlistsNoGroupEmptyState: Locator;
  readonly setlistsNoSetlistsEmptyState: Locator;
  readonly setlistsEmptyViewState: Locator;

  // Search & Filters
  readonly searchBox: Locator;
  readonly searchBoxPanel: Locator; // Toolbar search box (always visible; was formerly mobile-only)
  readonly filtersButton: Locator;
  readonly typeFilter: Locator;
  readonly modeFilter: Locator;
  readonly genreFilter: Locator;
  readonly tuneSetFilter: Locator;
  readonly tuneSetFilterMenu: Locator;
  readonly tuneSetFilterAnyOption: Locator;
  readonly repertoireFilter: Locator;
  readonly clearFilters: Locator;

  // Toolbar Buttons - Generic (may not work on all tabs/viewports)
  readonly addTuneButton: Locator; // Generic by title
  readonly deleteButton: Locator; // Generic by role
  readonly columnsButton: Locator; // Generic by role (label now always visible)

  // Tab-specific Toolbar Buttons (use these for reliable cross-viewport testing)
  readonly catalogAddTuneButton: Locator;
  readonly catalogColumnsButton: Locator;
  readonly catalogAddToRepertoireButton: Locator;
  readonly catalogDeleteButton: Locator;

  readonly repertoireAddTuneButton: Locator;
  readonly repertoireColumnsButton: Locator;
  readonly repertoireAddToReviewButton: Locator;
  readonly repertoireRemoveButton: Locator;
  readonly repertoireGroupSetsSwitch: Locator;

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

  readonly topNavManageRepertoiresPanel: Locator;

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
  readonly sidebarTuneInfoToggle: Locator;
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
  readonly referenceAudioSourceUploadButton: Locator;
  readonly referenceAudioSourceUrlButton: Locator;
  readonly referenceAudioChooseFileButton: Locator;
  readonly referenceAudioFileInput: Locator;
  readonly referenceAudioDropzone: Locator;
  readonly referenceAudioSelectedFile: Locator;
  readonly referenceSubmitButton: Locator;
  readonly referenceCancelButton: Locator;

  // Audio Player Overlay
  readonly audioPlayerOverlay: Locator;
  readonly audioPlayerTitle: Locator;
  readonly audioPlayerCloseButton: Locator;
  readonly audioPlayerPlayToggle: Locator;
  readonly audioPlayerTempoSlider: Locator;
  readonly audioPlayerZoomSlider: Locator;
  readonly audioPlayerZoomValue: Locator;
  readonly audioPlayerLoopToggle: Locator;
  readonly audioPlayerWaveform: Locator;
  readonly audioPlayerAddRegionButton: Locator;
  readonly audioPlayerAddBeatButton: Locator;
  readonly audioPlayerRegionList: Locator;

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
  readonly onboardingGenreCancelButton: Locator;
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
    this.setlistsTab = page.getByTestId("tab-setlists");

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
    this.repertoireDropdown = page.getByTestId("repertoire-dropdown");
    this.repertoireDropdownButton = page.getByTestId(
      "repertoire-dropdown-button"
    );
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
    this.aboutCreditsSection = page.getByTestId("about-credits-section");
    this.aboutWaveSurferCredit = page.getByTestId("about-credit-wavesurfer-js");
    this.aboutWaveSurferLicense = page.getByTestId(
      "about-license-wavesurfer-js"
    );
    this.aboutGithubLink = page.getByTestId("about-github-link");
    this.aboutDocsLink = page.getByTestId("about-docs-link");
    this.aboutCloseButton = page.getByTestId("about-close-button");

    // Grids - using data-testid matching tablePurpose prop
    this.practiceGrid = page.getByTestId("tunes-grid-scheduled");
    this.repertoireGrid = page.getByTestId("tunes-grid-repertoire");
    this.catalogGrid = page.getByTestId("tunes-grid-catalog");
    this.setlistsViewGrid = page.getByTestId("setlists-view-grid");
    this.setlistsLibraryGrid = page.getByTestId("setlists-library-grid");
    this.setlistsEditorGrid = page.getByTestId("setlists-editor-grid");

    this.setlistsGroupSelect = page.getByTestId("setlists-group-select");
    this.setlistsGroupSelectMobile = page.getByTestId(
      "setlists-group-select-mobile"
    );
    this.setlistsSetlistSelect = page.getByTestId("setlists-setlist-select");
    this.setlistsSetlistSelectMobile = page.getByTestId(
      "setlists-setlist-select-mobile"
    );
    this.setlistsOverflowButton = page.getByTestId("setlists-overflow-button");
    this.setlistsEditButton = page.getByTestId("setlists-edit-button");
    this.setlistsNewButton = page.getByTestId("setlists-new-button");
    this.setlistsDoneEditingButton = page.getByTestId(
      "setlists-done-editing-button"
    );
    this.setlistsDeleteButton = page.getByTestId("setlists-delete-button");
    this.setlistsPrintButton = page.getByTestId("setlists-print-button");
    this.setlistsEmailButton = page.getByTestId("setlists-email-button");
    this.setlistsColumnsButton = page.getByTestId("setlists-columns-button");
    this.setlistsLibrarySearch = page.getByTestId("setlists-library-search");
    this.setlistsAddSelectedButton = page.getByTestId(
      "setlists-add-selected-button"
    );
    this.setlistsRemoveSelectedButton = page.getByTestId(
      "setlists-remove-selected-button"
    );
    this.setlistsExpandLibraryButton = page.getByTestId(
      "setlists-expand-library-button"
    );
    this.setlistBuildHeaderToggle = page.getByTestId(
      "setlist-build-header-toggle"
    );
    this.setlistEditorNameInput = page.getByTestId("setlist-editor-name-input");
    this.setlistEditorNameInputCollapsed = page.getByTestId(
      "setlist-editor-name-input-collapsed"
    );
    this.setlistEditorDescriptionInput = page.getByTestId(
      "setlist-editor-description-input"
    );
    this.setlistsLibraryColumnsButton = page.getByTestId(
      "setlists-library-columns-button"
    );
    this.setlistsEditorColumnsButton = page.getByTestId(
      "setlists-editor-columns-button"
    );
    this.setlistsLibraryPanelOverflowButton = page.getByTestId(
      "setlists-library-panel-overflow-button"
    );
    this.setlistsSetlistPanelOverflowButton = page.getByTestId(
      "setlists-setlist-panel-overflow-button"
    );
    this.setlistsLibraryDisplayOptionsMenuButton = page.getByTestId(
      "setlists-library-display-options-menu-button"
    );
    this.setlistsEditorDisplayOptionsMenuButton = page.getByTestId(
      "setlists-editor-display-options-menu-button"
    );
    this.setlistsLibraryHideDesktopButton = page.getByTestId(
      "setlists-library-hide-button-desktop"
    );
    this.setlistsLibraryHideButton = page.getByTestId(
      "setlists-library-hide-button"
    );
    this.setlistsLibraryEmptyState = page.getByTestId(
      "setlists-library-empty-state"
    );
    this.setlistsEditorEmptyState = page.getByTestId(
      "setlists-editor-empty-state"
    );
    this.setlistsNoGroupEmptyState = page.getByTestId(
      "setlists-empty-state-no-group"
    );
    this.setlistsNoSetlistsEmptyState = page.getByTestId(
      "setlists-empty-state-no-setlists"
    );
    this.setlistsEmptyViewState = page.getByTestId(
      "setlists-empty-state-view-empty"
    );

    // Search & Filters
    this.searchBox = page.getByPlaceholder(/Search/i);
    this.searchBoxPanel = page.getByRole("textbox", {
      name: "Search tunes...",
    });
    this.filtersButton = page.getByTestId("filters-button");
    this.typeFilter = page.getByTestId("filter-dropdown-type");
    this.modeFilter = page.getByTestId("filter-dropdown-mode");
    this.genreFilter = page.getByTestId("filter-dropdown-genre");
    this.tuneSetFilter = page.getByTestId("filter-dropdown-tune-set");
    this.tuneSetFilterMenu = page.getByTestId("filter-dropdown-menu-tune-set");
    this.tuneSetFilterAnyOption = page.getByTestId(
      "filter-dropdown-tune-set-option-any"
    );
    this.repertoireFilter = page.locator(
      '[data-testid="filter-dropdown-repertoire"], [data-testid="filter-dropdown-repertoire"]'
    );
    this.clearFilters = page.getByRole("button", { name: /^Clear All/i });

    // Generic Toolbar Buttons (may not work reliably across tabs/viewports)
    this.addTuneButton = page.getByRole("button", { name: "Add a new tune" });
    this.deleteButton = page.getByRole("button", { name: /Delete/i });
    this.columnsButton = page.locator('[data-testid$="-columns-button"]');

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
    this.repertoireGroupSetsSwitch = page.getByTestId(
      "repertoire-group-sets-switch"
    );

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

    this.topNavManageRepertoiresPanel = page.getByTestId(
      "top-nav-manage-repertoires-panel"
    );

    // Tune Editor
    this.tuneEditorForm = page.getByTestId("tune-editor-form");
    this.tuneEditorSubmitButton = page.getByTestId("tune-editor-save-button");
    this.tuneEditorCancelButton = page.getByTestId("tune-editor-cancel-button");
    // REFACTOR: Global show-public-toggle removed. Tests use per-field override indicators instead.
    this.showPublicToggle = page.getByTestId("override-indicator-title");
    this.userSettingsButton = page.getByTestId("user-settings-button");

    this.userSettingsCatalogSyncButton = page.getByTestId(
      "settings-tab-catalog-sync"
    );
    this.userSettingsSchedulingOptionsButton = page.getByTestId(
      "settings-tab-scheduling-options"
    );
    this.userSettingsSpacedRepetitionButton = page.getByTestId(
      "settings-tab-spaced-repetition"
    );
    this.userSettingsAccountButton = page.getByTestId("settings-tab-account");
    this.userSettingsAvatarButton = page.getByTestId("settings-tab-avatar");

    this.settingsMenuToggle = page.getByTestId("settings-menu-toggle");

    // Dialogs
    // Match either explicit test id (if component provides it) or the role-based alertdialog
    // this.addTuneDialog = page.locator('[data-testid="add-tune-dialog"], [role="alertdialog"]');
    this.addTuneDialog = page.getByTestId("add-tune-dialog");

    // Match either expanded or collapsed sidebar edit button with a single locator
    this.sidebarEditTuneButton = page
      .getByTestId(/^sidebar-edit-tune-button(?:-collapsed)?$/)
      .last();
    this.sidebarTuneInfoToggle = page.getByTestId("sidebar-tune-info-toggle");

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
    this.referenceAudioSourceUploadButton = page.getByTestId(
      "reference-audio-source-upload-button"
    );
    this.referenceAudioSourceUrlButton = page.getByTestId(
      "reference-audio-source-url-button"
    );
    this.referenceAudioChooseFileButton = page.getByTestId(
      "reference-audio-choose-file-button"
    );
    this.referenceAudioFileInput = page.getByTestId(
      "reference-audio-file-input"
    );
    this.referenceAudioDropzone = page.getByTestId("reference-audio-dropzone");
    this.referenceAudioSelectedFile = page.getByTestId(
      "reference-audio-selected-file"
    );
    this.referenceSubmitButton = page.getByTestId("reference-submit-button");
    this.referenceCancelButton = page.getByTestId("reference-cancel-button");

    this.audioPlayerOverlay = page.getByTestId("audio-player-overlay");
    this.audioPlayerTitle = page.getByTestId("audio-player-title");
    this.audioPlayerCloseButton = page.getByTestId("audio-player-close-button");
    this.audioPlayerPlayToggle = page.getByTestId("audio-player-play-toggle");
    this.audioPlayerTempoSlider = page.getByTestId("audio-player-tempo-slider");
    this.audioPlayerZoomSlider = page.getByTestId("audio-player-zoom-slider");
    this.audioPlayerZoomValue = page.getByTestId("audio-player-zoom-value");
    this.audioPlayerLoopToggle = page.getByTestId("audio-player-loop-toggle");
    this.audioPlayerWaveform = page.getByTestId("audio-player-waveform");
    this.audioPlayerAddRegionButton = page.getByTestId(
      "audio-player-add-region-button"
    );
    this.audioPlayerAddBeatButton = page.getByTestId(
      "audio-player-add-beat-button"
    );
    this.audioPlayerRegionList = page.getByTestId("audio-player-region-list");

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

    this.dateRolloverRefreshButton = page.getByTestId(
      "date-rollover-refresh-button"
    );
    // Legacy property name retained for tests that only care about visibility.
    this.dateRolloverBanner = this.dateRolloverRefreshButton;

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
    this.onboardingGenreCancelButton = page.getByTestId(
      "onboarding-genre-cancel"
    );
    this.onboardingGenreContinueButton = page.getByTestId(
      "onboarding-genre-continue"
    );
    this.onboardingGenreCheckboxes = page
      .getByTestId("onboarding-genre")
      .locator("input[type='checkbox']");

    // Error Display
    this.authErrorMessage = page.locator(
      String.raw`.bg-red-50, .bg-red-900\/20`
    );

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
        await this.completeOnboardingWithRepertoireConfig(repertoire);
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
   * Sign in anonymously and complete onboarding by creating a repertoire.
   * Use this when tests need to interact with repertoire functionality.
   *
   * @param repertoireName - Name for the new repertoire (default: "Test Repertoire")
   */
  async signInAnonymouslyWithRepertoire(repertoireName = "Test Repertoire") {
    await this.signInAnonymously({ name: repertoireName });
  }

  /**
   * Sign in anonymously and stop at the genre selection onboarding step.
   */
  async signInAnonymouslyToGenreSelection(repertoireName = "Test Repertoire") {
    await this.anonymousSignInButton.click();
    // Wait for redirect to home and app to load
    await this.page.waitForURL(/\/$|\/\?/, { timeout: 15000 });

    // Wait longer for database initialization and onboarding check
    await this.page.waitForTimeout(1500);

    await this.startOnboardingWithRepertoire(repertoireName);
    await expect(this.onboardingChooseGenresHeading).toBeVisible({
      timeout: 15000,
    });
    await expect(this.onboardingGenreSearchInput).toBeVisible({
      timeout: 15000,
    });
  }

  getOnboardingStarterCard(templateId: string): Locator {
    return this.page.getByTestId(`onboarding-starter-${templateId}`);
  }

  async chooseStarterTemplate(templateId: string) {
    const card = this.getOnboardingStarterCard(templateId);
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click({ timeout: 5000 });
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
    // In the new onboarding design, Step 1 is shown inline in the empty-state
    // panel (not a blocking modal overlay). Only Steps 2 and 3 render as modal
    // overlays that need active dismissal. This method handles those two cases
    // quickly and without crashing if the page navigates mid-wait.

    try {
      // Brief wait for any async onboarding trigger to fire.
      await this.page.waitForTimeout(500);

      // Step 2: Genre selection dialog — cancel it if open.
      const genreHeading = this.page.getByRole("heading", {
        name: /Choose additional genres to download/i,
      });
      if (await genreHeading.isVisible().catch(() => false)) {
        const cancelButton = this.page.getByTestId("onboarding-genre-cancel");
        if (await cancelButton.isVisible().catch(() => false)) {
          await cancelButton.click({ timeout: 2000 }).catch(() => {});
          await genreHeading
            .waitFor({ state: "hidden", timeout: 3000 })
            .catch(() => {});
        }
        return;
      }

      // Step 3: "Add some tunes" / view-catalog overlay — click Got it! or Skip.
      const step3Heading = this.page.getByRole("heading", {
        name: /add some tunes/i,
      });
      if (await step3Heading.isVisible().catch(() => false)) {
        const gotItButton = this.page.getByRole("button", {
          name: /got it!/i,
        });
        const skipButton = this.page.getByRole("button", {
          name: /skip tour/i,
        });
        if (await gotItButton.isVisible().catch(() => false)) {
          await gotItButton.click({ timeout: 2000 }).catch(() => {});
        } else if (await skipButton.isVisible().catch(() => false)) {
          await skipButton.click({ timeout: 2000 }).catch(() => {});
        }
        await step3Heading
          .waitFor({ state: "hidden", timeout: 3000 })
          .catch(() => {});
        return;
      }

      // No blocking modal overlay — the empty-state panel is inline and
      // non-blocking, so nothing needs to be dismissed.
    } catch {
      // Ignore any errors from page navigation / browser closure.
    }
  }

  /**
   * Complete onboarding by creating a repertoire (instead of skipping).
   * This is required for tests that need to use repertoire functionality.
   *
   * @param repertoireName - Name for the new repertoire (default: "Test Repertoire")
   */
  async completeOnboardingWithRepertoire(repertoireName = "Test Repertoire") {
    await this.completeOnboardingWithRepertoireConfig({ name: repertoireName });
  }

  private async completeOnboardingWithRepertoireConfig(
    opts: OnboardingRepertoireArgs
  ): Promise<boolean> {
    const repertoireName = opts.name?.trim() || "Test Repertoire";
    const didStart = await this.startOnboardingWithRepertoire(
      repertoireName,
      opts
    );
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
      // Only click "Clear all" if it's enabled — the dialog may open with no
      // genres pre-selected, in which case the button is correctly disabled.
      const clearEnabled = await this.onboardingGenreClearAllButton
        .isEnabled()
        .catch(() => false);
      if (clearEnabled) {
        await this.onboardingGenreClearAllButton.click({ timeout: 3000 });
      }
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
   * Start onboarding by creating a repertoire. Returns true if onboarding was shown.
   */
  private async startOnboardingWithRepertoire(
    repertoireName = "Test Repertoire",
    opts?: OnboardingRepertoireArgs
  ): Promise<boolean> {
    // Wait for the app to potentially show onboarding (600ms delay + buffer)
    await this.page.waitForTimeout(1000);

    const isVisible = await this.onboardingWelcomeHeading
      .isVisible()
      .catch(() => false);

    if (!isVisible) return false;

    // Click "Create Repertoire" button to open the repertoire editor dialog
    await this.onboardingCreateRepertoireButton.click({ timeout: 3000 });

    // Wait for repertoire editor dialog to appear
    const repertoireDialog = this.page.getByTestId("repertoire-editor-dialog");
    await repertoireDialog.waitFor({ state: "visible", timeout: 5000 });

    // Fill in the repertoire name
    const nameInput = repertoireDialog.getByLabel(/Repertoire Name|Name/i);
    await nameInput.fill(repertoireName);

    const defaultGenre = opts?.default_genre?.trim();
    if (defaultGenre) {
      const genreSelect = repertoireDialog.locator("#genre-default");
      await this.selectOptionByTextOrValue(genreSelect, defaultGenre);
    }

    const instrument = opts?.instrument?.trim();
    if (instrument) {
      const instrumentSelect = repertoireDialog.locator("#instrument-ref");
      await this.selectOptionByTextOrValue(instrumentSelect, instrument);
    }

    // Click "Create" or "Save" button
    const saveButton = repertoireDialog.getByTestId("save-repertoire-button");
    await saveButton.click({ timeout: 3000 });

    // Wait for dialog to close
    await repertoireDialog.waitFor({ state: "hidden", timeout: 5000 });
    return true;
  }

  private async selectOptionByTextOrValue(
    select: Locator,
    desired: string
  ): Promise<boolean> {
    const desiredNormalized = desired.trim().toLowerCase();
    const options = select.locator("option");

    await expect
      .poll(
        async () => {
          const count = await options.count();

          for (let i = 0; i < count; i++) {
            const option = options.nth(i);
            const value = (await option.getAttribute("value"))?.trim();
            const label = (await option.textContent())?.trim();

            if (value?.toLowerCase() === desiredNormalized) {
              return true;
            }

            if (label?.toLowerCase().includes(desiredNormalized)) {
              return true;
            }
          }

          return false;
        },
        {
          timeout: 10000,
          intervals: [100, 250, 500, 1000],
        }
      )
      .toBe(true);

    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const option = options.nth(i);
      const value = (await option.getAttribute("value"))?.trim();
      const label = (await option.textContent())?.trim();

      if (value?.toLowerCase() === desiredNormalized) {
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
   * Dispatch an HTML5 drag sequence directly. This is more reliable than
   * Locator.dragTo() for mobile emulation when the app listens to
   * dragstart/dragover/drop on draggable elements.
   */
  async dispatchHtml5DragAndDrop(source: Locator, target: Locator) {
    await expect(source).toBeVisible({ timeout: 10000 });
    await expect(target).toBeVisible({ timeout: 10000 });
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();

    const dataTransfer = await this.page.evaluateHandle(
      () => new DataTransfer()
    );

    await source.dispatchEvent("dragstart", { dataTransfer });
    await target.dispatchEvent("dragenter", { dataTransfer });
    await target.dispatchEvent("dragover", { dataTransfer });
    await target.dispatchEvent("drop", { dataTransfer });
    await source.dispatchEvent("dragend", { dataTransfer });
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

  private async waitForLoginConfirmation(
    email: string,
    maxAttempts: number
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const practiceTabVisible = await this.practiceTab
        .isVisible()
        .catch(() => false);
      if (practiceTabVisible) {
        console.log(`Practice tab visible after login, logged in as ${email}`);
        return;
      }
      await this.page.waitForTimeout(1000);
    }

    // Failed to see practice tab after login - attach diagnostics
    await this.page.screenshot(); // Captured for debugging
    console.log("Login failure - screenshot captured");
    console.log("Login failure - page content available via page.content()");

    throw new Error(
      `Unable to log in as ${email} after multiple attempts. Check console for diagnostics.`
    );
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
      globalThis.__ttTestUserId = userId;
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
            throw new Error(
              "ALICE_TEST_PASSWORD must be set in the environment"
            );
          }
        }
        await this.emailInput.fill(email);
        await this.page.locator('input[type="password"]').fill(password);
        await this.signInButton.click();

        // Wait for practice tab to appear after login
        await this.waitForLoginConfirmation(email, maxAttempts);
        return;
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
   * Refresh the practice queue when the rollover action is visible.
   * Returns true when a refresh was triggered.
   *
   * If we want the cleanest long-term shape, this helper should be split
   * into a pure predicate plus an explicit refresh action, so tests have
   * to decide which behavior they expect instead of letting the page object
   * decide for them. For now, this is a single method for simplicity's sake
   * is "good enough".
   */
  async refreshDateRolloverIfVisible(timeoutMs = 20000): Promise<boolean> {
    // After reload + sync, the rollover refresh can appear slightly after the
    // main practice chrome. Give it a short grace period before deciding there
    // is nothing to refresh.
    const appearanceTimeoutMs = Math.min(timeoutMs, 2500);
    const appearanceDeadline = Date.now() + appearanceTimeoutMs;
    let bannerVisible = await this.dateRolloverRefreshButton
      .isVisible()
      .catch(() => false);

    while (!bannerVisible && Date.now() < appearanceDeadline) {
      await this.page.waitForTimeout(100);
      bannerVisible = await this.dateRolloverRefreshButton
        .isVisible()
        .catch(() => false);
    }

    if (!bannerVisible) {
      return false;
    }

    await expect(this.dateRolloverRefreshButton).toBeVisible({
      timeout: timeoutMs,
    });
    await expect(this.dateRolloverRefreshButton).toBeEnabled({
      timeout: timeoutMs,
    });
    await this.dateRolloverRefreshButton.click();
    await expect
      .poll(
        async () => {
          const visible = await this.dateRolloverRefreshButton
            .isVisible()
            .catch(() => false);
          if (!visible) {
            return "hidden";
          }

          const enabled = await this.dateRolloverRefreshButton
            .isEnabled()
            .catch(() => false);
          return enabled ? "enabled" : "disabled";
        },
        {
          timeout: timeoutMs,
          intervals: [100, 250, 500, 1000],
        }
      )
      .not.toBe("enabled");
    await expect(this.dateRolloverRefreshButton).toBeHidden({
      timeout: timeoutMs,
    });
    return true;
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
      repertoireSize?: number;
      enableFuzz?: boolean;
      maxReviews?: number;
      scheduleNewTunesAutomatically?: boolean;
    } = {}
  ) {
    const config = {
      repertoireSize: overrides.repertoireSize ?? this.REPERTOIRE_SIZE,
      enableFuzz: overrides.enableFuzz ?? this.ENABLE_FUZZ,
      maxReviews: overrides.maxReviews ?? this.MAX_DAILY_TUNES,
      scheduleNewTunesAutomatically:
        overrides.scheduleNewTunesAutomatically ??
        this.SCHEDULE_NEW_TUNES_AUTOMATICALLY,
    };

    await applyDeterministicFsrsConfig(this.page, config);
  }

  /**
   * Open the sidebar tune editor for currently selected tune and wait until core inputs are visible.
   * Avoids Playwright's networkidle which can hang due to persistent websocket connections.
   */
  async openTuneEditor() {
    await this.ensureTuneInfoExpanded({ timeoutMs: 10000 });
    await expect(this.sidebarEditTuneButton).toBeVisible({ timeout: 10000 });
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
   * Ensure the mobile-only Tune Info accordion is expanded before interacting
   * with controls rendered inside TuneInfoHeader. No-op on desktop/side dock.
   */
  async ensureTuneInfoExpanded(opts?: { timeoutMs?: number }) {
    const timeoutMs = opts?.timeoutMs ?? 8000;

    await this.ensureSidebarExpanded({ timeoutMs });

    const tuneInfoButton = this.sidebarTuneInfoToggle;

    const toggleVisible = await tuneInfoButton
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!toggleVisible) return;

    const ariaExpanded = await tuneInfoButton
      .getAttribute("aria-expanded")
      .catch(() => null);
    if (ariaExpanded === "true") return;

    await tuneInfoButton.scrollIntoViewIfNeeded().catch(() => undefined);
    await expect(tuneInfoButton).toBeVisible({ timeout: timeoutMs });
    await expect(tuneInfoButton).toBeEnabled({ timeout: timeoutMs });
    await tuneInfoButton.click({ timeout: timeoutMs });

    await expect(tuneInfoButton).toHaveAttribute("aria-expanded", "true", {
      timeout: timeoutMs,
    });
    await this.page.waitForTimeout(150);
  }

  /**
   * Navigate to app and wait for initial load
   */
  async goto(url = `${BASE_URL}`) {
    await this.page.goto(url);
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(2000); // Allow sync to start
  }

  async getColumnIndexByHeaderTextViaLocator(
    gridLocator: Locator,
    columnHeaderText: string
  ) {
    const headers = gridLocator.locator("thead th");
    const headerTexts = await headers.allTextContents();
    const columnIndex = headerTexts.findIndex((text) =>
      new RegExp(columnHeaderText, "i").test(text)
    );

    // Allow -1 as a return
    return columnIndex;
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
  async navigateToTab(tabId: TabId, options?: { waitForContent?: boolean }) {
    const selectTrigger = this.page.getByTestId("tab-nav-select");
    const isSelectVisible = await selectTrigger.isVisible().catch(() => false);

    if (isSelectVisible) {
      await this.navigateToTabMobile(tabId, selectTrigger);
    } else {
      await this.navigateToTabDesktop(tabId);
    }

    if (!(options?.waitForContent ?? true)) {
      return;
    }
    await this.waitForTabContent(tabId);
  }

  private async navigateToTabMobile(tabId: TabId, selectTrigger: Locator) {
    const currentUrl = this.page.url();
    const currentTab =
      new URL(currentUrl).searchParams.get("tab") || "practice";

    if (currentTab === tabId) return;

    await this.dismissVisibleToasts();

    await expect(selectTrigger).toBeEnabled({ timeout: 20_000 });
    await selectTrigger.click({ timeout: 10_000 });

    const tabLabels: Record<string, string> = {
      practice: "Practice",
      repertoire: "Repertoire",
      catalog: "Catalog",
      analysis: "Analysis",
      setlists: "Setlists",
    };
    const option = this.page.getByRole("option", {
      name: new RegExp(tabLabels[tabId], "i"),
    });
    await expect(option).toBeVisible({ timeout: 5_000 });
    await option.click({ timeout: 5_000 });

    await expect(this.page).toHaveURL(new RegExp(`[?&]tab=${tabId}`), {
      timeout: 10_000,
    });
  }

  private async navigateToTabDesktop(tabId: TabId) {
    const tab = this.page.getByTestId(`tab-${tabId}`);
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await expect(tab).toBeEnabled({ timeout: 20_000 });

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

    // The URL is the authoritative source of tab state in Home.tsx.
    await expect
      .poll(
        async () => {
          const urlMatches = (() => {
            try {
              const currentUrl = new URL(this.page.url());
              return (
                (currentUrl.searchParams.get("tab") || "practice") === tabId
              );
            } catch {
              return false;
            }
          })();
          if (urlMatches) return true;

          const [selected, current] = await Promise.all([
            tab.getAttribute("aria-selected"),
            tab.getAttribute("aria-current"),
          ]);
          return selected === "true" || current === "page";
        },
        { timeout: 10_000, intervals: [100, 250, 500, 1000] }
      )
      .toBe(true);
  }

  private async waitForTabContent(tabId: TabId) {
    const sentinel = this.getSentinelForTab(tabId);
    if (sentinel) {
      await sentinel.scrollIntoViewIfNeeded().catch(() => undefined);
      await expect(sentinel)
        .toBeVisible({ timeout: 5_000 })
        .catch(() => undefined);
    }

    const grid = this.getGridForTabId(tabId);
    if (!grid) return;

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
      await expect(grid)
        .toBeVisible({ timeout: 20_000 })
        .catch(() => undefined);
    }
  }

  async navigateToSetlistsTab(options?: { waitForContent?: boolean }) {
    await this.navigateToTab("setlists", {
      waitForContent: options?.waitForContent ?? false,
    });

    const visibleGroupSelect = await this.getVisibleSetlistsGroupSelect();
    await expect(visibleGroupSelect).toBeVisible({ timeout: 15000 });
  }

  private async getVisibleSetlistsGroupSelect(): Promise<Locator> {
    const desktopVisible = await this.setlistsGroupSelect
      .isVisible()
      .catch(() => false);
    return desktopVisible
      ? this.setlistsGroupSelect
      : this.setlistsGroupSelectMobile;
  }

  private async getVisibleSetlistsSetlistSelect(): Promise<Locator> {
    const desktopVisible = await this.setlistsSetlistSelect
      .isVisible()
      .catch(() => false);
    return desktopVisible
      ? this.setlistsSetlistSelect
      : this.setlistsSetlistSelectMobile;
  }

  async selectSetlistsGroup(valueOrLabel: string) {
    const select = await this.getVisibleSetlistsGroupSelect();
    await expect(select).toBeVisible({ timeout: 15000 });
    await select.selectOption({ label: valueOrLabel }).catch(async () => {
      await select.selectOption(valueOrLabel);
    });
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => undefined);
  }

  async selectSetlist(valueOrLabel: string) {
    const select = await this.getVisibleSetlistsSetlistSelect();
    await expect(select).toBeVisible({ timeout: 15000 });
    await select.selectOption({ label: valueOrLabel }).catch(async () => {
      await select.selectOption(valueOrLabel);
    });
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => undefined);
  }

  async getSelectedSetlistsGroupLabel() {
    const select = await this.getVisibleSetlistsGroupSelect();
    return (await select.locator("option:checked").textContent())?.trim() ?? "";
  }

  async getSelectedSetlistsGroupValue() {
    const select = await this.getVisibleSetlistsGroupSelect();
    return (await select.inputValue().catch(() => "")) ?? "";
  }

  async getSelectedSetlistLabel() {
    const select = await this.getVisibleSetlistsSetlistSelect();
    return (await select.locator("option:checked").textContent())?.trim() ?? "";
  }

  async getSelectedSetlistValue() {
    const select = await this.getVisibleSetlistsSetlistSelect();
    return (await select.inputValue().catch(() => "")) ?? "";
  }

  async clickSetlistsEdit() {
    const desktopVisible = await this.setlistsEditButton
      .isVisible()
      .catch(() => false);
    if (desktopVisible) {
      await this.setlistsEditButton.click();
      return;
    }

    await this.openOverflowMenuEntry(
      this.setlistsOverflowButton,
      this.page.getByTestId("setlists-overflow-edit-button")
    );
    await this.page.getByTestId("setlists-overflow-edit-button").click();
  }

  async clickSetlistsNew() {
    const desktopVisible = await this.setlistsNewButton
      .isVisible()
      .catch(() => false);
    if (desktopVisible) {
      await this.setlistsNewButton.click();
      return;
    }

    await this.openOverflowMenuEntry(
      this.setlistsOverflowButton,
      this.page.getByTestId("setlists-overflow-new-button")
    );
    await this.page.getByTestId("setlists-overflow-new-button").click();
  }

  async clickSetlistsDoneEditing() {
    const desktopVisible = await this.setlistsDoneEditingButton
      .isVisible()
      .catch(() => false);
    if (desktopVisible) {
      await this.setlistsDoneEditingButton.click();
      return;
    }

    await this.openOverflowMenuEntry(
      this.setlistsOverflowButton,
      this.page.getByTestId("setlists-overflow-done-button")
    );
    await this.page.getByTestId("setlists-overflow-done-button").click();
  }

  async clickSetlistsDelete() {
    const desktopVisible = await this.setlistsDeleteButton
      .isVisible()
      .catch(() => false);
    if (desktopVisible) {
      await this.setlistsDeleteButton.click();
      return;
    }

    await this.openOverflowMenuEntry(
      this.setlistsOverflowButton,
      this.page.getByTestId("setlists-overflow-delete-button")
    );
    await this.page.getByTestId("setlists-overflow-delete-button").click();
  }

  async setSetlistName(name: string) {
    const expandedVisible = await this.setlistEditorNameInput
      .isVisible()
      .catch(() => false);
    const input = expandedVisible
      ? this.setlistEditorNameInput
      : this.setlistEditorNameInputCollapsed;
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill(name);
  }

  async setSetlistNotes(notes: string) {
    const visible = await this.setlistEditorDescriptionInput
      .isVisible()
      .catch(() => false);
    if (!visible) {
      await this.setlistBuildHeaderToggle.click();
    }
    await expect(this.setlistEditorDescriptionInput).toBeVisible({
      timeout: 5000,
    });
    await this.setlistEditorDescriptionInput.fill(notes);
  }

  async searchSetlistsLibrary(query: string) {
    await expect(this.setlistsLibrarySearch).toBeVisible({ timeout: 5000 });
    await this.setlistsLibrarySearch.fill(query);
  }

  async waitForSetlistsEditReady() {
    await expect(this.setlistsLibraryGrid).toBeVisible({ timeout: 15000 });
    await expect(this.setlistsEditorGrid).toBeVisible({ timeout: 15000 });
    await this.page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => undefined);
  }

  async setSetlistsLibraryFilter(filter: "all" | "tune" | "tune_set") {
    const desktopButton = this.page.getByTestId(
      `setlists-library-filter-${filter}`
    );
    const desktopVisible = await desktopButton.isVisible().catch(() => false);
    if (desktopVisible) {
      await desktopButton.click();
      return;
    }

    const menuButton = this.page.getByTestId(
      `setlists-library-filter-menu-${filter}`
    );
    await this.openOverflowMenuEntry(
      this.setlistsLibraryPanelOverflowButton,
      menuButton
    );
    await menuButton.click();
  }

  getSetlistsViewRow(title: string): Locator {
    return this.setlistsViewGrid
      .locator(
        "[data-testid='setlist-item-row'], [data-testid^='stacked-item-']"
      )
      .filter({ hasText: title })
      .first();
  }

  getSetlistsLibraryRow(title: string): Locator {
    return this.setlistsLibraryGrid
      .locator(
        "[data-testid='setlists-library-row'], [data-testid^='stacked-item-']"
      )
      .filter({ hasText: title })
      .first();
  }

  getSetlistsLibrarySetRow(title: string): Locator {
    return this.setlistsLibraryGrid
      .locator(
        "[data-testid='setlists-library-set-row'], [data-testid^='stacked-item-']"
      )
      .filter({ hasText: title })
      .first();
  }

  getSetlistsEditorRow(title: string): Locator {
    return this.setlistsEditorGrid
      .locator(
        "[data-testid='setlist-editor-item-row'], [data-testid^='stacked-item-']"
      )
      .filter({ hasText: title })
      .first();
  }

  async setRowSelected(row: Locator, selected: boolean) {
    const checkbox = row.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible({ timeout: 5000 });
    if ((await checkbox.isChecked().catch(() => false)) !== selected) {
      await checkbox.click();
    }
  }

  async clickAddSelectedSetlistItems() {
    await expect(this.setlistsAddSelectedButton).toBeVisible({ timeout: 5000 });
    await this.setlistsAddSelectedButton.click();
  }

  async clickRemoveSelectedSetlistItems() {
    const desktopVisible = await this.setlistsRemoveSelectedButton
      .isVisible()
      .catch(() => false);
    if (desktopVisible) {
      await this.setlistsRemoveSelectedButton.click();
      return;
    }

    await this.openOverflowMenuEntry(
      this.setlistsSetlistPanelOverflowButton,
      this.page.getByTestId("setlists-remove-selected-menu-button")
    );
    await this.page.getByTestId("setlists-remove-selected-menu-button").click();
  }

  async toggleSetlistsMetadata() {
    await expect(this.setlistBuildHeaderToggle.first()).toBeVisible({
      timeout: 5000,
    });
    await this.setlistBuildHeaderToggle.first().click();
  }

  async hideSetlistsLibraryPanel() {
    const desktopVisible = await this.setlistsLibraryHideDesktopButton
      .isVisible()
      .catch(() => false);
    if (desktopVisible) {
      await this.setlistsLibraryHideDesktopButton.click();
      return;
    }

    await this.openOverflowMenuEntry(
      this.setlistsLibraryPanelOverflowButton,
      this.setlistsLibraryHideButton
    );
    await this.setlistsLibraryHideButton.click();
  }

  async showSetlistsLibraryPanel() {
    await expect(this.setlistsExpandLibraryButton).toBeVisible({
      timeout: 5000,
    });
    await this.setlistsExpandLibraryButton.click();
  }

  async setSetlistsColumnVisibility(
    scope: "view" | "library" | "editor",
    columnLabel: string,
    visible: boolean
  ) {
    await this.openSetlistsColumnVisibilityMenu(scope);

    const escapedLabel = columnLabel.replace(
      /[.*+?^${}()|[\]\\]/g,
      String.raw`\$&`
    );

    const menu = this.getColumnVisibilityMenu();
    const label = menu
      .locator("button span")
      .filter({ hasText: new RegExp(String.raw`^\s*${escapedLabel}\s*$`, "i") })
      .first();
    const option = label.locator("xpath=ancestor::button[1]");
    const checkbox = option.locator('input[type="checkbox"]').first();

    await expect(option).toBeVisible({ timeout: 5000 });
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (isChecked !== visible) {
      await option.click();
    }

    if (visible) {
      await expect(checkbox).toBeChecked({ timeout: 5000 });
    } else {
      await expect(checkbox).not.toBeChecked({ timeout: 5000 });
    }

    await this.closeColumnVisibilityMenu(menu);
  }

  async openSetlistsColumnVisibilityMenu(scope: "view" | "library" | "editor") {
    if (scope === "view") {
      const viewButtonVisible = await this.setlistsColumnsButton
        .isVisible()
        .catch(() => false);
      await this.openColumnVisibilityMenu(
        viewButtonVisible
          ? this.setlistsColumnsButton
          : this.setlistsOverflowButton
      );
      return;
    }

    if (scope === "library") {
      const desktopVisible = await this.setlistsLibraryColumnsButton
        .isVisible()
        .catch(() => false);

      if (desktopVisible) {
        await this.openColumnVisibilityMenu(this.setlistsLibraryColumnsButton);
      } else {
        await this.openOverflowMenuEntry(
          this.setlistsLibraryPanelOverflowButton,
          this.setlistsLibraryDisplayOptionsMenuButton
        );
        await this.setlistsLibraryDisplayOptionsMenuButton.click();
        await expect(this.getColumnVisibilityMenu()).toBeVisible({
          timeout: 5000,
        });
      }
      return;
    }

    const desktopVisible = await this.setlistsEditorColumnsButton
      .isVisible()
      .catch(() => false);

    if (desktopVisible) {
      await this.openColumnVisibilityMenu(this.setlistsEditorColumnsButton);
    } else {
      await this.openOverflowMenuEntry(
        this.setlistsSetlistPanelOverflowButton,
        this.setlistsEditorDisplayOptionsMenuButton
      );
      await this.setlistsEditorDisplayOptionsMenuButton.click();
      await expect(this.getColumnVisibilityMenu()).toBeVisible({
        timeout: 5000,
      });
    }
  }

  async moveSetlistEditorRowDown(title: string) {
    const row = this.getSetlistsEditorRow(title);
    const dragHandle = row
      .locator("[data-testid='setlist-editor-drag-handle']")
      .first();

    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(dragHandle).toBeVisible({ timeout: 10000 });

    await dragHandle.focus();
    await dragHandle.press("ArrowDown");
  }

  /**
   * Search for a tune and wait for results
   * Returns the grid for further assertions
   * The search box is now always visible in the toolbar (desktop and mobile).
   */
  async searchForTune(tuneTitle: string, grid: Locator): Promise<void> {
    // Check if toolbar search box is visible (should always be true now)
    const isToolbarSearchVisible = await (async () => {
      const blockStartMs = Date.now();
      try {
        const timeoutMs = 5000;
        const pollIntervalMs = 250;
        const startMs = Date.now();

        // Poll until toolbar search appears (desktop) or filter button appears (mobile).
        // Early exit if filter button is visible, indicating mobile layout.
        while (Date.now() - startMs < timeoutMs) {
          const visible = await this.searchBox
            .isVisible({ timeout: 250 })
            .catch(() => false);
          if (visible) return true;
          // If the filter button is visible already, we should be in mobile view,
          // so go ahead and take this as a quick indication that we're in mobile view
          // and exit the loop early.
          const filtersVisible = await this.filtersButton
            .isVisible({ timeout: 250 })
            .catch(() => false);
          if (filtersVisible) return false;
          await this.page.waitForTimeout(pollIntervalMs);
        }

        return false;
      } finally {
        const elapsedMs = Date.now() - blockStartMs;
        console.log(
          `[searchForTune] toolbar search visibility check took ${elapsedMs}ms`
        );
      }
    })();

    if (isToolbarSearchVisible) {
      // Desktop: use toolbar search box
      await this.searchBox.scrollIntoViewIfNeeded().catch(() => undefined);
      await this.searchBox.isEditable({ timeout: 5000 });
      await this.page.waitForTimeout(100); // Trying to help flaky test
      await this.searchBox.fill(tuneTitle);
      await this.page.waitForTimeout(2000); // Wait for virtualized grid to update
    } else {
      // Mobile: open filter panel if needed and use search box inside
      const isPanelSearchVisible = await this.searchBoxPanel
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (!isPanelSearchVisible) {
        await expect(this.filtersButton).toBeVisible();
        await expect(this.filtersButton).toBeAttached();
        await expect(this.filtersButton).toBeEnabled();

        const isClickSuccessful = await (async () => {
          const blockStartMs = Date.now();
          try {
            const timeoutMs = 8000;
            const pollIntervalMs = 250;
            const startMs = Date.now();

            // Poll for successful panel opening after clicking filter button.
            // Success is indicated by aria-expanded attribute being set.
            while (Date.now() - startMs < timeoutMs) {
              await this.filtersButton.click();
              await this.page.waitForTimeout(100);
              const ariaExpanded = await this.filtersButton
                .getAttribute("aria-expanded")
                .catch(() => null);

              if (ariaExpanded) return true;
              await this.page.waitForTimeout(pollIntervalMs);
            }

            return false;
          } finally {
            const elapsedMs = Date.now() - blockStartMs;
            console.log(
              `[searchForTune] toolbar search panel (mobile) visibility check took ${elapsedMs}ms`
            );
          }
        })();

        expect(isClickSuccessful).toBe(true);

        // Wait for aria-expanded="true" to confirm state update
        await expect(this.filtersButton).toHaveAttribute(
          "aria-expanded",
          "true",
          { timeout: 3000 }
        );

        const genreButton = this.genreFilter;

        await expect(genreButton).toBeVisible();
        await expect(genreButton).toBeAttached();
        await expect(genreButton).toBeEnabled();
      }

      await expect(this.searchBoxPanel).toBeVisible();
      await expect(this.searchBoxPanel).toBeAttached();
      await expect(this.searchBoxPanel).toBeEditable();
      await this.searchBoxPanel.fill(tuneTitle);

      // Ensure the filter panel is closed so the grid is interactable.
      // (The panel may already be open from earlier steps.)
      await this.closeFilterPanelIfOpen();

      const noTunesFoundLocator = this.page.getByText("No tunes found");

      const matchingRow = grid
        .locator("tbody tr, li[data-testid^='stacked-item-']", {
          hasText: tuneTitle,
        })
        .first();
      let hasMatchingRow = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        hasMatchingRow = await matchingRow
          .isVisible({ timeout: 500 })
          .catch(() => false);

        if (hasMatchingRow) break;

        await this.page.waitForTimeout(200);

        const noTunesWereFound = await noTunesFoundLocator
          .isVisible({ timeout: 100 })
          .catch(() => false);

        if (noTunesWereFound) {
          break;
        }
      }
      const noTunesWereFound = await noTunesFoundLocator
        .isVisible({ timeout: 100 })
        .catch(() => false);

      if (!noTunesWereFound) {
        expect(hasMatchingRow).toBe(true);
      }
    }

    // Wait for the search results to settle: either empty state appears or
    // at least one row is present.
    const noTunesFound = this.page.getByText("No tunes found");
    const dataRows = grid.locator(
      "tbody tr[data-index], tbody tr, li[data-testid^='stacked-item-']"
    );

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
    // Table mode: find a table row containing the tune ID text, or by select-row checkbox.
    // Stacked list mode: find the li by its select-row checkbox. Grouped mobile
    // rows use synthetic stacked row ids, so the raw tune id is only stable on
    // the checkbox aria-label.
    return grid.locator(
      `tr:has-text("${tuneId}"), tr:has(input[aria-label="Select row ${tuneId}"]), li:has(input[aria-label="Select row ${tuneId}"])`
    );
  }

  async setGridRowChecked(tuneId: string, grid: Locator, checked = true) {
    const row = this.getTuneRowById(tuneId, grid).first();
    await expect(row).toBeVisible({ timeout: 10000 });

    const checkboxByRole = row
      .getByRole("checkbox", { name: `Select row ${tuneId}` })
      .first();
    const checkboxByInput = row
      .locator(`input[type="checkbox"][aria-label="Select row ${tuneId}"]`)
      .first();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const checkbox =
        (await checkboxByRole.count().catch(() => 0)) > 0
          ? checkboxByRole
          : checkboxByInput;

      await row.scrollIntoViewIfNeeded().catch(() => {});
      await checkbox.scrollIntoViewIfNeeded().catch(() => {});
      await expect(checkbox).toBeVisible({ timeout: 5000 });
      await expect(checkbox).toBeEnabled({ timeout: 5000 });

      const isChecked = await checkbox.isChecked().catch(() => false);
      if (isChecked === checked) {
        return;
      }

      try {
        if (checked) {
          await checkbox.check({ timeout: 5000 });
          await expect(checkbox).toBeChecked({ timeout: 5000 });
        } else {
          await checkbox.uncheck({ timeout: 5000 });
          await expect(checkbox).not.toBeChecked({ timeout: 5000 });
        }
        return;
      } catch {
        await this.page.waitForTimeout(200);
      }
    }

    throw new Error(
      `Failed to ${checked ? "check" : "uncheck"} row selection for tune ${tuneId}`
    );
  }

  /**
   * Find a tune row by ID in the practice grid.
   * Useful for locating a row when the ID column is not showing.
   */
  getRowInPracticeGridByTuneId(tuneId: string): Locator {
    return this.practiceGrid.locator(
      [
        `tr[data-index]:has([data-testid="recall-eval-${tuneId}"])`,
        `tbody tr:has([data-testid="recall-eval-${tuneId}"])`,
        `li[data-testid="stacked-item-${tuneId}"]`,
      ].join(", ")
    );
  }

  getRows(gridId: string): Locator {
    // Support both table mode (desktop) and stacked list mode (mobile).
    // On desktop the TanStack virtual table renders "tbody tr[data-index]".
    // In list mode the TuneStackedList renders visible
    // "li[data-testid^='stacked-item-']" items under the same
    // "tunes-grid-*" root, but outside the table element.
    return this.page
      .getByTestId(`tunes-grid-${gridId}`)
      .locator(
        "tbody tr[data-index], li[data-testid^='stacked-item-']:visible"
      );
  }

  /**
   * Verify a tune is visible in the grid
   * Handles virtualized grids by searching within the grid context
   */
  async expectTuneVisible(tuneName: string, grid: Locator, timeout = 5000) {
    const escapedName = tuneName.replace(
      /[.*+?^${}()|[\]\\]/g,
      String.raw`\$&`
    );

    await expect
      .poll(
        async () => {
          const linkVisible = await grid
            .getByRole("link", { name: new RegExp(`^${escapedName}$`, "i") })
            .first()
            .isVisible({ timeout: 250 })
            .catch(() => false);
          if (linkVisible) return true;

          const rowVisible = await grid
            .locator("tbody tr[data-index], li[data-testid^='stacked-item-']")
            .filter({ hasText: tuneName })
            .first()
            .isVisible({ timeout: 250 })
            .catch(() => false);
          return rowVisible;
        },
        { timeout, intervals: [100, 250, 500, 1000] }
      )
      .toBe(true);
  }

  /**
   * Click a tune to select it
   */
  async clickTune(tuneName: string, grid: Locator) {
    const tuneLink = await this.getTuneLink(tuneName, grid);
    await tuneLink.click();
  }

  /**
   * Select a grid row without accidentally activating inline stacked-list controls.
   * Mobile stacked rows now include goal/schedule controls, so a center-point click
   * can open an editor popover instead of selecting the tune.
   */
  async selectGridRow(row: Locator, opts?: { timeout?: number }) {
    const timeout = opts?.timeout ?? 5000;

    await row.scrollIntoViewIfNeeded().catch(() => undefined);
    await expect(row).toBeVisible({ timeout });

    const clicked = await row
      .evaluate((element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        element.scrollIntoView({ block: "center", inline: "nearest" });
        element.click();
        return true;
      })
      .catch(() => false);

    if (clicked) {
      await this.page.waitForTimeout(150);
      return;
    }

    await row.click({ timeout });
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
      tab?: TabType;
    } = {}
  ) {
    const tab: TabType = options.tab || "catalog"; // Default to catalog for backwards compat

    if (options.addTune) {
      const button = this.getAddTuneButton(tab);
      if (tab === "catalog" || tab === "repertoire") {
        await this.ensureToolbarActionVisible(tab, button);
      }
      await expect(button).toBeVisible({ timeout: 5000 });
    }
    if (options.addToRepertoire) {
      await this.ensureToolbarActionVisible(
        "catalog",
        this.catalogAddToRepertoireButton
      );
      await expect(this.catalogAddToRepertoireButton).toBeVisible({
        timeout: 5000,
      });
    }
    if (options.delete !== undefined) {
      // Note: Delete button only exists on catalog tab, not on repertoire
      const deleteBtn = this.getDeleteButton(tab);

      if (options.delete) {
        if (tab === "catalog") {
          await this.ensureToolbarActionVisible("catalog", deleteBtn);
        }
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
      const columnsBtn = this.getColumnsButtonForTab(tab);
      await expect(columnsBtn).toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * Verify column headers are visible by their IDs
   * Uses data-testid="ch-{columnId}" pattern for stable selection
   * @param columnIds - Array of column IDs like ["title", "mode", "type"]
   */
  async expectColumnsVisible(columnIds: string[]) {
    await expect
      .poll(
        async () => {
          const states = await Promise.all(
            columnIds.map((id) =>
              this.page
                .getByTestId(`ch-${id.toLowerCase()}`)
                .isVisible({ timeout: 250 })
                .catch(() => false)
            )
          );

          return states.every(Boolean);
        },
        {
          timeout: 10000,
          intervals: [100, 250, 500, 1000],
        }
      )
      .toBe(true);

    for (const id of columnIds) {
      const header = this.page.getByTestId(`ch-${id.toLowerCase()}`);
      await expect(header).toBeVisible({ timeout: 5000 });
    }
  }

  private getAddTuneButton(tab: TabType): Locator {
    switch (tab) {
      case "catalog":
        return this.catalogAddTuneButton;
      case "repertoire":
        return this.repertoireAddTuneButton;
      default:
        return this.addTuneButton;
    }
  }

  private getDeleteButton(tab: TabType): Locator {
    return tab === "catalog" ? this.catalogDeleteButton : this.deleteButton;
  }

  private getGridForTab(tab: TabType): Locator {
    switch (tab) {
      case "catalog":
        return this.catalogGrid;
      case "repertoire":
        return this.repertoireGrid;
      default:
        return this.practiceGrid;
    }
  }

  private getColumnsButtonForTab(tab: TabType): Locator {
    switch (tab) {
      case "catalog":
        return this.catalogColumnsButton;
      case "repertoire":
        return this.repertoireColumnsButton;
      default:
        return this.practiceColumnsButton;
    }
  }

  private getSentinelForTab(tabId: TabId): Locator | undefined {
    switch (tabId) {
      case "practice":
        return this.practiceColumnsButton;
      case "repertoire":
        return this.repertoireColumnsButton;
      case "catalog":
        return this.catalogColumnsButton;
      case "setlists":
        return this.setlistsColumnsButton;
      default:
        return undefined;
    }
  }

  private getGridForTabId(tabId: TabId): Locator | undefined {
    switch (tabId) {
      case "practice":
        return this.practiceGrid;
      case "repertoire":
        return this.repertoireGrid;
      case "catalog":
        return this.catalogGrid;
      case "setlists":
        return this.setlistsViewGrid;
      default:
        return undefined;
    }
  }

  private getVisibleStackedItems(): Locator {
    return this.page.locator("li[data-testid^='stacked-item-']:visible");
  }

  private async getRenderedViewMode(
    tab: TabType
  ): Promise<"grid" | "list" | null> {
    const grid = this.getGridForTab(tab);
    const gridHeaderVisible = await grid
      .locator("thead th")
      .first()
      .isVisible({ timeout: 250 })
      .catch(() => false);
    if (gridHeaderVisible) {
      return "grid";
    }

    const stackedItemVisible = await this.getVisibleStackedItems()
      .first()
      .isVisible({ timeout: 250 })
      .catch(() => false);
    if (stackedItemVisible) {
      return "list";
    }

    return null;
  }

  private async waitForRenderedViewMode(
    tab: TabType,
    timeout = 10000
  ): Promise<"grid" | "list" | null> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (this.page.isClosed()) {
        return null;
      }

      const mode = await this.getRenderedViewMode(tab);
      if (mode) {
        return mode;
      }

      await this.page.waitForTimeout(100).catch(() => undefined);
    }

    if (this.page.isClosed()) {
      return null;
    }

    return this.getRenderedViewMode(tab);
  }

  private async waitForViewModeSurfaceReady(
    tab: TabType,
    timeout = 15000
  ): Promise<void> {
    const baseUrl = String(BASE_URL).replace(/\/+$/, "");
    const columnsButton = this.getColumnsButtonForTab(tab);

    // Catalog setup can still be settling after the test helper lands on the tab.
    // Poll for the real app surface before opening the Kobalte display-options menu,
    // otherwise Mobile Chrome can race into teardown/navigation and report a closed page.
    await expect
      .poll(
        async () => {
          if (this.page.isClosed()) {
            return false;
          }

          const currentUrl = this.page.url();
          if (
            !currentUrl.startsWith(baseUrl) ||
            currentUrl.includes("e2e-origin.html") ||
            currentUrl === "about:blank"
          ) {
            return false;
          }

          const buttonVisible = await columnsButton
            .isVisible({ timeout: 250 })
            .catch(() => false);
          if (!buttonVisible) {
            return false;
          }

          const buttonEnabled = await columnsButton
            .isEnabled()
            .catch(() => false);
          if (!buttonEnabled) {
            return false;
          }

          const renderedMode = await this.getRenderedViewMode(tab);
          return renderedMode !== null;
        },
        {
          timeout,
          intervals: [100, 250, 500, 1000],
        }
      )
      .toBe(true);
  }

  private getDisplayModeSwitch(): Locator {
    return this.getColumnVisibilityMenu()
      .getByTestId("display-mode-switch")
      .first();
  }

  private async waitForLocatorVisible(
    locator: Locator,
    timeout = 2000,
    interval = 100
  ): Promise<boolean> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (this.page.isClosed()) {
        return false;
      }

      const visible = await locator
        .isVisible({ timeout: 200 })
        .catch(() => false);
      if (visible) {
        return true;
      }

      await this.page.waitForTimeout(interval);
    }

    if (this.page.isClosed()) {
      return false;
    }

    return locator.isVisible({ timeout: 200 }).catch(() => false);
  }

  private async getDisplayModeSwitchChecked(
    displayModeSwitch: Locator
  ): Promise<boolean | null> {
    const ariaChecked = await displayModeSwitch
      .getAttribute("aria-checked")
      .catch(() => null);
    if (ariaChecked === "true") {
      return true;
    }
    if (ariaChecked === "false") {
      return false;
    }

    const dataChecked = await displayModeSwitch
      .evaluate((el) => (el as HTMLElement).dataset.checked)
      .catch(() => null);
    if (dataChecked !== null) {
      return true;
    }

    const inputChecked = await displayModeSwitch
      .locator('input[type="checkbox"], input[type="hidden"]')
      .first()
      .evaluate((element) => {
        if (!(element instanceof HTMLInputElement)) {
          return null;
        }

        return element.checked;
      })
      .catch(() => null);
    if (typeof inputChecked === "boolean") {
      return inputChecked;
    }

    return null;
  }

  private async doesDisplayModeSwitchMatchMode(
    displayModeSwitch: Locator,
    mode: "grid" | "list"
  ): Promise<boolean | null> {
    const checked = await this.getDisplayModeSwitchChecked(displayModeSwitch);
    if (checked === null) {
      return null;
    }

    return checked === (mode === "list");
  }

  private async closeColumnVisibilityMenu(menu: Locator) {
    if (this.page.isClosed()) {
      return;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const menuVisible = await menu
        .isVisible({ timeout: 200 })
        .catch(() => false);
      if (!menuVisible) {
        return;
      }

      if (attempt === 0) {
        await this.page.keyboard.press("Escape").catch(() => undefined);
        await this.page.waitForTimeout(100);
        continue;
      }

      const box = await menu.boundingBox().catch(() => null);
      if (box) {
        const outsideX = Math.max(4, Math.floor(box.x) - 12);
        const outsideY = Math.max(
          4,
          Math.floor(box.y + Math.min(box.height / 2, 24))
        );
        await this.page.mouse.click(outsideX, outsideY).catch(() => undefined);
      } else {
        await this.page.mouse.click(4, 4).catch(() => undefined);
      }

      await this.page.waitForTimeout(100);
    }

    if (this.page.isClosed()) {
      return;
    }

    await expect(menu)
      .toBeHidden({ timeout: 1500 })
      .catch(async (error) => {
        if (this.page.isClosed()) {
          return;
        }

        const stillVisible = await menu
          .isVisible({ timeout: 200 })
          .catch(() => false);
        if (stillVisible) {
          throw error;
        }
      });
  }

  private async closeFilterPanelIfOpen() {
    const filterPanel = this.page.locator('[data-filter-panel="true"]').last();
    const panelVisible = await filterPanel
      .isVisible({ timeout: 300 })
      .catch(() => false);

    if (!panelVisible) return;

    const filtersVisible = await this.filtersButton
      .isVisible({ timeout: 500 })
      .catch(() => false);

    if (filtersVisible) {
      await this.filtersButton.click().catch(() => undefined);
      const hiddenAfterToggle = await filterPanel
        .isHidden({ timeout: 500 })
        .catch(() => false);
      if (hiddenAfterToggle) return;
    }

    const box = await filterPanel.boundingBox().catch(() => null);
    if (box) {
      const outsideX = Math.max(4, Math.floor(box.x) - 12);
      const outsideY = Math.max(
        4,
        Math.floor(box.y + Math.min(box.height / 2, 24))
      );
      await this.page.mouse.click(outsideX, outsideY).catch(() => undefined);
    } else {
      await this.page.mouse.click(4, 4).catch(() => undefined);
    }

    await expect(filterPanel).toBeHidden({ timeout: 5000 });
  }

  async ensureFilterPanelOpen() {
    const panelVisible = await this.page
      .locator('[data-filter-panel="true"]')
      .last()
      .isVisible({ timeout: 300 })
      .catch(() => false);

    if (panelVisible) {
      return;
    }

    await expect(this.filtersButton).toBeVisible({ timeout: 5000 });
    await expect(this.filtersButton).toBeEnabled({ timeout: 10000 });
    await this.filtersButton.click();
    await expect(this.filtersButton).toHaveAttribute("aria-expanded", "true", {
      timeout: 5000,
    });
    await expect(
      this.page.locator('[data-filter-panel="true"]').last()
    ).toBeVisible({
      timeout: 5000,
    });
  }

  async openTuneSetFilterDropdown() {
    await this.ensureFilterPanelOpen();
    await expect(this.tuneSetFilter).toBeVisible({ timeout: 5000 });

    const menuVisible = await this.tuneSetFilterMenu
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (!menuVisible) {
      await this.tuneSetFilter.click({ timeout: 5000 });
    }

    await expect(this.tuneSetFilterMenu).toBeVisible({ timeout: 5000 });
  }

  async isInTuneSetsFilterEnabled(): Promise<boolean> {
    await this.openTuneSetFilterDropdown();
    const checkbox = this.tuneSetFilterAnyOption
      .locator('input[type="checkbox"]')
      .first();
    return checkbox.isChecked();
  }

  async setInTuneSetsFilter(enabled: boolean) {
    await this.openTuneSetFilterDropdown();

    if ((await this.isInTuneSetsFilterEnabled()) === enabled) {
      return;
    }

    await this.tuneSetFilterAnyOption.click({ timeout: 5000 });
    await expect
      .poll(() => this.isInTuneSetsFilterEnabled(), {
        timeout: 5000,
        intervals: [100, 250, 500],
      })
      .toBe(enabled);
  }

  async selectTuneSetFilterByName(name: string) {
    await this.openTuneSetFilterDropdown();
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const option = this.tuneSetFilterMenu
      .getByRole("button", { name: new RegExp(escapedName, "i") })
      .first();

    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click({ timeout: 5000 });

    const checkbox = option.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeChecked({ timeout: 5000 });
  }

  async setViewMode(tab: TabType, mode: "grid" | "list") {
    const throwPageClosedError = () => {
      throw new Error(`Page closed while setting ${tab} view mode to ${mode}`);
    };

    await this.waitForViewModeSurfaceReady(tab);

    const columnsButton = this.getColumnsButtonForTab(tab);
    const grid = this.getGridForTab(tab);

    if (await this.isAlreadyInViewMode(tab, mode)) return;

    await this.openColumnVisibilityMenu(columnsButton);
    if (await this.isAlreadyInViewMode(tab, mode)) {
      await this.closeColumnVisibilityMenu(this.getColumnVisibilityMenu());
      return;
    }

    await this.attemptViewModeSwitch(columnsButton, tab, mode);
    await this.verifyViewModeSwitch(tab, mode, grid, throwPageClosedError);
  }

  private async isAlreadyInViewMode(
    tab: TabType,
    mode: "grid" | "list"
  ): Promise<boolean> {
    if ((await this.waitForRenderedViewMode(tab)) !== mode) return false;

    const lingeringMenu = this.getColumnVisibilityMenu();
    const lingeringMenuVisible = await lingeringMenu
      .isVisible({ timeout: 200 })
      .catch(() => false);
    if (lingeringMenuVisible) {
      await this.closeColumnVisibilityMenu(lingeringMenu);
    }
    return true;
  }

  private async attemptViewModeSwitch(
    columnsButton: Locator,
    tab: TabType,
    mode: "grid" | "list"
  ) {
    const throwPageClosedError = () => {
      throw new Error(`Page closed while setting ${tab} view mode to ${mode}`);
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (this.page.isClosed()) throwPageClosedError();

      const displayModeSwitch = this.getDisplayModeSwitch();
      if (
        !(await displayModeSwitch
          .isVisible({ timeout: 500 })
          .catch(() => false))
      ) {
        if (await this.reopenMenuAndCheck(columnsButton, tab, mode)) return;
        await this.page.waitForTimeout(150);
        continue;
      }

      await displayModeSwitch.scrollIntoViewIfNeeded().catch(() => undefined);
      if (
        await this.tryClickDisplayModeSwitch(displayModeSwitch, mode, attempt)
      )
        return;
      if ((await this.waitForRenderedViewMode(tab, 1500)) === mode) return;
      if (await this.reopenMenuAndCheck(columnsButton, tab, mode)) return;
      await this.page.waitForTimeout(150);
    }
  }

  private async tryClickDisplayModeSwitch(
    displayModeSwitch: Locator,
    mode: "grid" | "list",
    attempt: number
  ): Promise<boolean> {
    if (
      (await this.doesDisplayModeSwitchMatchMode(displayModeSwitch, mode)) ===
      true
    )
      return true;

    try {
      await displayModeSwitch.click({ timeout: 5000 });
    } catch {
      if (attempt === 2) await displayModeSwitch.click({ timeout: 5000 });
      return (
        (await this.doesDisplayModeSwitchMatchMode(displayModeSwitch, mode)) ===
        true
      );
    }

    return (
      (await this.doesDisplayModeSwitchMatchMode(displayModeSwitch, mode)) ===
      true
    );
  }

  private async reopenMenuAndCheck(
    columnsButton: Locator,
    tab: TabType,
    mode: "grid" | "list"
  ): Promise<boolean> {
    const menu = this.getColumnVisibilityMenu();
    const visible = await menu.isVisible({ timeout: 250 }).catch(() => false);
    if (visible) return false;

    await this.openColumnVisibilityMenu(columnsButton, menu);
    if ((await this.waitForRenderedViewMode(tab)) === mode) {
      await this.closeColumnVisibilityMenu(menu);
      return true;
    }
    return false;
  }

  private async verifyViewModeSwitch(
    tab: TabType,
    mode: "grid" | "list",
    grid: Locator,
    throwPageClosedError: () => never
  ) {
    if (this.page.isClosed()) throwPageClosedError();

    await expect
      .poll(() => this.getRenderedViewMode(tab), {
        timeout: 5000,
        intervals: [100, 250, 500],
      })
      .toBe(mode);

    if (this.page.isClosed()) throwPageClosedError();
    await this.closeColumnVisibilityMenu(this.getColumnVisibilityMenu());

    if (mode === "grid") {
      await expect(grid.locator("thead th").first()).toBeVisible({
        timeout: 10000,
      });
    } else {
      await expect(this.getVisibleStackedItems().first()).toBeVisible({
        timeout: 10000,
      });
    }
  }

  async ensureGridView(tab: TabType) {
    await this.setViewMode(tab, "grid");
  }

  async ensureListView(tab: TabType) {
    await this.setViewMode(tab, "list");
  }

  private async clickOverflowButton(overflowButton: Locator) {
    await overflowButton
      .click({ timeout: 2000 })
      // Kobalte can detach/recreate the trigger while the mobile menu opens.
      // Fall back to force-click so CI retries can recover from that churn.
      .catch(() => overflowButton.click({ timeout: 2000, force: true }))
      .catch(() => {
        // Last resort: dispatch synthetic pointerdown + click so Kobalte's
        // touch-aware onClick handler sees data-pointerType="touch" and opens
        // the menu.  Without pointerdown the dataset attribute is never set,
        // and the plain click event is silently ignored on touch devices.
        return overflowButton.evaluate((el) => {
          const pd = new PointerEvent("pointerdown", {
            bubbles: true,
            pointerType: "touch",
          });
          el.dispatchEvent(pd);
          el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
      })
      .catch(() => undefined);
  }

  private async pressOverflowButtonKey(
    overflowButton: Locator,
    key: "Enter" | "Space"
  ) {
    // Mobile Chrome can leave the Kobalte trigger focused but unopened after a
    // nominally successful click. Try the trigger's keyboard activation path
    // before escalating to synthetic touch events so the page object still uses
    // normal user-level inputs whenever they work.
    await overflowButton.focus().catch(() => undefined);
    await overflowButton.press(key, { timeout: 2000 }).catch(() => undefined);
  }

  private async dispatchTouchOverflowButton(overflowButton: Locator) {
    await overflowButton
      .evaluate((el) => {
        // Some Mobile Chrome flakes leave the trigger visible and enabled but do
        // not open the Kobalte menu unless it sees a full touch-style pointer
        // sequence. Dispatch the same event shape the component expects so the
        // target menu item can actually enter the DOM before we assert on it.
        const pointerDown = new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          isPrimary: true,
          pointerType: "touch",
        });
        const pointerUp = new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          isPrimary: true,
          pointerType: "touch",
        });
        const click = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          composed: true,
        });

        el.dispatchEvent(pointerDown);
        el.dispatchEvent(pointerUp);
        el.dispatchEvent(click);
      })
      .catch(() => undefined);
  }

  /**
   * Open a mobile overflow menu entry with bounded retries.
   *
   * The toolbar can briefly detach/recreate its Kobalte trigger while the menu
   * is opening on CI Mobile Chrome, so we allow a few reopen attempts before
   * failing the test. `overflowButton` is the trigger button, and `target` is
   * the menu entry that should become visible once the menu is open.
   */
  private async openOverflowMenuEntry(
    overflowButton: Locator,
    target: Locator
  ) {
    for (
      let retryAttempt = 0;
      retryAttempt < OVERFLOW_MENU_MAX_RETRIES;
      retryAttempt += 1
    ) {
      const isTargetVisibleBeforeClick = await target
        .isVisible({ timeout: 300 })
        .catch(() => false);
      if (isTargetVisibleBeforeClick) {
        return;
      }

      await overflowButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await expect(overflowButton).toBeVisible({ timeout: 2000 });
      await expect(overflowButton).toBeEnabled({ timeout: 2000 });

      const revealAttempt = async (strategy: () => Promise<void>) => {
        // This retry loop is deliberate: under worker contention the trigger can
        // accept an input event without opening the menu. We only consider a
        // strategy successful once the requested menu entry is actually visible.
        await strategy();
        await this.page.waitForTimeout(OVERFLOW_MENU_RETRY_DELAY_MS);
        return await target.isVisible({ timeout: 1500 }).catch(() => false);
      };

      if (await revealAttempt(() => this.clickOverflowButton(overflowButton))) {
        return;
      }

      if (
        await revealAttempt(() =>
          this.pressOverflowButtonKey(overflowButton, "Enter")
        )
      ) {
        return;
      }

      if (
        await revealAttempt(() =>
          this.pressOverflowButtonKey(overflowButton, "Space")
        )
      ) {
        return;
      }

      if (
        await revealAttempt(() =>
          this.dispatchTouchOverflowButton(overflowButton)
        )
      ) {
        return;
      }

      await this.page.waitForTimeout(OVERFLOW_MENU_RETRY_DELAY_MS);
    }

    await expect(target).toBeVisible({ timeout: 5000 });
  }

  private async revealToolbarAction(
    tab: TabType,
    action: Locator
  ): Promise<boolean> {
    const alreadyVisible = await action
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (alreadyVisible) {
      return false;
    }

    const overflowButton = this.getColumnsButtonForTab(tab);
    await this.openOverflowMenuEntry(overflowButton, action);
    return true;
  }

  private async ensureToolbarActionVisible(tab: TabType, action: Locator) {
    await this.revealToolbarAction(tab, action);
  }

  private async isVisibleToolbarActionEnabled(
    action: Locator
  ): Promise<boolean> {
    return await action.evaluateAll((elements) => {
      const visibleElement = elements.find((element) => {
        const htmlElement = element as HTMLElement;
        return htmlElement.getClientRects().length > 0;
      }) as HTMLButtonElement | undefined;

      if (!visibleElement) {
        return false;
      }

      return (
        !visibleElement.disabled &&
        visibleElement.getAttribute("aria-disabled") !== "true"
      );
    });
  }

  async isCatalogAddToRepertoireEnabled(): Promise<boolean> {
    await this.ensureToolbarActionVisible(
      "catalog",
      this.catalogAddToRepertoireButton
    );
    return this.isVisibleToolbarActionEnabled(
      this.catalogAddToRepertoireButton
    );
  }

  private async clickVisibleToolbarAction(action: Locator): Promise<void> {
    await action.evaluateAll((elements) => {
      const visibleEnabledElement = elements.find((element) => {
        const htmlElement = element as HTMLElement;
        const buttonElement = element as HTMLButtonElement;
        return (
          htmlElement.getClientRects().length > 0 &&
          !buttonElement.disabled &&
          element.getAttribute("aria-disabled") !== "true"
        );
      }) as HTMLElement | undefined;

      if (!visibleEnabledElement) {
        throw new Error("No visible enabled toolbar action found");
      }

      visibleEnabledElement.click();
    });
  }

  private async clickToolbarAction(
    tab: TabType,
    action: Locator,
    opts?: { timeoutMs?: number; settleMs?: number }
  ) {
    const timeoutMs = opts?.timeoutMs ?? 5000;
    const settleMs = opts?.settleMs ?? 0;
    const start = Date.now();
    let lastError: unknown;

    while (Date.now() - start < timeoutMs) {
      try {
        await this.ensureToolbarActionVisible(tab, action);
        await expect(action).toBeVisible({ timeout: 1000 });
        await expect(action).toBeEnabled({ timeout: 1000 });

        try {
          await action.click({ timeout: 1000 });
        } catch {
          try {
            await action.click({ timeout: 1000, force: true });
          } catch {
            await this.clickVisibleToolbarAction(action);
          }
        }

        if (settleMs > 0) {
          await this.page.waitForTimeout(settleMs);
        }
        return;
      } catch (error) {
        lastError = error;

        // If the page has already been torn down, the original failure is the
        // useful signal. Retrying via waitForTimeout only masks it.
        if (this.page.isClosed()) {
          break;
        }

        await this.page.waitForTimeout(150);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to click toolbar action for ${tab}`);
  }

  private async getToolbarSwitchTarget(
    tab: TabType,
    action: Locator
  ): Promise<Locator> {
    await this.ensureToolbarActionVisible(tab, action);
    const nestedSwitch = action.getByRole("switch");
    const nestedVisible = await nestedSwitch
      .isVisible({ timeout: 300 })
      .catch(() => false);
    return nestedVisible ? nestedSwitch : action;
  }

  private async getToolbarSwitchClickTarget(
    tab: TabType,
    action: Locator
  ): Promise<Locator> {
    await this.ensureToolbarActionVisible(tab, action);

    const actionVisible = await action
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (actionVisible) {
      return action;
    }

    const control = action.locator("[data-checked], [data-disabled]").first();
    const controlVisible = await control
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (controlVisible) {
      return control;
    }

    const label = action.locator("label").first();
    const labelVisible = await label
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (labelVisible) {
      return label;
    }

    return this.getToolbarSwitchTarget(tab, action);
  }

  private async readToolbarSwitchChecked(target: Locator): Promise<boolean> {
    const input = target.locator('input[type="checkbox"]').first();
    const hasInput = (await input.count().catch(() => 0)) > 0;
    if (hasInput) {
      return input.isChecked().catch(() => false);
    }

    const ariaChecked = await target
      .getAttribute("aria-checked")
      .catch(() => null);
    if (ariaChecked != null) {
      return ariaChecked === "true";
    }

    const dataChecked = await target
      .evaluate((el) => (el as HTMLElement).dataset.checked)
      .catch(() => null);
    return dataChecked != null;
  }

  private async getToolbarSwitchChecked(
    tab: TabType,
    action: Locator
  ): Promise<boolean> {
    const openedOverflow = await this.revealToolbarAction(tab, action);

    try {
      const target = await this.getToolbarSwitchTarget(tab, action);
      return await this.readToolbarSwitchChecked(target);
    } finally {
      if (openedOverflow) {
        await this.page.keyboard.press("Escape").catch(() => undefined);
      }
    }
  }

  private async setToolbarSwitchChecked(
    tab: TabType,
    action: Locator,
    enabled: boolean,
    settleMs: number = 300
  ) {
    // Fast path: already in the desired state.
    const current = await this.getToolbarSwitchChecked(tab, action);
    if (current === enabled) {
      return;
    }

    // Outer retry loop: the Kobalte mobile overflow trigger can detach/recreate
    // during reactive updates (especially on the practice page during queue
    // generation).  Retrying the whole sequence is more robust than relying
    // solely on openOverflowMenuEntry's internal retries.
    const start = Date.now();
    const maxRetryMs = 15_000;
    let lastError: unknown;

    while (Date.now() - start < maxRetryMs) {
      try {
        const openedOverflow = await this.revealToolbarAction(tab, action);

        try {
          const target = await this.getToolbarSwitchClickTarget(tab, action);

          try {
            await target.click({ timeout: 1000 });
          } catch {
            try {
              await target.click({ timeout: 1000, force: true });
            } catch {
              await target.dispatchEvent("click");
            }
          }

          await expect
            .poll(() => this.getToolbarSwitchChecked(tab, action), {
              timeout: 5000,
              intervals: [100, 250, 500, 1000],
            })
            .toBe(enabled);

          if (settleMs > 0) {
            await this.page.waitForTimeout(settleMs);
          }
          return;
        } finally {
          if (openedOverflow) {
            await this.page.keyboard.press("Escape").catch(() => undefined);
          }
        }
      } catch (error) {
        lastError = error;
        await this.page.waitForTimeout(150);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(
          `Failed to set toolbar switch ${tab} to ${enabled} after ${maxRetryMs}ms`
        );
  }

  async isShowSubmittedEnabled(): Promise<boolean> {
    return this.getToolbarSwitchChecked(
      "practice",
      this.displaySubmittedSwitch
    );
  }

  async isFlashcardModeDisabled(): Promise<boolean> {
    const openedOverflow = await this.revealToolbarAction(
      "practice",
      this.flashcardModeSwitch
    );

    try {
      const target = await this.getToolbarSwitchTarget(
        "practice",
        this.flashcardModeSwitch
      );
      const disabled = await target.isDisabled().catch(() => false);
      if (disabled) {
        return true;
      }

      return (await target.getAttribute("aria-disabled")) === "true";
    } finally {
      if (openedOverflow) {
        await this.page.keyboard.press("Escape").catch(() => undefined);
      }
    }
  }

  async setShowSubmitted(enabled: boolean, settleMs: number = 300) {
    await this.setToolbarSwitchChecked(
      "practice",
      this.displaySubmittedSwitch,
      enabled,
      settleMs
    );
  }

  async toggleShowSubmitted(settleMs: number = 300) {
    await this.setShowSubmitted(
      !(await this.isShowSubmittedEnabled()),
      settleMs
    );
  }

  async setRepertoireShowSets(enabled: boolean, settleMs: number = 300) {
    await this.setToolbarSwitchChecked(
      "repertoire",
      this.repertoireGroupSetsSwitch,
      enabled,
      settleMs
    );
  }

  getRepertoireRowByText(text: string): Locator {
    return this.repertoireGrid
      .locator("tbody tr[data-index], li[data-testid^='stacked-item-']")
      .filter({ hasText: text })
      .first();
  }

  async clickCatalogAddToRepertoire() {
    await this.clickToolbarAction("catalog", this.catalogAddToRepertoireButton);
  }

  async clickCatalogAddTune() {
    await this.clickToolbarAction("catalog", this.catalogAddTuneButton);
  }

  async clickCatalogDelete() {
    await this.clickToolbarAction("catalog", this.catalogDeleteButton);
  }

  async clickRepertoireAddToReview() {
    await this.clickToolbarAction(
      "repertoire",
      this.repertoireAddToReviewButton
    );
  }

  async clickRepertoireAddTune() {
    await this.clickToolbarAction("repertoire", this.repertoireAddTuneButton);
  }

  async clickRepertoireRemove() {
    await this.clickToolbarAction("repertoire", this.repertoireRemoveButton);
  }

  private getColumnVisibilityMenu(): Locator {
    return this.page.getByTestId("column-visibility-menu").last();
  }

  private getDisplayOptionsButton(): Locator {
    return this.page
      .locator('[data-testid="display-options-entry-button"]:visible')
      .last();
  }

  private async waitForColumnVisibilityMenu(
    targetMenu: Locator = this.getColumnVisibilityMenu(),
    timeout = 5000
  ): Promise<boolean> {
    return expect
      .poll(
        async () => {
          const menuVisible = await targetMenu
            .isVisible({ timeout: 200 })
            .catch(() => false);
          if (menuVisible) {
            return true;
          }

          const menuCount = await this.page
            .getByTestId("column-visibility-menu")
            .count()
            .catch(() => 0);
          return menuCount > 0
            ? await targetMenu.isVisible({ timeout: 200 }).catch(() => false)
            : false;
        },
        {
          timeout,
          intervals: [100, 250, 500],
        }
      )
      .toBe(true)
      .then(() => true)
      .catch(() => false);
  }

  private async openColumnVisibilityMenu(
    columnsButton: Locator,
    targetMenu: Locator = this.getColumnVisibilityMenu()
  ): Promise<void> {
    await this.closeFilterPanelIfOpen();

    if (this.page.isClosed()) {
      return;
    }

    await expect(columnsButton).toBeVisible({ timeout: 5000 });
    await expect(columnsButton).toBeEnabled({ timeout: 5000 });

    const menuVisible = await targetMenu
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (menuVisible) {
      return;
    }

    await columnsButton.click();
    await this.openDisplayOptionsEntryIfNeeded(columnsButton, targetMenu);
    if (this.page.isClosed()) {
      return;
    }

    const menuOpened = await this.waitForColumnVisibilityMenu(targetMenu);
    if (menuOpened) {
      return;
    }

    await columnsButton.click().catch(() => undefined);
    await this.openDisplayOptionsEntryIfNeeded(columnsButton, targetMenu);
    await expect(targetMenu).toBeVisible({ timeout: 5000 });
  }

  private async openDisplayOptionsEntryIfNeeded(
    columnsButton: Locator,
    targetMenu: Locator = this.getColumnVisibilityMenu()
  ): Promise<void> {
    const ariaLabel = ((await columnsButton.getAttribute("aria-label")) ?? "")
      .trim()
      .toLowerCase();
    const opensOverflowMenu = ariaLabel === "more options";

    if (!opensOverflowMenu) {
      return;
    }

    const displayOptionsButton = this.getDisplayOptionsButton();
    await this.openOverflowMenuEntry(columnsButton, displayOptionsButton);

    for (
      let retryAttempt = 0;
      retryAttempt < OVERFLOW_MENU_MAX_RETRIES;
      retryAttempt += 1
    ) {
      const targetMenuVisible = await targetMenu
        .isVisible({ timeout: 250 })
        .catch(() => false);
      if (targetMenuVisible) {
        return;
      }

      await displayOptionsButton
        .scrollIntoViewIfNeeded()
        .catch(() => undefined);

      // The Kobalte dropdown entry can detach as it closes itself while opening
      // the nested menu surface. Prefer a normal click, but fall back to a
      // direct dispatch when the DOM is mid-transition.
      await displayOptionsButton
        .click({ timeout: 2000 })
        .catch(() => displayOptionsButton.dispatchEvent("click"))
        .catch(() => undefined);

      // On mobile, clicking the overflow entry first closes the overflow menu
      // and then queues the nested display-options panel open on the next turn.
      // Give that handoff a chance to complete before reopening the overflow.
      const menuVisible = await this.waitForLocatorVisible(
        targetMenu,
        3500,
        125
      );
      if (menuVisible) {
        return;
      }

      if (this.page.isClosed()) {
        return;
      }

      await this.page.keyboard.press("Escape").catch(() => undefined);
      const menuVisibleAfterEscape = await this.waitForLocatorVisible(
        targetMenu,
        750,
        125
      );
      if (menuVisibleAfterEscape) {
        return;
      }

      const displayOptionsVisible = await displayOptionsButton
        .isVisible({ timeout: 250 })
        .catch(() => false);
      if (!displayOptionsVisible) {
        await this.openOverflowMenuEntry(columnsButton, displayOptionsButton);
      }
      await this.openOverflowMenuEntry(columnsButton, displayOptionsButton);
      await displayOptionsButton.click().catch(() => undefined);

      const menuOpened = await this.waitForColumnVisibilityMenu(
        targetMenu,
        OVERFLOW_MENU_RETRY_DELAY_MS + 1500
      );
      if (menuOpened) {
        return;
      }
    }

    if (this.page.isClosed()) {
      return;
    }
    await expect(targetMenu).toBeVisible({ timeout: 5000 });
  }

  async setGridColumnVisibility(
    tab: TabType,
    columnLabel: string,
    visible: boolean
  ) {
    const columnsButton = this.getColumnsButtonForTab(tab);
    const escapedLabel = columnLabel.replace(
      /[.*+?^${}()|[\]\\]/g,
      String.raw`\$&`
    );

    await this.openColumnVisibilityMenu(columnsButton);

    const menu = this.getColumnVisibilityMenu();

    const label = menu
      .locator("button span")
      .filter({ hasText: new RegExp(String.raw`^\s*${escapedLabel}\s*$`, "i") })
      .first();
    const option = label.locator("xpath=ancestor::button[1]");
    const checkbox = option.locator('input[type="checkbox"]').first();

    await expect(label).toBeVisible({ timeout: 5000 });
    await option.scrollIntoViewIfNeeded().catch(() => undefined);
    await expect(option).toBeVisible({ timeout: 5000 });
    await expect(checkbox).toBeVisible({ timeout: 5000 });

    const isChecked = await checkbox.isChecked().catch(() => false);
    if (isChecked !== visible) {
      await option.click();
      if (visible) {
        await expect(checkbox).toBeChecked({ timeout: 5000 });
      } else {
        await expect(checkbox).not.toBeChecked({ timeout: 5000 });
      }
    }

    await this.closeColumnVisibilityMenu(menu);
  }

  async ensureGridColumnVisible(tab: TabType, columnLabel: string) {
    await this.setGridColumnVisibility(tab, columnLabel, true);
  }

  /**
   * Filter by genre
   */
  async filterByGenre(
    genre: string,
    gridId: string = "catalog",
    nRowsTest = 10
  ) {
    const rowsLocator = this.getRows(gridId);

    await expect
      .poll(async () => await rowsLocator.count().catch(() => 0), {
        timeout: 10_000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThan(nRowsTest);

    const rowsCount = await rowsLocator.count();
    expect(rowsCount).toBeGreaterThan(nRowsTest);

    await expect(this.searchBoxPanel)
      .not.toBeVisible({ timeout: 2000 })
      .catch(() => {});

    await expect(this.filtersButton).toBeVisible({ timeout: 5000 });
    await expect(this.filtersButton).toBeEnabled({ timeout: 10000 });

    const filtersPanelReady = await this.waitForFiltersPanelOpen();
    expect(filtersPanelReady).toBe(true);

    await expect(this.genreFilter).toBeVisible({ timeout: 5000 });
    await expect(this.genreFilter).toBeEnabled({ timeout: 10000 });
    await this.page.waitForTimeout(250);

    const dropdownPanel = this.page.getByTestId(`filter-dropdown-menu-genre`);

    const genreDropdownOpened = await this.ensureGenreDropdownOpen(
      dropdownPanel,
      genre
    );
    expect(genreDropdownOpened).toBe(true);

    const genreOptionChecked = await this.checkGenreOption(
      dropdownPanel,
      genre
    );
    expect(genreOptionChecked).toBe(true);

    const filterBoxIsOpen = await dropdownPanel.isVisible();
    if (filterBoxIsOpen) {
      await this.filtersButton.click();
    }
  }

  private async waitForFiltersPanelOpen(): Promise<boolean> {
    const pause = (ms: number) => {
      if (!this.page.isClosed()) this.page.waitForTimeout(ms).catch(() => {});
    };

    const clickFilterButton = async (locator: Locator) => {
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      try {
        await locator.click({ timeout: 1500 });
      } catch {
        await locator.click({ timeout: 1500, force: true }).catch(() => {});
      }
    };

    for (let attempt = 0; attempt < 4; attempt++) {
      const visible = await this.genreFilter
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (visible) return true;

      const panelExpanded = await this.filtersButton
        .getAttribute("aria-expanded")
        .then((value) => value === "true")
        .catch(() => false);

      if (!panelExpanded) {
        await clickFilterButton(this.filtersButton);
      }

      pause(250);

      if (
        await this.genreFilter.isVisible({ timeout: 1000 }).catch(() => false)
      ) {
        return true;
      }

      const stillExpanded = await this.filtersButton
        .getAttribute("aria-expanded")
        .then((value) => value === "true")
        .catch(() => false);

      if (stillExpanded) {
        await this.page.keyboard.press("Escape").catch(() => {});
        pause(150);
      }
    }

    return false;
  }

  private async ensureGenreDropdownOpen(
    dropdownPanel: Locator,
    _genre: string
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const filterVisible = await this.genreFilter
        .isVisible({ timeout: 300 })
        .catch(() => false);

      if (!filterVisible) {
        await this.filtersButton.click().catch(() => {});
        if (!this.page.isClosed()) await this.page.waitForTimeout(200);
      }

      const [isExpanded, isPanelVisible] = await Promise.all([
        this.genreFilter
          .getAttribute("aria-expanded")
          .then((value) => value === "true")
          .catch(() => false),
        dropdownPanel.isVisible({ timeout: 400 }).catch(() => false),
      ]);

      if (isExpanded && isPanelVisible) return true;

      await this.genreFilter.click().catch(() => {});
      if (!this.page.isClosed()) await this.page.waitForTimeout(200);
    }

    return false;
  }

  private async checkGenreOption(
    dropdownPanel: Locator,
    genre: string
  ): Promise<boolean> {
    const escapedGenre = genre.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const genrePattern = new RegExp(String.raw`^\s*${escapedGenre}\s*$`, "i");

    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await this.ensureGenreDropdownOpen(dropdownPanel, genre))) {
        await this.safeTimeout(250);
        continue;
      }
      const candidate = await this.findGenreCheckbox(
        dropdownPanel,
        genre,
        genrePattern
      );
      if (!candidate) {
        await this.safeTimeout(250);
        continue;
      }
      try {
        await candidate.scrollIntoViewIfNeeded().catch(() => {});
        await expect(candidate).toBeEnabled({ timeout: 5000 });
        await candidate.check({ timeout: 5000 });
        await expect(candidate).toBeChecked({ timeout: 5000 });
        return true;
      } catch {
        await this.safeTimeout(200);
      }
    }
    return false;
  }

  private async safeTimeout(ms: number) {
    if (!this.page.isClosed()) await this.page.waitForTimeout(ms);
  }

  private async findGenreCheckbox(
    dropdownPanel: Locator,
    genre: string,
    pattern: RegExp
  ): Promise<Locator | null> {
    const byRole = dropdownPanel
      .getByRole("checkbox", { name: pattern })
      .first();
    if ((await byRole.count().catch(() => 0)) > 0) return byRole;
    const byLabel = dropdownPanel
      .locator("label", { hasText: genre })
      .locator('input[type="checkbox"]')
      .first();
    return (await byLabel.isVisible({ timeout: 1500 }).catch(() => false))
      ? byLabel
      : null;
  }

  /**
   * Filter by type (Jig, Reel, etc.)
   */
  async filterByType(type: string) {
    await expect(this.filtersButton).toBeVisible({ timeout: 5000 });
    await expect(this.filtersButton).toBeEnabled({ timeout: 10000 });

    const panelAlreadyOpen = await this.typeFilter
      .isVisible({ timeout: 500 })
      .catch(() => false);

    if (!panelAlreadyOpen) {
      await this.filtersButton.click();
      await this.page.waitForTimeout(250);
    }

    await expect(this.typeFilter).toBeVisible({ timeout: 5000 });
    await expect(this.typeFilter).toBeEnabled({ timeout: 10000 });

    const dropdownPanel = this.page.getByTestId(`filter-dropdown-menu-type`);
    const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const optionByRole = () =>
      dropdownPanel
        .getByRole("checkbox", {
          name: new RegExp(String.raw`^\s*${escapedType}\s*$`, "i"),
        })
        .first();
    const optionByLabel = () =>
      dropdownPanel
        .locator("label", { hasText: type })
        .locator('input[type="checkbox"]')
        .first();

    let selectedOption = optionByRole();
    let typeOptionChecked = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      const isExpanded = await this.typeFilter
        .getAttribute("aria-expanded")
        .then((value) => value === "true")
        .catch(() => false);

      if (!isExpanded) {
        await this.typeFilter.click({ timeout: 10000 });
        await this.page.waitForTimeout(150);
      }

      const roleOption = optionByRole();
      const roleOptionCount = await roleOption.count().catch(() => 0);
      const candidate = roleOptionCount > 0 ? roleOption : optionByLabel();

      const [isPanelVisible, isCandidateVisible] = await Promise.all([
        dropdownPanel.isVisible({ timeout: 1000 }).catch(() => false),
        candidate.isVisible({ timeout: 1000 }).catch(() => false),
      ]);

      if (!isPanelVisible || !isCandidateVisible) {
        await this.page.waitForTimeout(200);
        continue;
      }

      try {
        await candidate.scrollIntoViewIfNeeded().catch(() => {});
        await expect(candidate).toBeEnabled({ timeout: 5000 });
        await candidate.check({ timeout: 5000 });
        await expect(candidate).toBeChecked({ timeout: 5000 });
        selectedOption = candidate;
        typeOptionChecked = true;
        break;
      } catch {
        await this.page.waitForTimeout(200);
      }
    }

    expect(typeOptionChecked).toBe(true);
    await this.page.waitForTimeout(1000);

    // Ensure the dropdown is closed so the grid is interactable.

    for (let retry = 0; retry < 3; retry++) {
      const filterBoxIsOpen = await this.typeFilter
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (filterBoxIsOpen) {
        await this.filtersButton.click();
        await this.page.waitForTimeout(200);
        await expect(selectedOption)
          .not.toBeVisible({ timeout: 5000 })
          .catch(() => {});
      } else {
        break;
      }
    }

    await this.page.waitForTimeout(500); // Wait a bit for grid to update
  }

  /**
   * Clear search box
   * The search box is now always visible in the toolbar (desktop and mobile).
   */
  async clearSearch() {
    // Check if toolbar search box is visible (should always be true now)
    const isToolbarSearchVisible = await this.searchBox
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (isToolbarSearchVisible) {
      // Toolbar search box: use it directly
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

    // Support both table mode (desktop) and stacked list mode (mobile):
    // - Table: <td> cells inside <tbody>
    // - Stacked list: <li data-testid="stacked-item-*"> elements
    const items = grid.locator("td, li[data-testid^='stacked-item-']");

    // Wait for at least one item to appear (30s timeout)
    await expect(items.first()).toBeVisible({ timeout: 30000 });

    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThan(0);
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
    const practiceLoadingMessage = this.page.getByText(
      "Loading practice queue..."
    );

    await this.setToolbarSwitchChecked(
      "practice",
      this.flashcardModeSwitch,
      true,
      0
    );
    await expect
      .poll(
        async () => {
          const [flashcardVisible, loadingVisible] = await Promise.all([
            this.flashcardView.isVisible().catch(() => false),
            practiceLoadingMessage.isVisible().catch(() => false),
          ]);

          return flashcardVisible && !loadingVisible;
        },
        {
          timeout: 15_000,
          intervals: [100, 250, 500, 1000],
        }
      )
      .toBe(true);

    if (typeof timeoutAfter === "number") {
      await this.page.waitForTimeout(timeoutAfter);
    }
  }

  async enableFlashcardModeAllowingEmptyState(timeoutAfter: number = 800) {
    const flashcardEmptyState = this.page.getByTestId("flashcard-empty-state");
    const practiceLoadingMessage = this.page.getByText(
      "Loading practice queue..."
    );

    await this.setToolbarSwitchChecked(
      "practice",
      this.flashcardModeSwitch,
      true,
      0
    );

    await expect
      .poll(
        async () => {
          const [flashcardVisible, emptyVisible, loadingVisible] =
            await Promise.all([
              this.flashcardView.isVisible().catch(() => false),
              flashcardEmptyState.isVisible().catch(() => false),
              practiceLoadingMessage.isVisible().catch(() => false),
            ]);

          if (loadingVisible) {
            return "pending";
          }

          if (flashcardVisible) {
            return "flashcard";
          }
          if (emptyVisible) {
            return "empty";
          }
          return "pending";
        },
        {
          timeout: 15000,
          intervals: [100, 250, 500, 1000],
        }
      )
      .not.toBe("pending");

    if (typeof timeoutAfter === "number") {
      await this.page.waitForTimeout(timeoutAfter);
    }
  }

  async disableFlashcardMode() {
    const flashcardEmptyState = this.page.getByTestId("flashcard-empty-state");

    await this.setToolbarSwitchChecked(
      "practice",
      this.flashcardModeSwitch,
      false,
      0
    );
    await expect
      .poll(
        async () => {
          const [flashcardVisible, emptyVisible] = await Promise.all([
            this.flashcardView.isVisible().catch(() => false),
            flashcardEmptyState.isVisible().catch(() => false),
          ]);
          return flashcardVisible || emptyVisible;
        },
        {
          timeout: 5000,
          intervals: [100, 250, 500, 1000],
        }
      )
      .toBe(false);
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
    const evalTrigger = this.page.getByTestId(`recall-eval-${tuneId}`);
    await expect(evalTrigger).toBeVisible({ timeout: 5000 });
    await expect(evalTrigger).toBeEnabled({ timeout: 5000 });

    const expectedLabel =
      evalValue === "not-set" ? String.raw`\(Not Set\)` : `${evalValue}:`;

    const triggerAlreadySelected = async () => {
      const text = (await evalTrigger.textContent().catch(() => null)) ?? "";
      return new RegExp(expectedLabel, "i").test(text);
    };

    const waitBetweenAttempts = () => this.pauseIfNotClosed(doTimeouts);

    for (let attempt = 0; attempt < 3; attempt++) {
      if (await triggerAlreadySelected()) return;

      const result = await this.trySelectEvalOption(
        menu,
        evalTrigger,
        whichRow,
        evalValue,
        expectedLabel,
        triggerAlreadySelected,
        waitBetweenAttempts
      );
      if (result) return;
    }

    throw new Error(
      `Failed to select evaluation ${evalValue} for tune ${tuneId} after retries`
    );
  }

  private pauseIfNotClosed(doTimeouts: boolean | number) {
    if (!doTimeouts || this.page.isClosed()) return;
    const delay = typeof doTimeouts === "number" ? doTimeouts : 200;
    this.page
      .waitForLoadState("domcontentloaded", { timeout: 1500 })
      .catch(() => undefined);
    this.page.waitForTimeout(delay);
  }

  private async isEvalMenuOpen(
    menu: Locator,
    trigger: Locator
  ): Promise<boolean> {
    const [expanded, visible] = await Promise.all([
      trigger.getAttribute("aria-expanded").catch(() => null),
      menu.isVisible().catch(() => false),
    ]);
    return expanded === "true" || visible;
  }

  private async closeEvalMenu(menu: Locator, trigger: Locator) {
    if (!(await this.isEvalMenuOpen(menu, trigger))) return;

    await trigger.focus().catch(() => undefined);
    await trigger.press("Escape").catch(async () => {
      await this.page.keyboard.press("Escape").catch(() => undefined);
    });

    await expect
      .poll(() => this.isEvalMenuOpen(menu, trigger), {
        timeout: 2000,
        intervals: [100, 250, 500],
      })
      .toBe(false)
      .catch(() => undefined);
  }

  private async openEvalMenu(menu: Locator, trigger: Locator, row: Locator) {
    if (await this.isEvalMenuOpen(menu, trigger)) return;

    await row.scrollIntoViewIfNeeded().catch(() => undefined);
    await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
    await trigger.focus().catch(() => undefined);

    try {
      await trigger.click({ timeout: 4000 });
    } catch {
      await trigger.press("Enter");
    }

    await expect
      .poll(() => this.isEvalMenuOpen(menu, trigger), {
        timeout: 4000,
        intervals: [100, 250, 500, 1000],
      })
      .toBe(true);
  }

  private async submitStateReflectsEvalSelection(
    evalValue: string
  ): Promise<boolean> {
    if (evalValue === "not-set") return true;

    const [title, textContent, enabled] = await Promise.all([
      this.submitEvaluationsButton.getAttribute("title").catch(() => null),
      this.submitEvaluationsButton.textContent().catch(() => null),
      this.submitEvaluationsButton.isEnabled().catch(() => false),
    ]);

    const titleMatch = title?.match(/Submit\s+(\d+)\s+practice evaluations/i);
    const textMatch = textContent?.match(/\b(\d+)\b/);
    const count = this.extractEvaluationCount(titleMatch, textMatch);
    return enabled && count >= 1;
  }

  private async trySelectEvalOption(
    menu: Locator,
    trigger: Locator,
    row: Locator,
    evalValue: string,
    expectedLabel: string,
    isAlreadySelected: () => Promise<boolean>,
    settle: () => void
  ): Promise<boolean> {
    await this.closeEvalMenu(menu, trigger);

    try {
      await this.openEvalMenu(menu, trigger, row);
    } catch (error) {
      if (this.page.isClosed()) throw error;
      settle();
      return false;
    }

    const whichOption = menu.getByTestId(`recall-eval-option-${evalValue}`);
    try {
      await expect(menu).toBeVisible({ timeout: 4000 });
      await expect(whichOption).toBeVisible({ timeout: 4000 });
      await expect(whichOption).toBeEnabled({ timeout: 4000 });
      await whichOption.scrollIntoViewIfNeeded().catch(() => undefined);
      await whichOption.click({ timeout: 3000 });
    } catch {
      await this.closeEvalMenu(menu, trigger);
      settle();
      return false;
    }

    try {
      await expect
        .poll(
          async () => {
            const [triggerText, open, submitReady] = await Promise.all([
              trigger.textContent().catch(() => null),
              this.isEvalMenuOpen(menu, trigger),
              this.submitStateReflectsEvalSelection(evalValue),
            ]);
            return { triggerText: triggerText ?? "", open, submitReady };
          },
          { timeout: 5000, intervals: [100, 250, 500, 1000] }
        )
        .toMatchObject({
          triggerText: expect.stringMatching(new RegExp(expectedLabel, "i")),
          open: false,
          submitReady: true,
        });
    } catch {
      await this.closeEvalMenu(menu, trigger);
      settle();
      return false;
    }

    if (evalValue !== "not-set" && !this.page.isClosed()) {
      await this.page.waitForTimeout(250);
      const [stillSelected, submitReady] = await Promise.all([
        isAlreadySelected().catch(() => false),
        this.submitStateReflectsEvalSelection(evalValue),
      ]);
      if (!stillSelected || !submitReady) {
        await this.closeEvalMenu(menu, trigger);
        settle();
        return false;
      }
    }

    if (!this.page.isClosed()) {
      await this.page.waitForTimeout(50);
    }
    return true;
  }

  async waitForSubmitReady(
    opts: { minCount?: number; timeoutMs?: number } = {}
  ) {
    const minCount = opts.minCount ?? 1;
    const timeoutMs = opts.timeoutMs ?? 30000;

    await expect(this.submitEvaluationsButton).toBeVisible({
      timeout: timeoutMs,
    });

    await expect
      .poll(
        async () => {
          const [title, enabled, textContent] = await Promise.all([
            this.submitEvaluationsButton
              .getAttribute("title")
              .catch(() => null),
            this.submitEvaluationsButton.isEnabled().catch(() => false),
            this.submitEvaluationsButton.textContent().catch(() => null),
          ]);
          const titleMatch = title?.match(
            /Submit\s+(\d+)\s+practice evaluations/i
          );
          const textMatch = textContent?.match(/\b(\d+)\b/);
          const count = this.extractEvaluationCount(titleMatch, textMatch);
          return enabled && count >= minCount;
        },
        { timeout: timeoutMs, intervals: [100, 250, 500, 1000] }
      )
      .toBe(true);
  }

  private async dismissVisibleToasts(maxAttempts: number = 3) {
    const toastCloser = this.page
      .getByRole("button", { name: "Close toast" })
      .first();

    // Background sync errors use persistent toasts with pointer events enabled.
    // Close them before critical clicks so tests interact with the page the same
    // way a user would instead of forcing a click through an overlay.
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const isToastVisible = await toastCloser.isVisible().catch(() => false);
      if (!isToastVisible) {
        return;
      }

      await toastCloser.click({ timeout: 5_000 });
      await expect(toastCloser).toBeHidden({ timeout: 5_000 });
    }
  }

  private extractEvaluationCount(
    titleMatch: RegExpMatchArray | null | undefined,
    textMatch: RegExpMatchArray | null | undefined
  ): number {
    if (titleMatch) return Number(titleMatch[1]);
    if (textMatch) return Number(textMatch[1]);
    return 0;
  }

  private isToastClickInterception(error: unknown): boolean {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    return (
      message.includes("intercepts pointer events") &&
      (message.includes("Notifications alt+T") ||
        message.includes("data-react-aria-top-layer") ||
        message.includes("Close toast"))
    );
  }

  private async clickWithToastRecovery(
    target: Locator,
    options?: Parameters<Locator["click"]>[0],
    logContext: string = "clickWithToastRecovery"
  ) {
    // Notification toasts are rendered in the top layer and can temporarily block
    // otherwise-ready controls. Dismiss them and retry only for that exact UI obstruction.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.dismissVisibleToasts();

      try {
        await target.click(options);
        return;
      } catch (error) {
        const isLastAttempt = attempt === 2;
        if (!this.isToastClickInterception(error) || isLastAttempt) {
          throw error;
        }

        console.log(`[TuneTreesPageDiag] ${logContext}:toast-retry`, {
          attempt,
          url: this.page.url(),
        });

        await this.page.waitForTimeout(250);
      }
    }
  }

  async submitEvaluations(
    opts: { minCount?: number; timeoutMs?: number } = {}
  ) {
    const timeoutMs = opts.timeoutMs ?? 30000;

    const [preClickTitle, preClickEnabled, preClickText] = await Promise.all([
      this.submitEvaluationsButton.getAttribute("title").catch(() => null),
      this.submitEvaluationsButton.isEnabled().catch(() => false),
      this.submitEvaluationsButton.textContent().catch(() => null),
    ]);
    const submitStartedAt = Date.now();
    console.log("[TuneTreesPageDiag] submitEvaluations:start", {
      timeoutMs,
      minCount: opts.minCount ?? 1,
      url: this.page.url(),
      preClickTitle,
      preClickEnabled,
      preClickText,
    });

    await this.waitForSubmitReady(opts);

    const [readyTitle, readyEnabled, readyText] = await Promise.all([
      this.submitEvaluationsButton.getAttribute("title").catch(() => null),
      this.submitEvaluationsButton.isEnabled().catch(() => false),
      this.submitEvaluationsButton.textContent().catch(() => null),
    ]);
    console.log("[TuneTreesPageDiag] submitEvaluations:ready", {
      elapsedMs: Date.now() - submitStartedAt,
      readyTitle,
      readyEnabled,
      readyText,
    });

    // A persistent sync-error toast can appear between readiness checks and the
    // click itself. Retry only on that concrete obstruction instead of forcing
    // the click through an overlay.
    await this.clickWithToastRecovery(
      this.submitEvaluationsButton,
      { timeout: timeoutMs },
      "submitEvaluations"
    );

    const [hasLoadingQueue, hasNoTunes] = await Promise.all([
      this.page
        .getByText("Loading practice queue...")
        .isVisible()
        .catch(() => false),
      this.page
        .getByText("No tunes available")
        .isVisible()
        .catch(() => false),
    ]);
    console.log("[TuneTreesPageDiag] submitEvaluations:clicked", {
      elapsedMs: Date.now() - submitStartedAt,
      url: this.page.url(),
      hasLoadingQueue,
      hasNoTunes,
    });
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
    const startedAt = Date.now();
    this.logFlashcard("start", { value, timeoutAfter });

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        this.logFlashcard("attempt", { value, attempt });
        await expect(this.flashcardView).toBeVisible({ timeout: 15_000 });

        const { evalButton, tuneId } = await this.findFlashcardEvalControls();
        this.logFlashcard("tune", { tuneId, value, attempt });

        const menu = this.page.getByTestId(`recall-eval-menu-${tuneId}`);
        const expectedLabel = value === "not-set" ? "(Not Set)" : `${value}:`;
        const elapsed = () => Date.now() - startedAt;

        if (
          value !== "not-set" &&
          (await this.tryFlashcardHotkey(
            value,
            evalButton,
            menu,
            expectedLabel
          ))
        ) {
          this.logFlashcard("shortcut-success", {
            value,
            elapsedMs: elapsed(),
          });
          break;
        }

        await this.openFlashcardEvalPopup(evalButton, tuneId, value, menu);
        this.logFlashcard("menu-open", {
          tuneId,
          attempt,
          elapsedMs: elapsed(),
        });
        await this.clickFlashcardEvalOption(
          tuneId,
          value,
          menu,
          evalButton,
          expectedLabel,
          elapsed()
        );
        break;
      } catch (err) {
        this.logFlashcard("error", {
          value,
          attempt,
          elapsedMs: Date.now() - startedAt,
          error: String(err),
        });
        if (attempt === 5) throw err;
      }
    }
    if (typeof timeoutAfter === "number") {
      await this.page.waitForTimeout(timeoutAfter);
    }
  }

  private logFlashcard(stage: string, extra: Record<string, unknown>) {
    console.log(`[TuneTreesPageDiag] selectFlashcardEvaluation:${stage}`, {
      ...extra,
      url: this.page.url(),
    });
  }

  private async findFlashcardEvalControls() {
    const evalButton = this.flashcardView.getByTestId(
      /^recall-eval-[0-9a-f-]+$/i
    );
    await expect(evalButton).toBeVisible({ timeout: 10_000 });
    await evalButton.scrollIntoViewIfNeeded();
    await expect(evalButton).toBeEnabled({ timeout: 10_000 });

    const dropdownTestId = await evalButton.getAttribute("data-testid");
    const tuneId = this.parseTuneIdFromRecallEvalTestId(dropdownTestId);
    if (!tuneId) {
      throw new Error(
        `Expected tuneId to be present on flashcard recall evaluation dropdown (data-testid=${String(dropdownTestId)})`
      );
    }
    return { evalButton, tuneId };
  }

  private async tryFlashcardHotkey(
    value: "again" | "hard" | "good" | "easy",
    evalButton: Locator,
    menu: Locator,
    expectedLabel: string
  ): Promise<boolean> {
    const hotkeys: Record<"again" | "hard" | "good" | "easy", string> = {
      again: "1",
      hard: "2",
      good: "3",
      easy: "4",
    };

    try {
      await this.page.keyboard.press("Escape").catch(() => undefined);
      await expect(menu)
        .toBeHidden({ timeout: 3000 })
        .catch(() => undefined);
      await this.clickWithToastRecovery(
        this.flashcardView,
        { position: { x: 24, y: 24 } },
        "selectFlashcardEvaluation:focus-flashcard"
      );
      await expect(this.flashcardView).toBeVisible({ timeout: 5000 });
      await this.page.keyboard.press(hotkeys[value]);

      await expect
        .poll(async () => (await evalButton.textContent()) ?? "", {
          timeout: 5000,
          intervals: [100, 250, 500, 1000],
        })
        .toMatch(new RegExp(expectedLabel, "i"));
      return true;
    } catch (err) {
      this.logFlashcard("shortcut-fallback", {
        value,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  private async openFlashcardEvalPopup(
    evalButton: Locator,
    tuneId: string,
    value: string,
    menu: Locator
  ) {
    for (let openAttempt = 0; openAttempt < 3; openAttempt++) {
      await evalButton.focus().catch(() => undefined);
      await this.clickWithToastRecovery(
        evalButton,
        { trial: true, timeout: 5000 },
        "selectFlashcardEvaluation:trial-open-menu"
      );
      await this.clickWithToastRecovery(
        evalButton,
        { timeout: 5000 },
        "selectFlashcardEvaluation:open-menu"
      );

      try {
        await expect(menu).toBeVisible({ timeout: 4000 });
        return;
      } catch {
        // Try keyboard activation as fallback
        try {
          await this.page.keyboard.press("Enter");
          await expect(menu).toBeVisible({ timeout: 1500 });
          return;
        } catch {}
        try {
          await this.page.keyboard.press(" ");
          await expect(menu).toBeVisible({ timeout: 1500 });
          return;
        } catch {}

        this.logFlashcard("menu-open-retry", {
          tuneId,
          value,
          openAttempt,
          ariaExpanded: await evalButton
            .getAttribute("aria-expanded")
            .catch(() => null),
        });

        try {
          await this.ensureReveal(true);
        } catch {}
        try {
          await this.page.keyboard.press("Escape");
        } catch {}
        await this.page.waitForTimeout(200);
      }
    }
    throw new Error(`Failed to open recall evaluation menu for tune ${tuneId}`);
  }

  private async clickFlashcardEvalOption(
    tuneId: string,
    value: string,
    menu: Locator,
    evalButton: Locator,
    expectedLabel: string,
    elapsedMs: number
  ) {
    const option = menu.getByTestId(`recall-eval-option-${value}`);
    await expect(option).toBeVisible({ timeout: 5000 });
    await expect(option).toBeEnabled({ timeout: 5000 });
    await option.click({ trial: true, timeout: 5000 });
    await option.click({ timeout: 5000 });

    await expect(menu)
      .toBeHidden({ timeout: 5000 })
      .catch(() => undefined);

    this.logFlashcard("option-clicked", { tuneId, value, elapsedMs });

    await expect
      .poll(async () => (await evalButton.textContent()) ?? "", {
        timeout: 8000,
        intervals: [100, 250, 500, 1000],
      })
      .toMatch(new RegExp(expectedLabel, "i"));

    this.logFlashcard("success", { tuneId, value, elapsedMs });
  }

  async openFlashcardFieldsMenu() {
    // Mobile Chrome can be slow to attach/render the menu; retry a couple times.
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.practiceColumnsButton.scrollIntoViewIfNeeded();
      await expect(this.practiceColumnsButton).toBeVisible({ timeout: 5000 });
      await expect(this.practiceColumnsButton).toBeEnabled({ timeout: 5000 });
      await this.practiceColumnsButton.click();
      await this.openDisplayOptionsEntryIfNeeded(
        this.practiceColumnsButton,
        this.flashcardFieldsMenu
      );

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
    // Escape closes the floating menu on both desktop and mobile without
    // reopening the mobile overflow trigger.
    await this.page.keyboard.press("Escape").catch(() => undefined);
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
      total = Number.parseInt(counterText?.split(" of ")[1] || "0", 10);
      if (
        (waitGTE && total >= countToWaitUpTo) ||
        (!waitGTE && total <= countToWaitUpTo)
      ) {
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
  async selectReferenceType(optionLabelOrValue: string) {
    const typeLabelMap: Record<string, string> = {
      video: "Video",
      audio: "Audio",
      "sheet-music": "Sheet Music",
      website: "Website",
      article: "Article",
      social: "Social Media",
      lesson: "Lesson",
      other: "Other",
    };

    const optionLabel =
      typeLabelMap[optionLabelOrValue] ?? optionLabelOrValue.trim();
    const listbox = this.page.getByRole("listbox");
    const listboxVisible = await listbox
      .isVisible({ timeout: 200 })
      .catch(() => false);

    if (!listboxVisible) {
      await this.referenceTypeSelect.click();
      await listbox
        .waitFor({ state: "visible", timeout: 5000 })
        .catch(() => {});
    }

    await this.page
      .getByRole("option", { name: new RegExp(optionLabel, "i") })
      .first()
      .click();
  }

  async dropAudioFileOnReferencesPanel(options: {
    fileName: string;
    mimeType?: string;
    contents?: string;
  }) {
    const dataTransfer = await this.page.evaluateHandle(
      ({ fileName, mimeType, contents }) => {
        const transfer = new DataTransfer();
        const file = new File([contents], fileName, {
          type: mimeType,
        });
        transfer.items.add(file);
        return transfer;
      },
      {
        fileName: options.fileName,
        mimeType: options.mimeType || "audio/mpeg",
        contents: options.contents || "audio-bytes",
      }
    );

    await this.referencesPanel.dispatchEvent("dragover", { dataTransfer });
    await this.referencesPanel.dispatchEvent("drop", { dataTransfer });
  }

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
      await this.selectReferenceType(options.type);
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
      const api = (globalThis as any).__ttTestApi;
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
