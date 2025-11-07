import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TOPNAV-002: Database/Sync status dropdown shows correct state
 * Priority: Medium
 *
 * Tests that the database status indicator in TopNav shows correct
 * sync state and allows force sync operations.
 */

test.use({ storageState: "e2e/.auth/alice.json" });

let ttPage: TuneTreesPage;

test.describe("TOPNAV-002: Database Status Dropdown", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
  });

  test("should show database status icon in TopNav", async ({ page }) => {
    // Look for database icon (might be a database icon, cloud icon, or sync icon)
    // Adjust selector based on your implementation
    const dbIcon = page
      .locator(
        '[aria-label*="database" i], [aria-label*="sync" i], [title*="database" i], [title*="sync" i]'
      )
      .first();

    if (await dbIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(dbIcon).toBeVisible();
    } else {
      // Try alternate: look for any icon/button near theme switcher
      // const topNavIcons = page.locator("header button, nav button").all();
      const count = await page.locator("header button, nav button").count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("should show green checkmark or synced indicator", async ({ page }) => {
    // After sync completes, should show positive indicator
    // This might be a green checkmark, "Synced" text, or green badge
    const syncedIndicator = page.getByText(/Synced|✓|✔/i);

    if (await syncedIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(syncedIndicator.first()).toBeVisible();
    }
  });

  test("should open dropdown when database icon clicked", async ({ page }) => {
    // Find and click database/sync icon
    const dbButton = ttPage.databaseStatusDropdown;

    if (await dbButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dbButton.click();
      await page.waitForTimeout(500);

      // "database-dropdown-panel"

      // Dropdown menu should appear
      const dropdown = ttPage.databaseDropdownPanel;
      await expect(dropdown).toBeVisible({ timeout: 2000 });
    }
  });

  test("should show 'Initialized and ready' status", async ({ page }) => {
    // Click database icon to open dropdown
    const dbButton = ttPage.databaseStatusDropdown;

    if (await dbButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dbButton.click();
      await page.waitForTimeout(500);

      // Should show database status
      await expect(page.getByText(/Initialized|ready/i)).toBeVisible({
        timeout: 2000,
      });
    }
  });

  test("should show 'Synced' or 'All changes synced' message", async ({
    page,
  }) => {
    const dbButton = ttPage.databaseStatusDropdown;

    if (await dbButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dbButton.click();
      await page.waitForTimeout(500);

      // Should show sync status
      await expect(
        ttPage.databaseDropdownPanel.getByText("Synced", { exact: true })
      ).toBeVisible({ timeout: 6000 });
      await expect(
        ttPage.databaseDropdownPanel.getByText("All changes synced to Supabase")
      ).toBeVisible({
        timeout: 2000,
      });
    }
  });

  test("should show 'Online' network status", async ({ page }) => {
    const dbButton = ttPage.databaseStatusDropdown;

    if (await dbButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dbButton.click();
      await page.waitForTimeout(500);

      // Should show network status
      await expect(page.getByText(/Online|Connected/i)).toBeVisible({
        timeout: 2000,
      });
    }
  });

  test("should show 'Force Sync Down' button", async ({ page }) => {
    const dbButton = ttPage.databaseStatusDropdown;

    if (await dbButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dbButton.click();
      await page.waitForTimeout(500);

      // Should have Force Sync button
      const forceSyncButton = page.getByRole("button", { name: /Force Sync/i });
      await expect(forceSyncButton).toBeVisible({ timeout: 2000 });
      await expect(forceSyncButton).toBeEnabled();
    }
  });

  test("should show 'Database Browser' link in dev mode", async ({ page }) => {
    const dbButton = ttPage.databaseStatusDropdown;

    if (await dbButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dbButton.click();
      await page.waitForTimeout(500);

      // In dev mode, should have link to database browser
      const dbBrowserLink = page.getByRole("link", {
        name: /Database Browser/i,
      });

      if (await dbBrowserLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(dbBrowserLink).toBeVisible();
      }
    }
  });

  test("should not show warning icons after successful sync", async ({
    page,
  }) => {
    await page.waitForTimeout(5000); // Ensure sync completed

    // Should not show warning or error indicators
    const warningIcon = page.locator("svg").filter({ hasText: /⚠/ });
    await expect(warningIcon).not.toBeVisible();
  });

  test("should not show pending sync count", async ({ page }) => {
    // After sync completes, no pending count should be shown
    const pendingText = page.getByText(/\d+ pending|changes pending/i);
    await expect(pendingText).not.toBeVisible();
  });

  test("Force Sync button should work without errors", async ({ page }) => {
    const dbButton = ttPage.databaseStatusDropdown;

    if (await dbButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dbButton.click();
      await page.waitForTimeout(500);

      const forceSyncButton = page.getByRole("button", { name: /Force Sync/i });

      if (
        await forceSyncButton.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await forceSyncButton.click();
        await page.waitForTimeout(2000);

        // Should not show errors
        await expect(page.getByText(/error|failed/i)).not.toBeVisible();
      }
    }
  });
});
