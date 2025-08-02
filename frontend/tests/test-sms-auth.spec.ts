import { test, expect } from "@playwright/test";
import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
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
  await page.waitForTimeout(1_000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test.describe("SMS Authentication", () => {
  test.skip("should display SMS login form elements", async ({ page }) => {
    await page.goto("/auth-test");

    // Check that the SMS login section is visible
    const smsSection = page.locator("text=SMS Authentication");
    await expect(smsSection).toBeVisible();

    // Check for SMS login form elements
    const phoneInput = page.getByTestId("sms-phone-input");
    await expect(phoneInput).toBeVisible();

    const sendCodeButton = page.getByTestId("sms-send-code-button");
    await expect(sendCodeButton).toBeVisible();

    // Check initial state
    await expect(sendCodeButton).toBeDisabled(); // Should be disabled when phone is empty
  });

  test.skip("should enable send code button when phone number is entered", async ({
    page,
  }) => {
    await page.goto("/auth-test");

    const phoneInput = page.getByTestId("sms-phone-input");
    const sendCodeButton = page.getByTestId("sms-send-code-button");

    // Initially disabled
    await expect(sendCodeButton).toBeDisabled();

    // Enter phone number
    await phoneInput.fill("+1234567890");

    // Should now be enabled
    await expect(sendCodeButton).toBeEnabled();
  });

  test.skip("should show verification code input after sending code", async ({
    page,
  }) => {
    await page.goto("/auth-test");

    const phoneInput = page.getByTestId("sms-phone-input");
    const sendCodeButton = page.getByTestId("sms-send-code-button");

    // Enter phone number and send code
    await phoneInput.fill("+1234567890");
    await sendCodeButton.click();

    // Wait for the verification step
    await page.waitForTimeout(2000);

    // Check that verification code input is now visible
    const codeInput = page.getByTestId("sms-verification-code-input");
    await expect(codeInput).toBeVisible();

    const verifyButton = page.getByTestId("sms-verify-code-button");
    await expect(verifyButton).toBeVisible();

    const resetButton = page.getByTestId("sms-reset-button");
    await expect(resetButton).toBeVisible();
  });

  test.skip("should allow resetting to phone number step", async ({ page }) => {
    await page.goto("/auth-test");

    const phoneInput = page.getByTestId("sms-phone-input");
    const sendCodeButton = page.getByTestId("sms-send-code-button");

    // Enter phone number and send code
    await phoneInput.fill("+1234567890");
    await sendCodeButton.click();

    // Wait for verification step
    await page.waitForTimeout(2000);

    // Click reset button
    const resetButton = page.getByTestId("sms-reset-button");
    await resetButton.click();

    // Should be back to phone step
    await expect(phoneInput).toBeVisible();
    await expect(sendCodeButton).toBeVisible();

    // Phone input should be empty
    await expect(phoneInput).toHaveValue("");
  });
});
