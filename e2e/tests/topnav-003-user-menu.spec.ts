import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { getRequiredTestPassword, type TestUser } from "../helpers/test-users";
import { isAuthFileSessionValid } from "../helpers/auth-state";
import { BASE_URL } from "../test-config";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TOPNAV-003: User menu shows user's information
 * Priority: Low
 *
 * Tests that the user menu dropdown displays correct user information
 * and allows sign out.
 */

let ttPage: TuneTreesPage;
let currentTestUser: TestUser;

test.describe("TOPNAV-003: User Menu Dropdown", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
  });

  test("should show user email in TopNav", async () => {
    // User menu button should be visible (email text on desktop, icon on mobile)
    await ttPage.expectUserMenuVisible(currentTestUser.email);
  });

  test("should open user menu when email clicked", async () => {
    // Click user menu button to open dropdown
    await ttPage.openUserMenu();

    // Menu/dropdown should appear
    await expect(ttPage.userMenuPanel).toBeVisible({ timeout: 2000 });
  });

  test("should display user name in dropdown", async ({ page }) => {
    await ttPage.openUserMenu();

    // Should show user's full name
    await expect(page.getByText(currentTestUser.userId).first()).toBeVisible({
      timeout: 2000,
    });
  });

  test("should display user UUID in dropdown", async ({ page }) => {
    await ttPage.openUserMenu();

    // Should show user ID (UUID format) - just check for UUID pattern
    await expect(
      page.getByText(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      )
    ).toBeVisible({
      timeout: 2000,
    });
  });

  test("should show email address in dropdown", async () => {
    await ttPage.openUserMenu();

    // Email should be visible within the dropdown content
    const emailInDropdown = ttPage.userMenuPanel.getByText(
      currentTestUser.email
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
    testUserKey,
    testUser,
  }) => {
    // Registered-user logout revokes all sessions for that account. Never use
    // the shared worker account here: later browser projects load its saved
    // session again. A disposable account keeps this destructive auth action
    // isolated while still exercising the real registered-user logout path.
    await ttPage.gotoLogin();
    await ttPage.signUp(
      `logout-${randomUUID()}@tunetrees.test`,
      getRequiredTestPassword(),
      "Logout Test"
    );
    await ttPage.waitForHome({ timeoutMs: 30_000 });
    await ttPage.openUserMenu();
    await page.getByRole("button", { name: /Sign Out/i }).click();

    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    await expect(ttPage.userMenuButton).not.toBeVisible({ timeout: 10000 });

    // Check the saved token against Supabase, not just its future expiry.
    // This catches the cross-test session revocation that broke Fluency later.
    expect(
      await isAuthFileSessionValid(
        `e2e/.auth/${testUserKey}.json`,
        String(BASE_URL),
        testUser.email,
        process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321",
        process.env.VITE_SUPABASE_ANON_KEY ?? ""
      )
    ).toBe(true);
  });
});
