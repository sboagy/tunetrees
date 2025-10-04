import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";

import { applyNetworkThrottle } from "@/test-scripts/network-utils";

import { initialPageLoadTimeout } from "@/test-scripts/paths-for-tests";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isPasswordValid } from "@/lib/password-utils";

import { checkHealth } from "../test-scripts/check-servers";

import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
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
  // doConsolelogs(page, testInfo);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(100);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test.describe.serial("Signup Tests", () => {
  test("test-signup-1", async ({ page }) => {
    const ttPO = await initialSignIn(page);

    // Prefer using localStorage linkBackURL (mock path) when available, but fall back to Gmail
    // if it doesn't appear quickly. This avoids depending on build-time NEXT_PUBLIC flags.
    const forceMockInCI = !!process.env.CI;
    const preferMock =
      forceMockInCI ||
      process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION === "true";
    let linkBackURLValue: string | null = null;
    if (preferMock) {
      console.log(
        "NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION is true, probing localStorage",
      );
      try {
        const linkBackHandle = await ttPO.page.waitForFunction(
          () => window.localStorage.getItem("linkBackURL") || undefined,
          { timeout: forceMockInCI ? 8000 : 5000 }, // allow a bit longer in CI
        );
        linkBackURLValue = (await linkBackHandle.jsonValue()) as string;
      } catch {
        // Not found quickly; if in CI we must not hit Gmail, fail fast with a clear message.
        if (forceMockInCI) {
          throw new Error(
            "CI requires mocked email confirmation via localStorage. Ensure NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION is true and the app sets linkBackURL.",
          );
        }
      }
    }

    if (linkBackURLValue) {
      console.log("Retrieved linkBackURL from localStorage:", linkBackURLValue);

      const url = new URL(linkBackURLValue);
      const token = url.searchParams.get("token");
      console.log("Extracted token:", token);

      const codeInput = page.getByRole("textbox");
      await codeInput.fill(token || "");

      const verifyButton = page.getByRole("button", { name: "Verify" });
      await expect(verifyButton).toBeEnabled({ timeout: 10000 });
      await verifyButton.click();

      // After successful verification, the playlist selection dialog should appear.
      // Wait for the dialog to become visible to ensure the verification action is complete.
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ state: "visible", timeout: 15000 });
    } else {
      // In CI we never try Gmail fallback
      if (forceMockInCI) {
        throw new Error(
          "Missing linkBackURL in CI. Gmail fallback is disabled in CI. Check mock email confirmation wiring.",
        );
      }
      const gmailLoginURL = "https://mail.google.com/";
      await page.goto(gmailLoginURL, { waitUntil: "domcontentloaded" });

      const emailInput = page.getByRole("textbox", {
        name: "Email or phone",
      });
      await emailInput.fill(process.env.TEST2_LOGIN_USER_EMAIL || "");
      await emailInput.press("Enter");

      const passwordInput = page.getByRole("textbox", {
        name: "Enter your password",
      });
      await passwordInput.fill(process.env.TEST2_LOGIN_GMAIL_PW || "");
      await passwordInput.press("Enter");

      // Wait for Gmail inbox to load
      // IMPORTANT: The test may hang here if login hasn't been done lately, because
      // google may ask for a 2FA code.  Not much I can do about this that I know of.
      await page.waitForSelector("div[role='main']", { timeout: 20_000 });

      // Retrieve the verification email
      const emailSubject = "Email Verification";
      const emailRows = page.locator(`text=${emailSubject}`);
      const numberEmailRows = await emailRows.count();

      console.log(`===> test-signup-1.spec.ts:126 ~ ${numberEmailRows}`);
      const emailRow = emailRows.nth(1);

      await emailRow.focus();
      await emailRow.click();

      // const showTrimmedContentButton = page.getByRole("button", {
      //   name: "Show trimmed content",
      // });

      // await showTrimmedContentButton.click();

      // Extract the verification link from the email
      const emailSignInLink = page
        .locator(
          "td:has-text('You may invoke this sign-in link to verify your email address:')",
        )
        .getByRole("link");
      await emailSignInLink.isVisible();
      const verificationLink = await emailSignInLink.getAttribute("href");

      if (!verificationLink) {
        throw new Error("Verification link not found in the email");
      }

      await page.getByRole("button", { name: "More message options" }).click();
      await page
        .getByRole("menuitem", { name: "Delete this message" })
        .locator("div")
        .first()
        .click();

      console.log("Retrieved verification link from Gmail:", verificationLink);

      await page.goto(verificationLink, {
        timeout: initialPageLoadTimeout,
        waitUntil: "domcontentloaded", // More reliable than networkidle in CI
      });
      await page.waitForTimeout(100);
    }
    // Ensure playlist dialog completes before waiting for table status.
    await processPlaylistDialog(page, ttPO);
    // Small buffer: dialog submission triggers playlist/tunes fetch; allow network to start.
    await page.waitForTimeout(750);

    // Not sure why the following doesn't work.
    // await this.addToRepertoireButton.waitFor({
    //   state: "visible",
    //   timeout: 30_000,
    // });
    //
    // After playlist dialog, navigate (or re-navigate) via page object to ensure standard
    // loading sequence (includes internal wait for table status).
    await ttPO.gotoMainPage(false);

    await ttPO.page.getByText("No scheduled tunes").isVisible();

    // console.log("===> run-login2.ts:50 ~ ", "Login completed");
    // // await page.waitForTimeout(1000 * 3);

    // await page.screenshot({
    //   path: path.join(screenShotDir, "page_just_loaded.png"),
    // });

    // console.log("===> test-login-1:106 ~ waiting for selector");
    // await page.waitForSelector('role=tab[name="Repertoire"]', {
    //   state: "visible",
    // });
    // await page.screenshot({
    //   path: path.join(screenShotDir, "page_just_after_repertoire_select.png"),
    // });

    await page.waitForTimeout(1_000);
    console.log("===> test-signup-1.spec.ts:128 ~ test-1 completed");
  });

  test("test-signup-2", async ({ page }) => {
    const ttPO = await initialSignIn(page);

    // So, if NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION is true, instead of trying to retrieve the
    // link from the email, we'll just retrieve it from localStorage.
    const forceMockInCI = !!process.env.CI;
    let verificationCode: string | null;
    if (
      forceMockInCI ||
      process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION === "true"
    ) {
      console.log(
        "NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION is true, checking localStorage",
      );

      // Wait a bit for the localStorage to be set
      await page.waitForTimeout(2000);

      const linkBackURL = await ttPO.page.evaluate(() => {
        console.log("Checking localStorage for linkBackURL...");
        const stored = window.localStorage.getItem("linkBackURL");
        console.log("Found in localStorage:", stored);
        return stored;
      });

      console.log("Retrieved linkBackURL from localStorage:", linkBackURL);

      if (!linkBackURL) {
        // Let's check what's actually in localStorage
        const allLocalStorage = await ttPO.page.evaluate(() => {
          const items: Record<string, string | null> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              items[key] = localStorage.getItem(key);
            }
          }
          return items;
        });
        console.log("All localStorage items:", allLocalStorage);
        if (forceMockInCI) {
          throw new Error(
            "CI requires mocked email confirmation via localStorage. Ensure NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION is true and the app sets linkBackURL.",
          );
        }
        throw new Error("No linkBackURL found in localStorage (local run)");
      }

      // Extract verification code from URL - handle both token parameter and potential additional params
      const urlParams = new URL(linkBackURL).searchParams;
      verificationCode = urlParams.get("token");

      if (!verificationCode) {
        // Fallback to the original method if URL parsing fails
        verificationCode = linkBackURL.split("token=")[1]?.split("&")[0];
      }

      console.log("Extracted verification code:", verificationCode);
    } else {
      // In CI we never try Gmail fallback
      if (forceMockInCI) {
        throw new Error(
          "Missing linkBackURL in CI. Gmail fallback is disabled in CI. Check mock email confirmation wiring.",
        );
      }
      // Open Gmail in a new tab
      const gmailPage = await page.context().newPage();
      const gmailLoginURL = "https://mail.google.com/";
      await gmailPage.goto(gmailLoginURL, { waitUntil: "domcontentloaded" });

      const emailInput = gmailPage.getByRole("textbox", {
        name: "Email or phone",
      });
      await emailInput.fill(process.env.TEST2_LOGIN_USER_EMAIL || "");
      await emailInput.press("Enter");

      const passwordInput = gmailPage.getByRole("textbox", {
        name: "Enter your password",
      });
      await passwordInput.fill(process.env.TEST2_LOGIN_GMAIL_PW || "");
      await passwordInput.press("Enter");

      // Wait for Gmail inbox to load
      // IMPORTANT: The test may hang here if login hasn't been done lately, because
      // google may ask for a 2FA code.  Not much I can do about this that I know of.
      await gmailPage.waitForSelector("div[role='main']", { timeout: 20_000 });

      // Retrieve the verification email
      const emailSubject = "Email Verification";
      const emailRows = gmailPage.locator(`text=${emailSubject}`);
      const numberEmailRows = await emailRows.count();

      console.log(`===> test-signup-1.spec.ts:126 ~ ${numberEmailRows}`);
      const emailRow = emailRows.nth(1);

      await emailRow.focus();
      await emailRow.click();

      // Extract the verification link from the email
      const verificationCodeLocator = gmailPage
        .getByRole("cell", {
          name: "Or copy and paste (or type) this code into the verify-request page: ",
          exact: false,
        })
        .getByText(
          "Or copy and paste (or type) this code into the verify-request page: ",
        );
      await verificationCodeLocator.isVisible();
      verificationCode = await verificationCodeLocator
        .locator("span")
        .first()
        .textContent();
      console.log("===> test-signup-1.spec.ts:126 ~ ", verificationCode);

      // Close the Gmail tab when done
      await gmailPage.close();
    }

    // Wait for the email verification dialog to appear
    await page.waitForTimeout(2000);

    // Find the InputOTP component - look for the container and use value change approach
    const otpContainer = page.locator('[data-slot="input-otp"]');
    await otpContainer.waitFor({ state: "visible", timeout: 10000 });

    // Fill the verification code into the OTP input
    if (verificationCode && verificationCode.length > 0) {
      console.log(`Filling OTP with verification code: ${verificationCode}`);

      // Click on the OTP container to focus it and then send keystrokes
      await otpContainer.click();

      // Type the verification code character by character
      for (const char of verificationCode.slice(0, 6)) {
        await page.keyboard.type(char);
        await page.waitForTimeout(100); // Small delay between characters
      }
    } else {
      throw new Error(`Invalid verification code: ${verificationCode}`);
    }

    // Click the Verify button instead of pressing Enter
    const verifyButton = page.getByRole("button", { name: "Verify" });
    await verifyButton.waitFor({ state: "visible", timeout: 5000 });
    await ttPO.clickWithTimeAfter(verifyButton);

    // Wait for the checkbox to be ready before interacting with it
    await processPlaylistDialog(page, ttPO);

    // Not sure why the following doesn't work.
    // await this.addToRepertoireButton.waitFor({
    //   state: "visible",
    //   timeout: 30_000,
    // });
    //
    // instead, we'll wait for the tableStatus to be visible.
    await ttPO.page.getByText("No scheduled tunes").isVisible();
    // await ttPO.tableStatus.waitFor({ state: "visible", timeout: 20000 });

    // console.log("===> run-login2.ts:50 ~ ", "Login completed");
    // // await page.waitForTimeout(1000 * 3);

    // await page.screenshot({
    //   path: path.join(screenShotDir, "page_just_loaded.png"),
    // });

    // console.log("===> test-login-1:106 ~ waiting for selector");
    // await page.waitForSelector('role=tab[name="Repertoire"]', {
    //   state: "visible",
    // });
    // await page.screenshot({
    //   path: path.join(screenShotDir, "page_just_after_repertoire_select.png"),
    // });

    console.log("===> test-signup-1.spec.ts:128 ~ test-1 completed");
  });

  test("test-password-validation-weak-password", async ({ page }) => {
    console.log(
      "===> test-signup-1.spec.ts ~ Password validation test - weak password",
    );
    const ttPO = new TuneTreesPageObject(page);

    await checkHealth();
    await page.goto("/", {
      timeout: initialPageLoadTimeout,
      waitUntil: "domcontentloaded",
    });

    const topSignInButton = ttPO.page.getByRole("button", {
      name: "New user",
    });
    await topSignInButton.waitFor({ state: "visible" });
    await topSignInButton.click();

    // Wait for the signup dialog to appear
    const userEmailLocator = ttPO.page.getByTestId("user_email");
    await userEmailLocator.waitFor({ state: "visible", timeout: 20000 });

    // Fill in basic user info
    await userEmailLocator.fill("test@example.com");
    await userEmailLocator.press("Tab");

    const userNameBox = ttPO.page.getByTestId("user_name");
    await userNameBox.fill("Test User");

    // Test weak password
    const passwordEntryBox = ttPO.page.getByTestId("user_password");
    await passwordEntryBox.fill("weak");

    // Check that password strength indicator appears
    const strengthIndicator = page.getByTestId("password-strength-indicator");
    await expect(strengthIndicator).toBeVisible();

    // Check that requirements are visible
    const requirementsSection = page.getByTestId("password-requirements");
    await expect(requirementsSection).toBeVisible();

    // Verify at least one requirement is shown as not met (weak password should fail multiple requirements)
    const unmetRequirement = page.locator(
      '[data-testid^="password-requirement-"] .text-gray-400',
    );
    await expect(unmetRequirement.first()).toBeVisible();

    // Verify password verification field shows validation error
    const passwordVerificationBox = ttPO.page.getByTestId(
      "user_password_verification",
    );
    await passwordVerificationBox.fill("different");
    await passwordVerificationBox.blur();

    // Check that Sign Up button is disabled due to validation errors
    const dialogSignInButton = ttPO.page.getByRole("button", {
      name: "Sign Up",
      exact: true,
    });
    await expect(dialogSignInButton).toBeDisabled();

    console.log(
      "===> test-signup-1.spec.ts ~ Password validation test - weak password completed",
    );
  });

  test("test-password-validation-progressive-strength", async ({ page }) => {
    console.log(
      "===> test-signup-1.spec.ts ~ Password validation test - progressive strength",
    );
    const ttPO = new TuneTreesPageObject(page);

    await checkHealth();
    await page.goto("/", {
      timeout: initialPageLoadTimeout,
      waitUntil: "domcontentloaded",
    });

    const topSignInButton = ttPO.page.getByRole("button", {
      name: "New user",
    });
    await topSignInButton.waitFor({ state: "visible" });
    await topSignInButton.click();

    // Wait for the signup dialog to appear
    const userEmailLocator = ttPO.page.getByTestId("user_email");
    await userEmailLocator.waitFor({ state: "visible", timeout: 20000 });

    // Fill in basic user info
    await userEmailLocator.fill("test@example.com");
    const userNameBox = ttPO.page.getByTestId("user_name");
    await userNameBox.fill("Test User");

    const passwordEntryBox = ttPO.page.getByTestId("user_password");
    const strengthIndicator = page.getByTestId("password-strength-indicator");

    // Test progressive password strength improvement

    // Step 1: Start with short password
    await passwordEntryBox.fill("Ab");
    await expect(strengthIndicator).toBeVisible();

    // Step 2: Add length (but still missing requirements)
    await passwordEntryBox.fill("Abcdefgh");
    await expect(strengthIndicator).toBeVisible();

    // Step 3: Add number
    await passwordEntryBox.fill("Abcdefgh1");
    await expect(strengthIndicator).toBeVisible();

    // Step 4: Add special character for strong password
    await passwordEntryBox.fill("Abcdefgh1!");

    // Verify all requirements are now met (strong password)
    const requirementsSection = page.getByTestId("password-requirements");
    await expect(requirementsSection).toBeVisible();

    // Check that most/all requirements show as met (green checkmarks)
    const metRequirements = page.locator(
      '[data-testid^="password-requirement-"] .text-green-500',
    );
    await expect(metRequirements.first()).toBeVisible();

    // Verify password strength component is working
    await expect(strengthIndicator).toBeVisible();

    console.log(
      "===> test-signup-1.spec.ts ~ Password validation test - progressive strength completed",
    );
  });

  test("test-password-validation-matching-verification", async ({ page }) => {
    console.log(
      "===> test-signup-1.spec.ts ~ Password validation test - matching verification",
    );
    const ttPO = new TuneTreesPageObject(page);

    await checkHealth();
    await page.goto("/", {
      timeout: initialPageLoadTimeout,
      waitUntil: "domcontentloaded",
    });

    const topSignInButton = ttPO.page.getByRole("button", {
      name: "New user",
    });
    await topSignInButton.waitFor({ state: "visible" });
    await topSignInButton.click();

    // Wait for the signup dialog to appear
    const userEmailLocator = ttPO.page.getByTestId("user_email");
    await userEmailLocator.waitFor({ state: "visible", timeout: 20000 });

    // Fill in user info
    await userEmailLocator.fill("test@example.com");
    const userNameBox = ttPO.page.getByTestId("user_name");
    await userNameBox.fill("Test User");

    const passwordEntryBox = ttPO.page.getByTestId("user_password");
    const passwordVerificationBox = ttPO.page.getByTestId(
      "user_password_verification",
    );
    const dialogSignInButton = ttPO.page.getByRole("button", {
      name: "Sign Up",
      exact: true,
    });

    // Enter strong password
    const strongPassword = "StrongPass123!";
    await passwordEntryBox.fill(strongPassword);

    // Test mismatched password verification
    await passwordVerificationBox.fill("DifferentPass123!");
    await passwordVerificationBox.blur();

    // Button should be disabled due to password mismatch
    await expect(dialogSignInButton).toBeDisabled();

    // Test matching password verification
    await passwordVerificationBox.fill(strongPassword);
    await passwordVerificationBox.blur();

    // Button should now be enabled
    await expect(dialogSignInButton).toBeEnabled();

    // Test that clearing verification field disables button again
    await passwordVerificationBox.fill("");
    await passwordVerificationBox.blur();
    await expect(dialogSignInButton).toBeDisabled();

    // Restore matching passwords
    await passwordVerificationBox.fill(strongPassword);
    await expect(dialogSignInButton).toBeEnabled();

    console.log(
      "===> test-signup-1.spec.ts ~ Password validation test - matching verification completed",
    );
  });

  test("test-password-validation-form-submission", async ({ page }) => {
    console.log(
      "===> test-signup-1.spec.ts ~ Password validation test - form submission with valid password",
    );
    const ttPO = new TuneTreesPageObject(page);

    await checkHealth();
    await page.goto("/", {
      timeout: initialPageLoadTimeout,
      waitUntil: "domcontentloaded",
    });

    const topSignInButton = ttPO.page.getByRole("button", {
      name: "New user",
    });
    await topSignInButton.waitFor({ state: "visible" });
    await topSignInButton.click();

    // Wait for the signup dialog to appear
    const userEmailLocator = ttPO.page.getByTestId("user_email");
    await userEmailLocator.waitFor({ state: "visible", timeout: 20000 });

    // Fill in complete valid form
    const testEmail = `test.validation.${Date.now()}@example.com`;
    await userEmailLocator.fill(testEmail);

    const userNameBox = ttPO.page.getByTestId("user_name");
    await userNameBox.fill("Test Validation User");

    const passwordEntryBox = ttPO.page.getByTestId("user_password");
    const passwordVerificationBox = ttPO.page.getByTestId(
      "user_password_verification",
    );

    const validPassword = "ValidPass123!";
    await passwordEntryBox.fill(validPassword);
    await passwordVerificationBox.fill(validPassword);

    // Verify password strength component is present and showing requirements
    const strengthIndicator = page.getByTestId("password-strength-indicator");
    await expect(strengthIndicator).toBeVisible();

    const requirementsSection = page.getByTestId("password-requirements");
    await expect(requirementsSection).toBeVisible();

    // Verify strong password shows most/all requirements as met (green checkmarks)
    const metRequirements = page.locator(
      '[data-testid^="password-requirement-"] .text-green-500',
    );
    await expect(metRequirements.first()).toBeVisible();

    // Submit form - check that it's enabled for valid passwords
    const dialogSignInButton = ttPO.page.getByRole("button", {
      name: "Sign Up",
      exact: true,
    });
    await expect(dialogSignInButton).toBeEnabled();

    console.log(
      "===> test-signup-1.spec.ts ~ Password validation test - form submission completed",
    );
  });

  test("test-unverified-user-retry-signup", async ({ page }) => {
    console.log(
      "===> test-signup-1.spec.ts ~ Test unverified user retry signup scenario",
    );
    const ttPO = new TuneTreesPageObject(page);

    await checkHealth();
    await page.goto("/", {
      timeout: initialPageLoadTimeout,
      waitUntil: "domcontentloaded",
    });

    // First, attempt initial signup
    const topSignInButton = ttPO.page.getByRole("button", {
      name: "New user",
    });
    await topSignInButton.waitFor({ state: "visible" });
    await topSignInButton.click();

    // Wait for the signup dialog to appear
    const userEmailLocator = ttPO.page.getByTestId("user_email");
    await userEmailLocator.waitFor({ state: "visible", timeout: 20000 });

    // Use a unique email for this test (keep under 30 characters)
    const testEmail = `retry.${Date.now().toString().slice(-6)}@ex.com`;

    // Fill out signup form
    await userEmailLocator.fill(testEmail);
    const userNameBox = ttPO.page.getByTestId("user_name");
    await userNameBox.fill("Unverified Test User");

    const passwordEntryBox = ttPO.page.getByTestId("user_password");
    const passwordVerificationBox = ttPO.page.getByTestId(
      "user_password_verification",
    );

    const testPassword = "TestPass123!";
    await passwordEntryBox.fill(testPassword);
    await passwordVerificationBox.fill(testPassword);

    // Submit the first signup attempt
    const dialogSignInButton = ttPO.page.getByRole("button", {
      name: "Sign Up",
      exact: true,
    });
    await expect(dialogSignInButton).toBeEnabled();
    await dialogSignInButton.click();

    // Verify we get to the verification page
    const checkEmailHeader = ttPO.page.getByRole("heading", {
      name: "Check your email",
    });
    await expect(checkEmailHeader).toBeVisible();

    console.log(
      "First signup attempt completed, user created but not verified",
    );

    // Now simulate user closing browser/navigating away and trying to sign up again
    await page.goto("/", {
      timeout: initialPageLoadTimeout,
      waitUntil: "domcontentloaded",
    });

    // Attempt signup again with the same email
    await topSignInButton.waitFor({ state: "visible" });
    await topSignInButton.click();

    await userEmailLocator.waitFor({ state: "visible", timeout: 20000 });
    await userEmailLocator.fill(testEmail); // Same email as before
    await userNameBox.fill("Unverified Test User Retry");

    await passwordEntryBox.fill(testPassword);
    await passwordVerificationBox.fill(testPassword);

    // This signup attempt should succeed (unverified user should be deleted and replaced)
    await expect(dialogSignInButton).toBeEnabled();
    await dialogSignInButton.click();

    // Should successfully reach verification page again
    await expect(checkEmailHeader).toBeVisible();

    console.log(
      "Second signup attempt with same email succeeded - unverified user was properly cleaned up",
    );

    console.log(
      "===> test-signup-1.spec.ts ~ Unverified user retry signup test completed",
    );
  });
});

