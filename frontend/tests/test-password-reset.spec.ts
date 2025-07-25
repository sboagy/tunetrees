import { expect, test } from "@playwright/test";
import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import {
  logTestStart,
  logTestEnd,
  logBrowserContextStart,
  logBrowserContextEnd,
} from "../test-scripts/test-logging";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await restartBackend();
  await page.waitForTimeout(1_000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test.describe("Password Reset Request Flow", () => {
  test("should display password reset request form", async ({ page }) => {
    await page.goto("/auth/password-reset");
    await page.waitForLoadState("domcontentloaded");

    // Check page title and form elements
    await expect(page.locator("h1, h2, h3")).toContainText("Reset");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    console.log("Password reset form is displayed correctly");
  });

  test("should validate email format", async ({ page }) => {
    await page.goto("/auth/password-reset");
    await page.waitForLoadState("domcontentloaded");

    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    // Test invalid email
    await emailInput.fill("invalid-email");
    await emailInput.blur(); // Trigger validation
    await submitButton.click();

    // Wait for form validation to complete and check for error message
    // Look for the error message in various possible containers
    await expect(
      page
        .locator("text=Invalid email")
        .or(page.locator('[role="alert"]', { hasText: "Invalid email" }))
        .or(page.locator(".text-red-800", { hasText: "Invalid email" }))
        .or(page.locator('[data-testid="form-message"]'))
        .first(),
    ).toBeVisible({
      timeout: 10000,
    });
    console.log("Email validation works correctly");
  });

  test("should show success message after form submission", async ({
    page,
  }) => {
    await page.goto("/auth/password-reset");
    await page.waitForLoadState("domcontentloaded");

    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    // Fill with valid email
    await emailInput.fill("test@example.com");
    await submitButton.click();

    // Should show success message (regardless of whether email exists)
    await expect(
      page.locator("text=If an account with that email exists"),
    ).toBeVisible({ timeout: 10000 });

    console.log("Success message displayed correctly");
  });

  test("should have back to login link", async ({ page }) => {
    await page.goto("/auth/password-reset");
    await page.waitForLoadState("domcontentloaded");

    const backLink = page.locator('a[href="/auth/login"]');
    await expect(backLink).toBeVisible();

    console.log("Back to login link is present");
  });
});

test.describe("Password Reset from Login Page", () => {
  test("should navigate to password reset from login page", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await page.waitForLoadState("domcontentloaded");

    // Find and click the "Forgot password?" link
    const forgotPasswordLink = page.locator('a[href="/auth/password-reset"]');
    await expect(forgotPasswordLink).toBeVisible();

    await forgotPasswordLink.click();
    await page.waitForLoadState("domcontentloaded");

    // Should be on password reset page
    expect(page.url()).toContain("/auth/password-reset");
    await expect(page.locator("h1, h2, h3")).toContainText("Reset");

    console.log("Navigation from login to password reset works");
  });
});

test.describe("Password Reset Completion Flow", () => {
  test("should display password reset form with valid token", async ({
    page,
  }) => {
    const testEmail = "test@example.com";
    const testToken = "123456";

    await page.goto(
      `/auth/reset-password?token=${testToken}&email=${encodeURIComponent(testEmail)}`,
    );
    await page.waitForLoadState("domcontentloaded");

    // Check form elements
    await expect(page.locator('input[type="password"]')).toHaveCount(2); // password and confirm
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    console.log("Password reset completion form displays correctly");
  });

  test("should validate password requirements", async ({ page }) => {
    const testEmail = "test@example.com";
    const testToken = "123456";

    await page.goto(
      `/auth/reset-password?token=${testToken}&email=${encodeURIComponent(testEmail)}`,
    );
    await page.waitForLoadState("domcontentloaded");

    const passwordInput = page.locator('input[type="password"]').first();
    const confirmInput = page.locator('input[type="password"]').last();
    const submitButton = page.locator('button[type="submit"]');

    // Test weak password
    await passwordInput.fill("weak");
    await confirmInput.fill("weak");
    await submitButton.click();

    // Should show validation errors
    await expect(page.locator("text=at least 8 characters")).toBeVisible();

    console.log("Password validation works correctly");
  });

  test("should validate password confirmation match", async ({ page }) => {
    const testEmail = "test@example.com";
    const testToken = "123456";

    await page.goto(
      `/auth/reset-password?token=${testToken}&email=${encodeURIComponent(testEmail)}`,
    );
    await page.waitForLoadState("domcontentloaded");

    const passwordInput = page.locator('input[type="password"]').first();
    const confirmInput = page.locator('input[type="password"]').last();
    const submitButton = page.locator('button[type="submit"]');

    // Test mismatched passwords
    await passwordInput.fill("Password123!");
    await confirmInput.fill("Password456!");
    await submitButton.click();

    await expect(page.locator("text=don't match")).toBeVisible();

    console.log("Password confirmation validation works");
  });

  test("should show password visibility toggle", async ({ page }) => {
    const testEmail = "test@example.com";
    const testToken = "123456";

    await page.goto(
      `/auth/reset-password?token=${testToken}&email=${encodeURIComponent(testEmail)}`,
    );
    await page.waitForLoadState("domcontentloaded");

    // Check for eye icons (password visibility toggles)
    const visibilityToggles = page.locator('button[aria-label*="password"]');
    await expect(visibilityToggles).toHaveCount(2); // one for each password field

    console.log("Password visibility toggles are present");
  });

  test("should handle missing token/email parameters", async ({ page }) => {
    // Test missing token
    await page.goto("/auth/reset-password");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=Invalid reset link")).toBeVisible();

    console.log("Missing parameters handled correctly");
  });

  test("should have back to login link", async ({ page }) => {
    const testEmail = "test@example.com";
    const testToken = "123456";

    await page.goto(
      `/auth/reset-password?token=${testToken}&email=${encodeURIComponent(testEmail)}`,
    );
    await page.waitForLoadState("domcontentloaded");

    const backLink = page.locator('a[href="/auth/login"]');
    await expect(backLink).toBeVisible();

    console.log("Back to login link is present");
  });
});

test.describe("Error Handling", () => {
  test("should handle network errors gracefully", async ({ page }) => {
    await page.goto("/auth/password-reset");
    await page.waitForLoadState("domcontentloaded");

    // Simulate network failure by returning 500 error
    await page.route("**/api/auth/password-reset", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Server error" }),
      }),
    );

    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill("test@example.com");
    await submitButton.click();

    // Should show error message containing "error" or "failed"
    await expect(
      page
        .locator('text="An error occurred"')
        .or(page.locator('text="Failed"'))
        .or(page.locator('text="Server error"'))
        .or(page.locator(".text-red-800"))
        .first(),
    ).toBeVisible({ timeout: 10000 });

    console.log("Network error handling works");
  });

  test("should disable form during submission", async ({ page }) => {
    await page.goto("/auth/password-reset");
    await page.waitForLoadState("domcontentloaded");

    // Delay the API response to test loading state
    await page.route("**/api/auth/password-reset", async (route) => {
      await page.waitForTimeout(1000); // Delay response
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Reset email sent" }),
      });
    });

    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill("test@example.com");
    await submitButton.click();

    // Button should be disabled during submission
    await expect(submitButton).toBeDisabled({ timeout: 5000 });

    console.log("Form is disabled during submission");
  });
});
