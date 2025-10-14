import { expect, test } from "@playwright/test";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TOPNAV-003: User menu shows Alice's information
 * Priority: Low
 *
 * Tests that the user menu dropdown displays correct user information
 * and allows sign out.
 */

test.use({ storageState: "e2e/.auth/alice.json" });

let ttPage: TuneTreesPage;

test.describe("TOPNAV-003: User Menu Dropdown", () => {
  test.beforeEach(async ({ page }) => {
    ttPage = new TuneTreesPage(page);

    await ttPage.goto();
    await page.waitForTimeout(3000); // Wait for page load
  });

  test("should show user email in TopNav", async () => {
    // User menu button should be visible (email text on desktop, icon on mobile)
    await ttPage.expectUserMenuVisible("alice.test@tunetrees.test");
  });

  test("should open user menu when email clicked", async () => {
    // Click user menu button to open dropdown
    await ttPage.openUserMenu();

    // Menu/dropdown should appear
    await expect(ttPage.userMenuPanel).toBeVisible({ timeout: 2000 });
  });

  test("should display user name in dropdown", async ({ page }) => {
    await ttPage.openUserMenu();

    // Should show Alice's full name
    await expect(page.getByText("Alice Test User")).toBeVisible({
      timeout: 2000,
    });
  });

  test("should display user UUID in dropdown", async ({ page }) => {
    await ttPage.openUserMenu();

    // Should show user ID (UUID format)
    await expect(
      page.getByText(/11111111-1111-1111-1111-111111111111/i)
    ).toBeVisible({ timeout: 2000 });
  });

  test("should show email address in dropdown", async () => {
    await ttPage.openUserMenu();

    // Email should be visible within the dropdown content
    const emailInDropdown = ttPage.userMenuPanel.getByText(
      "alice.test@tunetrees.test"
    );
    await expect(emailInDropdown).toBeVisible({ timeout: 2000 });
  });

  test("should show 'User Settings' button", async ({ page }) => {
    await ttPage.openUserMenu();

    // User Settings button should be present
    const settingsButton = page.getByRole("button", { name: /User Settings/i });
    await expect(settingsButton).toBeVisible({ timeout: 2000 });
  });

  test("should show 'Sign Out' button", async ({ page }) => {
    await ttPage.openUserMenu();

    // Sign Out button should be present
    const signOutButton = page.getByRole("button", { name: /Sign Out/i });
    await expect(signOutButton).toBeVisible({ timeout: 2000 });
  });

  test("should close dropdown when clicking outside", async ({ page }) => {
    await ttPage.openUserMenu();

    // Menu should be visible
    await expect(ttPage.userMenuPanel).toBeVisible();

    // Click outside
    await page.locator("body").click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(300);

    // Menu should close
    await expect(ttPage.userMenuPanel).not.toBeVisible();
  });

  test("should sign out and redirect to login when Sign Out clicked", async ({
    page,
  }) => {
    await ttPage.openUserMenu();

    // Click Sign Out
    await page.getByRole("button", { name: /Sign Out/i }).click();
    await page.waitForTimeout(1000);

    // Should redirect to login page
    await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });

    // User menu button should no longer be visible
    await expect(ttPage.userMenuButton).not.toBeVisible();
  });
});
