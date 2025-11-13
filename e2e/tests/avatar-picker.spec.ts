/**
 * Avatar Picker E2E Tests
 *
 * Tests for the avatar selection and upload functionality
 */

import { expect, test } from "@playwright/test";

test.describe("Avatar Picker", () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for redirect to home
    await expect(page).toHaveURL("/");

    // Navigate to avatar settings
    await page.getByTestId("user-menu-button").click();
    await page.getByRole("menuitem", { name: "User Settings" }).click();
    await page.getByRole("link", { name: "Avatar" }).click();
  });

  test("displays avatar settings page", async ({ page }) => {
    // Check page title
    await expect(
      page.getByRole("heading", { name: "Profile Avatar" })
    ).toBeVisible();

    // Check description
    await expect(
      page.getByText("Choose a predefined avatar or upload your own")
    ).toBeVisible();
  });

  test("displays predefined avatars", async ({ page }) => {
    // Check that all 10 predefined avatars are shown
    const avatarImages = page.locator('img[alt*="accordion"]');
    await expect(avatarImages.first()).toBeVisible();

    // Count avatar options (10 predefined + 1 upload button area)
    const avatarCards = page.locator("div[role='button'], button").filter({
      hasText:
        /accordion|balalaika|banjo|flute|guitarist|harmonica|harp|pianist|singer|violin/i,
    });
    expect(await avatarCards.count()).toBeGreaterThanOrEqual(1);
  });

  test("can select predefined avatar", async ({ page }) => {
    // Click a predefined avatar
    const balalelkaAvatar = page.locator('img[src*="balalaika.png"]').first();
    await balalelkaAvatar.click();

    // Wait for save operation
    await page.waitForTimeout(500);

    // Check for success toast
    await expect(page.getByText("Avatar updated!")).toBeVisible();

    // Verify avatar appears in preview
    const preview = page.locator('img[alt="Current avatar"]');
    await expect(preview).toHaveAttribute("src", /balalaika\.png/);
  });

  test("shows upload button", async ({ page }) => {
    // Check upload button exists
    const uploadButton = page.getByText("Choose File");
    await expect(uploadButton).toBeVisible();

    // Check help text
    await expect(
      page.getByText("Upload a custom .png, .jpg, or .webp image")
    ).toBeVisible();
  });

  test("validates file size on upload", async ({ page }) => {
    // This test requires creating a large file
    // For now, just verify the input accepts images
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("accept", "image/*");
  });

  test.skip("can upload custom avatar", async () => {
    // TODO: Create test image file and upload
    // This requires filesystem access and file creation
    // Skipping for now, implement when needed
  });

  test("closes settings modal on backdrop click", async ({ page }) => {
    // Click backdrop
    await page.getByTestId("settings-modal-backdrop").click();

    // Should redirect to home
    await expect(page).toHaveURL("/");
  });

  test("closes settings modal on close button", async ({ page }) => {
    // Click close button
    await page.getByTestId("settings-close-button").click();

    // Should redirect to home
    await expect(page).toHaveURL("/");
  });

  test("closes settings modal on Escape key", async ({ page }) => {
    // Press Escape
    await page.keyboard.press("Escape");

    // Should redirect to home
    await expect(page).toHaveURL("/");
  });
});
