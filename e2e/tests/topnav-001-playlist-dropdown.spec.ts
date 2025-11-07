import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TOPNAV-001: Playlist dropdown shows user's playlists
 * Priority: Critical
 *
 * Tests that the playlist dropdown in TopNav correctly displays
 * user's playlist with proper details after login.
 */

let ttPage: TuneTreesPage;
let currentTestUser: TestUser;

test.describe("TOPNAV-001: Playlist Dropdown Population", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
  });

  test("should display default selected playlist in TopNav", async ({
    page,
  }) => {
    // Look for playlist button/dropdown in TopNav
    // Adjust selector based on your actual implementation
    const playlistButton = page.locator("button").filter({
      hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
    });

    await expect(playlistButton).toBeVisible({ timeout: 10000 });

    // Should show playlist name or instrument name
    await expect(playlistButton).toContainText(
      new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i")
    );
  });

  test("should open dropdown menu when clicked", async ({ page }) => {
    // Click the playlist dropdown button
    const playlistButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
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
      .filter({
        hasText: "Irish Flute",
      })
      .first();
    await playlistButton.click();

    // Should show the playlist item with subtitle
    // Show a tunes count; value may vary depending on previous tests adding tunes
    await expect(
      ttPage.topNavManagePlaylistsPanel.getByText(/tunes/i, { exact: false })
    ).toBeVisible({ timeout: 2000 });
    await expect(
      ttPage.topNavManagePlaylistsPanel.getByText(/ITRAD/i, {
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
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
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
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
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
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
      .first();
    await expect(playlistButton).toBeEnabled();
  });
});
