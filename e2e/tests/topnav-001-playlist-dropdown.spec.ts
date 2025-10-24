import { expect, test } from "@playwright/test";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TOPNAV-001: Playlist dropdown shows user's playlists
 * Priority: Critical
 *
 * Tests that the playlist dropdown in TopNav correctly displays
 * Alice's playlist with proper details after login.
 */

// Use authenticated state
test.use({ storageState: "e2e/.auth/alice.json" });

let ttPage: TuneTreesPage;

test.describe("TOPNAV-001: Playlist Dropdown Population", () => {
  test.beforeEach(async ({ page }) => {
    ttPage = new TuneTreesPage(page);

    await page.goto("http://localhost:5173");
    // Wait for page to load and sync to complete
    await page.waitForTimeout(3000);
  });

  test("should display default selected playlist in TopNav", async ({
    page,
  }) => {
    // Look for playlist button/dropdown in TopNav
    // Adjust selector based on your actual implementation
    const playlistButton = page
      .locator("button")
      .filter({ hasText: /Irish Flute|9001/i });

    await expect(playlistButton).toBeVisible({ timeout: 10000 });

    // Should show playlist name or instrument name
    await expect(playlistButton).toContainText(/Irish Flute|9001/i);
  });

  test("should open dropdown menu when clicked", async ({ page }) => {
    // Click the playlist dropdown button
    const playlistButton = page
      .locator("button")
      .filter({ hasText: /Irish Flute|9001/i })
      .first();
    await playlistButton.click();

    // Dropdown menu should be visible
    // This might be a role="menu" or specific class
    await expect(ttPage.topNavManagePlaylistsPanel).toBeVisible({
      timeout: 2000,
    });
  });

  test("should show playlist details in dropdown", async ({ page }) => {
    const playlistButton = page
      .locator("button")
      .filter({ hasText: /Irish Flute|9001/i })
      .first();
    await playlistButton.click();

    // Should show the playlist item with subtitle
    // Show a tunes count; value may vary depending on previous tests adding tunes
    await expect(
      ttPage.topNavManagePlaylistsPanel.getByText(/tunes/i, { exact: false })
    ).toBeVisible({ timeout: 2000 });
    await expect(
      ttPage.topNavManagePlaylistsPanel.getByText(/Irish Traditional/i, {
        exact: false,
      })
    ).toBeVisible({
      timeout: 2000,
    });
  });

  test("should show 'Manage Playlists' button in dropdown", async ({
    page,
  }) => {
    const playlistButton = page
      .locator("button")
      .filter({ hasText: /Irish Flute|9001/i })
      .first();
    await playlistButton.click();

    // Look for "Manage Playlists" button
    await expect(
      page.getByRole("button", { name: /Manage Playlists/i })
    ).toBeVisible({ timeout: 2000 });
  });

  test("should close dropdown when clicking outside", async ({ page }) => {
    const playlistButton = page
      .locator("button")
      .filter({ hasText: /Irish Flute|9001/i })
      .first();
    await playlistButton.click();

    // Dropdown should be visible
    const dropdown = ttPage.topNavManagePlaylistsPanel;
    await expect(dropdown).toBeVisible();

    // Click outside the dropdown
    await page.locator("body").click({ position: { x: 0, y: 0 } });

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });
  });

  test("should not show loading state after sync completes", async ({
    page,
  }) => {
    await page.waitForTimeout(3000); // Give sync time to complete

    // Should not show "Loading playlists..." text
    await expect(page.getByText(/Loading playlists/i)).not.toBeVisible();

    // Playlist button should be enabled and show content
    const playlistButton = page
      .locator("button")
      .filter({ hasText: /Irish Flute|9001/i })
      .first();
    await expect(playlistButton).toBeEnabled();
  });
});
