import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TOPNAV-004: Playlist Manager Modal Dialog
 * Priority: High
 *
 * Tests that the "Manage Playlists..." button opens a modal dialog
 * instead of navigating to a separate page, matching the legacy app behavior.
 */

let ttPage: TuneTreesPage;
let currentTestUser: TestUser;

test.describe("TOPNAV-004: Playlist Manager Modal", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
  });

  // Helper: open TopNav playlist dropdown and then open the manager modal
  async function openPlaylistManagerModal() {
    const { page } = ttPage;
    const playlistButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
      .first();

    await expect(playlistButton).toBeVisible({ timeout: 10000 });
    await playlistButton.click();

    // Dropdown panel visible
    await expect(ttPage.topNavManagePlaylistsPanel).toBeVisible({
      timeout: 5000,
    });

    // Click "Manage Playlists..."
    await page.getByRole("button", { name: /Manage Playlists/i }).click();

    // Wait for modal
    const modal = page.getByTestId("playlist-manager-dialog");
    await expect(modal).toBeVisible({ timeout: 10000 });
    return { modal };
  }

  test("should open playlist manager modal when clicking 'Manage Playlists' button", async () => {
    const { modal } = await openPlaylistManagerModal();
    await expect(ttPage.page.getByText("Manage Playlists")).toBeVisible({
      timeout: 5000,
    });
    await expect(modal).toBeVisible();
  });

  test("should display playlist list in modal", async () => {
    const { modal } = await openPlaylistManagerModal();
    await expect(modal.getByText(/Showing.*playlists/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("should close modal when clicking X button", async () => {
    const { modal } = await openPlaylistManagerModal();
    await ttPage.page.getByTestId("close-playlist-manager").click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test("should close modal when clicking backdrop", async () => {
    const { modal } = await openPlaylistManagerModal();
    await ttPage.page
      .getByTestId("playlist-manager-backdrop")
      .click({ position: { x: 10, y: 10 } });
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test("should close modal when pressing Escape key", async () => {
    const { modal } = await openPlaylistManagerModal();
    await ttPage.page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test("should have Create New Playlist button in modal", async () => {
    await openPlaylistManagerModal();
    const createButton = ttPage.page.getByTestId("create-playlist-button");
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await expect(createButton).toContainText(/Create New Playlist/i);
  });

  test("should not navigate to /playlists route when opening modal", async () => {
    const initialUrl = ttPage.page.url();
    await openPlaylistManagerModal();
    expect(ttPage.page.url()).toBe(initialUrl);
  });
});