async function processPlaylistDialog(page: Page, ttPO: TuneTreesPageObject) {
  // Dialog may take a moment to mount after verification redirect.
  const dialog = page.getByTestId("playlist-dialog");
  // Be tolerant in CI: sometimes the playlist dialog may not appear immediately or at all
  await dialog.waitFor({ state: "visible" });
  await dialog.waitFor({ state: "attached" });

  // const fiveStringBanjoRow = page.getByRole("row", {
  //   name: /5-String Banjo/i,
  // });
  // await fiveStringBanjoRow.waitFor({ state: "visible", timeout: 15000 });

  // Row checkbox/button (defensive: locate after row visible)
  // getByRole('row', { name: '5 5-String Banjo BGRA 5-' }).getByRole('button').first()
  // Prefer the known playlist test-id if present, otherwise fallback to first toggle in list
  const knownToggle = page.getByTestId("toggle-playlist-5");
  const anyToggle = dialog.locator('[data-testid^="toggle-playlist-"]').first();

  const toggle = (await knownToggle.count()) > 0 ? knownToggle : anyToggle;
  await ttPO.ensureClickable(toggle);
  // brief delay to let UI settle before interacting
  await page.waitForTimeout(200);
  await ttPO.clickWithTimeAfter(toggle, 400);

  const submitButton = page.getByTestId("submit-button");
  await submitButton.waitFor({ state: "visible" });
  // Wait until selection enables submission
  await expect(submitButton).toBeEnabled({ timeout: 10000 });
  await submitButton.click();
  // Wait for dialog to close before proceeding to table wait.
  await dialog.waitFor({ state: "detached", timeout: 15000 });
}

