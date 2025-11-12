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

  test("should open playlist manager modal when clicking 'Manage Playlists' button", async ({
    page,
  }) => {
    // Open playlist dropdown
    const playlistButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
      .first();
    await playlistButton.click();

    // Click "Manage Playlists..." button
    await page.getByRole("button", { name: /Manage Playlists/i }).click();

    // Modal dialog should be visible
    const modal = page.getByTestId("playlist-manager-dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Modal should have title
    await expect(page.getByText("Manage Playlists")).toBeVisible({
      timeout: 2000,
    });
  });

  test("should display playlist list in modal", async ({ page }) => {
    // Open playlist dropdown
    const playlistButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
      .first();
    await playlistButton.click();

    // Click "Manage Playlists..." button
    await page.getByRole("button", { name: /Manage Playlists/i }).click();

    // Modal should be visible
    const modal = page.getByTestId("playlist-manager-dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Should show "Showing X of Y playlists" text
    await expect(modal.getByText(/Showing.*playlists/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should close modal when clicking X button", async ({ page }) => {
    // Open playlist dropdown
    const playlistButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
      .first();
    await playlistButton.click();

    // Click "Manage Playlists..." button
    await page.getByRole("button", { name: /Manage Playlists/i }).click();

    // Modal should be visible
    const modal = page.getByTestId("playlist-manager-dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click close button
    const closeButton = page.getByTestId("close-playlist-manager");
    await closeButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test("should close modal when clicking backdrop", async ({ page }) => {
    // Open playlist dropdown
    const playlistButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
      .first();
    await playlistButton.click();

    // Click "Manage Playlists..." button
    await page.getByRole("button", { name: /Manage Playlists/i }).click();

    // Modal should be visible
    const modal = page.getByTestId("playlist-manager-dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click backdrop
    const backdrop = page.getByTestId("playlist-manager-backdrop");
    await backdrop.click({ position: { x: 10, y: 10 } });

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test("should close modal when pressing Escape key", async ({ page }) => {
    // Open playlist dropdown
    const playlistButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
      .first();
    await playlistButton.click();

    // Click "Manage Playlists..." button
    await page.getByRole("button", { name: /Manage Playlists/i }).click();

    // Modal should be visible
    const modal = page.getByTestId("playlist-manager-dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Press Escape key
    await page.keyboard.press("Escape");

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test("should have Create New Playlist button in modal", async ({ page }) => {
    // Open playlist dropdown
    const playlistButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
      .first();
    await playlistButton.click();

    // Click "Manage Playlists..." button
    await page.getByRole("button", { name: /Manage Playlists/i }).click();

    // Modal should be visible
    const modal = page.getByTestId("playlist-manager-dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Should have "Create New Playlist" button
    const createButton = page.getByTestId("create-playlist-button");
    await expect(createButton).toBeVisible({ timeout: 2000 });
    await expect(createButton).toContainText(/Create New Playlist/i);
  });

  test("should not navigate to /playlists route when opening modal", async ({
    page,
  }) => {
    // Store initial URL
    const initialUrl = page.url();

    // Open playlist dropdown
    const playlistButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.playlistId}`, "i"),
      })
      .first();
    await playlistButton.click();

    // Click "Manage Playlists..." button
    await page.getByRole("button", { name: /Manage Playlists/i }).click();

    // Wait for modal to appear
    const modal = page.getByTestId("playlist-manager-dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // URL should not change (should not navigate to /playlists)
    expect(page.url()).toBe(initialUrl);
  });
});
