import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { expect, test } from "@playwright/test";
import {
  logTestStart,
  logTestEnd,
  logBrowserContextStart,
  logBrowserContextEnd,
} from "../test-scripts/test-logging";

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await restartBackend();
  await page.waitForTimeout(100);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test.describe("Auth Loading States", () => {
  test("login form shows loading state during submission", async ({ page }) => {
    // Navigate to login page
    await page.goto("https://localhost:3000/auth/login", {
      waitUntil: "domcontentloaded", // More reliable than networkidle in CI
    });
    await page.waitForLoadState("domcontentloaded");

    // Wait for form to load
    await expect(page.getByTestId("user_email")).toBeVisible();
    await expect(page.getByTestId("user_password")).toBeVisible();

    // Fill in valid credentials
    await page.getByTestId("user_email").fill("test@example.com");
    await page.getByTestId("user_password").fill("testpassword");

    // Click submit and immediately check for loading state
    const submitButton = page.getByTestId("login-submit-button");
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    // The text should change when loading
    await expect(submitButton).toContainText("Sign In");

    // Start submission (this will likely fail due to invalid credentials, but we can check loading state)
    const submitPromise = submitButton.click();

    // Check that loading state appears quickly
    await expect(submitButton).toContainText("Signing In...");
    await expect(submitButton).toBeDisabled();

    // Wait for submission to complete
    await submitPromise;

    // Eventually the loading state should clear
    await expect(submitButton).toContainText("Sign In", { timeout: 10000 });
  });

  test("signup form shows loading state during submission", async ({
    page,
  }) => {
    // Navigate to signup page
    await page.goto("https://localhost:3000/auth/newuser", {
      waitUntil: "domcontentloaded", // More reliable than networkidle in CI
    });
    await page.waitForLoadState("domcontentloaded");
    // Wait for form to load
    await expect(page.getByTestId("user_email")).toBeVisible();
    await expect(page.getByTestId("user_password")).toBeVisible();
    await expect(page.getByTestId("user_password_verification")).toBeVisible();
    await expect(page.getByTestId("user_name")).toBeVisible();

    // Fill in form data
    await page.getByTestId("user_email").fill("newuser@example.com");
    await page.getByTestId("user_password").fill("testpassword123");
    await page
      .getByTestId("user_password_verification")
      .fill("testpassword123");
    await page.getByTestId("user_name").fill("Test User");

    // Check submit button is enabled
    const submitButton = page.getByTestId("signup-submit-button");
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
    await expect(submitButton).toContainText("Sign Up");

    // Start submission
    const submitPromise = submitButton.click();

    // Check loading state appears
    await expect(submitButton).toContainText("Creating Account...");
    await expect(submitButton).toBeDisabled();

    // Wait for submission to complete
    await submitPromise;

    // Note: This might redirect or show errors, which is fine for this test
  });

  test("social login buttons show loading states", async ({ page }) => {
    // Navigate to login page
    await page.goto("https://localhost:3000/auth/login", {
      waitUntil: "domcontentloaded", // More reliable than networkidle in CI
    });
    await page.waitForLoadState("domcontentloaded");
    // Look for social login buttons (these may or may not be present depending on config)
    const socialButtons = page.locator('[data-testid^="social-login-"]');

    if ((await socialButtons.count()) > 0) {
      const firstSocialButton = socialButtons.first();
      await expect(firstSocialButton).toBeVisible();

      // Check initial state
      const initialText = await firstSocialButton.textContent();
      console.log("Initial social button text:", initialText);

      // Click the social login button
      const clickPromise = firstSocialButton.click();

      // Check that loading state appears (now has 300ms delay so should be visible)
      await expect(firstSocialButton).toContainText("Connecting...");
      await expect(firstSocialButton).toBeDisabled();

      // Wait for the click to complete (which will navigate)
      await clickPromise;
    } else {
      console.log("No social login buttons found - skipping social login test");
    }
  });
});
