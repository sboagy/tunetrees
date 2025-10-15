import { expect, type Locator, type Page } from "@playwright/test";

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

  readonly topNavManagePlaylistsPanel: Locator;

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

    // Grids - using data-testid for stable selection
    this.practiceGrid = page.getByTestId("tunes-grid-practice");
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

    this.topNavManagePlaylistsPanel = page.getByTestId(
      "top-nav-manage-playlists-panel"
    );
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
   * Navigate to a specific tab by ID
   */
  async navigateToTab(
    tabId: "practice" | "repertoire" | "catalog" | "analysis"
  ) {
    const tab = this.page.getByTestId(`tab-${tabId}`);
    await tab.click();
    await this.page.waitForTimeout(1000); // Wait for tab content to load
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
    }

    await this.page.waitForTimeout(2000); // Wait for virtualized grid to update

    // Verify grid is visible after search
    await expect(grid).toBeVisible({ timeout: 5000 });
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
   * Useful for checking private tunes (ID 9001, 9002, etc.)
   */
  async getTuneRowById(tuneId: number, grid: Locator): Promise<Locator> {
    return grid.locator(`tr:has-text("${tuneId}")`);
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
    console.log("🔍 expectGridHasContent: Starting...");

    // Wait for grid to be visible first
    await expect(grid).toBeVisible({ timeout: 10000 });
    console.log("✅ Grid is visible");

    // Take screenshot for debugging
    if (process.env.CI) {
      await this.page.screenshot({
        path: `grid-debug-${Date.now()}.png`,
        fullPage: true,
      });
      console.log("📸 Screenshot captured");
    }

    // Log the grid HTML
    const gridHtml = await grid.innerHTML();
    console.log(`📄 Grid HTML length: ${gridHtml.length} chars`);
    console.log(`📄 Grid HTML preview: ${gridHtml.substring(0, 500)}...`);

    // Check for table cells
    const cells = grid.locator("td");
    console.log("🔍 Waiting for cells...");

    // Wait for at least one cell to appear (30s timeout)
    await expect(cells.first()).toBeVisible({ timeout: 30000 });
    console.log("✅ First cell is visible");

    const cellCount = await cells.count();
    console.log(`📊 Cell count: ${cellCount}`);

    expect(cellCount).toBeGreaterThan(0);
    console.log("✅ expectGridHasContent: Success");
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
}
