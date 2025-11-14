import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * AVATAR-001: Avatar Picker Tests
 * Priority: Medium
 *
 * Tests for the avatar selection and upload functionality in user settings.
 */

let ttPage: TuneTreesPage;

// biome-ignore lint/correctness/noUnusedVariables: currentTestUser standard setup, but not used yet.
let currentTestUser: TestUser;

test.describe("AVATAR-001: Avatar Picker", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });

    await ttPage.userMenuButton.click();
    await page.waitForTimeout(500);
    await ttPage.userSettingsButton.click();
    await page.waitForTimeout(1000);
    const ua = await page.evaluate(() => navigator.userAgent);
    const isMobileChrome = /Android.*Chrome\/\d+/i.test(ua);
    if (isMobileChrome) {
      await page.waitForTimeout(800);
      await ttPage.settingsMenuToggle.click();
    }
    await page.waitForTimeout(800);

    await ttPage.userSettingsAvatarButton.click();
    await page.waitForTimeout(500);

    // FIXME: close of mobile menu should be automatic
    if (isMobileChrome) {
      // await ttPage.settingsMenuToggle.click();
      const { innerWidth, innerHeight } = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      }));
      await page.mouse.click(innerWidth - 5, Math.floor(innerHeight / 2));
      await page.waitForTimeout(300);
    }
  });

  test("should display avatar settings page", async ({ page }) => {
    // Check page title
    await expect(
      page.getByRole("heading", { name: "Profile Avatar" })
    ).toBeVisible({ timeout: 5000 });

    // Check description
    await expect(
      page.getByText("Choose a predefined avatar or upload your own")
    ).toBeVisible({ timeout: 5000 });
  });

  test("should display predefined avatars", async ({ page }) => {
    // Check that all 10 predefined avatars are shown
    const avatarImages = page.locator('img[alt*="accordion"]');
    await expect(avatarImages.first()).toBeVisible({ timeout: 5000 });

    // Count avatar options (10 predefined + 1 upload button area)
    // const avatarCards = page.locator("div[role='button'], button").filter({
    //   hasText:
    //     /accordion|balalaika|banjo|flute|guitarist|harmonica|harp|pianist|singer|violin/i,
    // });
    const avatarCards = page.getByRole("img", {
      name: /accordion|balalaika|banjo|flute|guitarist|harmonica|harp|pianist|singer|violin/i,
    });
    expect(await avatarCards.count()).toBeGreaterThanOrEqual(10);
  });

  test("should select predefined avatar", async ({ page }) => {
    // Click a predefined avatar
    const balalelkaAvatar = page.locator('img[src*="balalaika.png"]').first();
    await expect(balalelkaAvatar).toBeVisible({ timeout: 5000 });
    await balalelkaAvatar.click();

    // Wait for save operation
    await page.waitForTimeout(1000);

    // Check for success toast
    await expect(page.getByText("Avatar updated!")).toBeVisible({
      timeout: 5000,
    });

    // Verify avatar appears in preview
    const preview = page.locator('img[alt="Current avatar"]');
    await expect(preview).toHaveAttribute("src", /balalaika\.png/, {
      timeout: 5000,
    });
  });

  test("should show upload button", async ({ page }) => {
    // Check upload button exists
    const uploadButton = page.getByText("Choose File");
    await expect(uploadButton).toBeVisible({ timeout: 5000 });

    // Check help text
    await expect(
      page.getByText("Upload a custom .png, .jpg, or .webp image")
    ).toBeVisible({ timeout: 5000 });
  });

  test("should validate file input accepts images", async ({ page }) => {
    // Verify the input accepts images
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("accept", "image/*", {
      timeout: 5000,
    });
  });

  test.skip("should upload custom avatar", async () => {
    // TODO: Create test image file and upload
    // This requires filesystem access and file creation
    // Skipping for now, implement when needed
  });
});
