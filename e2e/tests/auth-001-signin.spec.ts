import { expect, test } from "@playwright/test";

const ALICE_EMAIL = "alice.test@tunetrees.test";
const ALICE_PASSWORD = process.env.ALICE_TEST_PASSWORD;

/**
 * AUTH-001: Sign in with valid credentials
 * Priority: Critical
 *
 * Tests the complete authentication flow for Alice test user,
 * including login, redirect, and initial sync completion.
 *
 * NOTE: This test runs in the "chromium-auth" project which does NOT
 * use saved authentication state and does NOT depend on setup.
 * It tests the login flow from scratch.
 */

test.describe("AUTH-001: User Authentication", () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all storage to ensure clean state
    await context.clearCookies();
    await page.goto("http://localhost:5173");
  });

  test("should redirect to login page when not authenticated", async ({
    page,
  }) => {
    // Verify redirect to login page
    await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });

    // Verify login form is visible
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("should sign in successfully with valid credentials", async ({
    page,
  }) => {
    // Navigate to login
    await page.goto("http://localhost:5173/login");

    // Fill in Alice's credentials
    await page.getByLabel("Email").fill(ALICE_EMAIL);

    if (!ALICE_PASSWORD) {
      throw new Error(
        "ALICE_TEST_PASSWORD environment variable is not set; please set ALICE_TEST_PASSWORD to the test user's password before running E2E tests."
      );
    }

    await page.locator("input#password").fill(ALICE_PASSWORD);

    // Click Sign In button
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for redirect away from login page
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 10000,
    });

    // Wait for user email to appear in TopNav (confirms logged in)
    await expect(page.getByText(ALICE_EMAIL)).toBeVisible({
      timeout: 10000,
    });

    // Wait for sync to complete - look for "Synced" or database status indicator
    // This may take a few seconds for initial sync
    await page.waitForTimeout(5000);

    // Verify no error messages
    await expect(page.getByText(/error/i)).not.toBeVisible();
    await expect(page.getByText(/invalid/i)).not.toBeVisible();
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.goto("http://localhost:5173/login");

    // Try to sign in with wrong password
    await page.getByLabel("Email").fill(ALICE_EMAIL);
    await page.locator("input#password").fill("WrongPassword123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should stay on login page
    await expect(page).toHaveURL(/.*\/login/, { timeout: 3000 });

    // Should show some error indication (adjust selector based on your error UI)
    // This might be a toast, alert, or inline error message
    await expect(
      page.getByText(/invalid|incorrect|failed/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