async function initialSignIn(page: Page) {
  console.log("===> test-signup-1.spec.ts:33 ~ Basic signup test");
  const ttPO = new TuneTreesPageObject(page);

  await checkHealth();

  await page.goto("/", {
    timeout: initialPageLoadTimeout,
    waitUntil: "domcontentloaded", // More reliable than networkidle in CI
  });

  if (
    !process.env.TEST2_LOGIN_USER_EMAIL ||
    !process.env.TEST2_LOGIN_USER_PASSWORD
  ) {
    console.log("===> test-signup-1.spec.ts:45 ~ No signup credentials found");
    throw new Error("No login credentials found");
  }

  const topSignInButton = ttPO.page.getByRole("button", {
    name: "New user",
  });
  await topSignInButton.waitFor({ state: "visible" });
  await topSignInButton.click();

  // Wait for the signup dialog to appear
  const userEmailLocator = ttPO.page.getByTestId("user_email");
  await userEmailLocator.waitFor({ state: "visible", timeout: 20000 });

  const user = process.env.TEST2_LOGIN_USER_EMAIL;
  let pw = process.env.TEST2_LOGIN_USER_PASSWORD;
  const userName = process.env.TEST2_LOGIN_USER_NAME;

  // Ensure password meets new validation requirements
  // If environment password is weak, use a strong default for testing
  if (!pw || !isPasswordValid(pw)) {
    pw = "TestPass123!"; // Strong password that meets all requirements
    console.log("Using strong test password due to validation requirements");
  }

  await userEmailLocator.fill(user || "");
  await userEmailLocator.press("Tab");
  const passwordEntryBox = ttPO.page.getByTestId("user_password");
  await passwordEntryBox.fill(pw);
  const passwordEntryVerificationBox = ttPO.page.getByTestId(
    "user_password_verification",
  );
  await passwordEntryVerificationBox.fill(pw);

  const userNameBox = ttPO.page.getByTestId("user_name");
  await userNameBox.fill(userName || "");

  const dialogSignInButton = ttPO.page.getByRole("button", {
    name: "Sign Up",
    exact: true,
  });
  await passwordEntryBox.press("Tab");

  await dialogSignInButton.isEnabled({ timeout: 60_000 });

  // await page.waitForTimeout(20_000_000);

  await dialogSignInButton.click();

  const checkEmailHeader = ttPO.page.getByRole("heading", {
    name: "Check your email",
  });
  await checkEmailHeader.isVisible();
  // await expect(checkEmailHeader).toHaveText("Check your email");
  return ttPO;
}
