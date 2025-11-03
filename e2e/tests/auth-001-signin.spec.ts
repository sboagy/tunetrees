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
  test.beforeEach(async ({ context }) => {
    // Clear all cookies to ensure completely clean auth state
    await context.clearCookies();
  });

  test("should redirect to login page when not authenticated @side-effects", async ({
    page,
  }) => {
    // Navigate to root and clear storage
    await page.goto("http://localhost:5173");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Hard reload to ensure clean state
    await page.reload({ waitUntil: "networkidle" });

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
    // Clear storage and navigate directly to login
    await page.goto("http://localhost:5173/login");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Hard reload with networkidle to ensure login page is fully loaded
    await page.reload({ waitUntil: "networkidle" });

    // Wait for URL to be /login
    await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });

    // Wait for login form to be visible and interactive
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 10000 });

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
    // Clear storage and navigate directly to login
    await page.goto("http://localhost:5173/login");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Hard reload with networkidle to ensure login page is fully loaded
    await page.reload({ waitUntil: "networkidle" });

    // Wait for URL to be /login
    await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });

    // Wait for login form to be visible
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 10000 });

    // Fill in email and wrong password
    await page.getByLabel("Email").fill(ALICE_EMAIL);
    await page.locator("input#password").fill("WrongPassword123!");

    // Click Sign In button
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait a moment for error to appear
    await page.waitForTimeout(1000);

    // Should stay on login page
    await expect(page).toHaveURL(/.*\/login/, { timeout: 3000 });

    // Supabase returns "Invalid login credentials" for wrong password
    // The error should be in a red background div
    const errorBox = page.locator('div.bg-red-50, div[class*="bg-red"]');
    await expect(errorBox).toBeVisible({ timeout: 5000 });

    // Verify error message text (Supabase's standard message)
    await expect(page.getByText(/Invalid login credentials/i)).toBeVisible({
      timeout: 5000,
    });

    // Verify fields are NOT cleared - email should still be filled
    await expect(page.getByLabel("Email")).toHaveValue(ALICE_EMAIL);
    // Password field should still have content (we can't check exact value for security)
    const passwordField = page.locator("input#password");
    const passwordValue = await passwordField.inputValue();
    expect(passwordValue).not.toBe("");
  });
});
