import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page Object Model for TuneTrees Application
 */
export class TuneTreesPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Navigation helpers
  async goto(path = "/") {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
  }

  async gotoLogin() {
    await this.goto("/login");
  }

  async gotoCatalog() {
    await this.goto("/catalog");
  }

  async gotoPractice() {
    await this.goto("/practice");
  }

  // Common element getters
  get filterButton(): Locator {
    return this.page.locator('[data-testid="combined-filter-button"]');
  }

  get filterDropdown(): Locator {
    return this.page.locator('[data-testid="combined-filter-dropdown"]');
  }

  get searchInput(): Locator {
    return this.page.locator('[data-testid="search-input"]');
  }

  get tunesGrid(): Locator {
    return this.page.locator('[data-testid="tunes-grid"]');
  }

  // Common actions
  async openFilterDropdown() {
    await expect(this.filterButton).toBeVisible();
    await this.filterButton.click();
    await expect(this.filterDropdown).toBeVisible();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
  }

  // Wait for app to be ready
  async waitForAppReady() {
    // Wait for main navigation or content to be visible
    await expect(this.page.locator('nav, main, [role="main"]')).toBeVisible();
  }

  // Authentication helpers (for future use with Supabase auth)
  async login(email: string, password: string) {
    await this.gotoLogin();
    await this.page.locator('[data-testid="email-input"]').fill(email);
    await this.page.locator('[data-testid="password-input"]').fill(password);
    await this.page.locator('[data-testid="login-button"]').click();
    await this.waitForAppReady();
  }

  // Debug helpers
  async captureConsoleLogs() {
    const logs: string[] = [];
    this.page.on("console", (msg) => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });
    return logs;
  }

  async takeDebugScreenshot(name: string) {
    await this.page.screenshot({
      path: `e2e/tests/artifacts/debug-${name}.png`,
      fullPage: true,
    });
  }
}

/**
 * Test utilities and constants
 */
export const TEST_CONSTANTS = {
  DEFAULT_TIMEOUT: 10000,
  NAVIGATION_TIMEOUT: 30000,
  TEST_USER: {
    email: "test@example.com",
    password: "testpassword123",
  },
} as const;

/**
 * Custom expect matchers for TuneTrees
 */
export async function expectTunesGridToHaveData(page: Page) {
  const grid = page.locator('[data-testid="tunes-grid"]');
  await expect(grid).toBeVisible();

  // Check for at least one tune row
  const tuneRows = grid.locator('[data-testid="tune-row"]');
  await expect(tuneRows.first()).toBeVisible();
}

export async function expectFilterToHaveOptions(
  page: Page,
  filterType: "type" | "mode" | "genre" | "playlist"
) {
  const dropdown = page.locator('[data-testid="combined-filter-dropdown"]');
  await expect(dropdown).toBeVisible();

  const filterSection = dropdown.locator(
    `text=${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`
  );
  await expect(filterSection).toBeVisible();

  // Check for at least one option
  const options = dropdown.locator(`[data-testid="${filterType}-option"]`);
  await expect(options.first()).toBeVisible();
}
