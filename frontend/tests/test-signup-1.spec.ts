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

    // So, if NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION is true, instead of trying to retrieve the
    // link from the email, we'll just retrieve it from localStorage.
    if (process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION === "true") {
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
        throw new Error("No linkBackURL found in localStorage");
      }

      await page.goto(linkBackURL, {
        timeout: initialPageLoadTimeout,
        waitUntil: "domcontentloaded", // More reliable than networkidle in CI
      });
    } else {
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
    }

    await page.waitForTimeout(4_000);

    await processPlaylistDialog(page);

    // Not sure why the following doesn't work.
    // await this.addToRepertoireButton.waitFor({
    //   state: "visible",
    //   timeout: 30_000,
    // });
    //
    // instead, we'll wait for the tableStatus to be visible.
    await ttPO.tableStatus.waitFor({ state: "visible", timeout: 20_0000 });

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

  test("test-signup-2", async ({ page }) => {
    const ttPO = await initialSignIn(page);

    // So, if NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION is true, instead of trying to retrieve the
    // link from the email, we'll just retrieve it from localStorage.
    let verificationCode: string | null;
    if (process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION === "true") {
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
        throw new Error("No linkBackURL found in localStorage");
      }

      verificationCode = linkBackURL.split("token=")[1];
    } else {
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

    const verificationCodeInput = page.locator("#verificationCode");
    await verificationCodeInput.isVisible();
    await verificationCodeInput.fill(verificationCode || "");
    await verificationCodeInput.press("Enter");

    await page.waitForTimeout(4_000);

    // Wait for the checkbox to be ready before interacting with it
    await processPlaylistDialog(page);

    // Not sure why the following doesn't work.
    // await this.addToRepertoireButton.waitFor({
    //   state: "visible",
    //   timeout: 30_000,
    // });
    //
    // instead, we'll wait for the tableStatus to be visible.
    await ttPO.tableStatus.waitFor({ state: "visible", timeout: 20_0000 });

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
    await page.goto("https://localhost:3000", {
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
    const strengthIndicator = page.locator(
      'span.text-sm.font-medium:has-text("Password Strength")',
    );
    await expect(strengthIndicator).toBeVisible();

    // Check that requirements are visible
    const requirementsHeader = page.getByText("Requirements:");
    await expect(requirementsHeader).toBeVisible();

    // Verify progress bar is present and shows weak strength
    const progressBar = page.locator('div[role="progressbar"]');
    await expect(progressBar).toBeVisible();

    // Verify strength text shows "weak" - target the visible strength indicator
    const strengthText = page.locator(
      'span.text-sm.font-medium.capitalize:has-text("weak")',
    );
    await expect(strengthText).toBeVisible();

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
    await page.goto("https://localhost:3000", {
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
    const progressBar = page.locator('div[role="progressbar"]');

    // Test progressive password strength improvement

    // Step 1: Start with short password
    await passwordEntryBox.fill("Ab");
    await expect(progressBar).toBeVisible();

    // Step 2: Add length (but still missing requirements)
    await passwordEntryBox.fill("Abcdefgh");
    await expect(progressBar).toBeVisible();

    // Step 3: Add number
    await passwordEntryBox.fill("Abcdefgh1");
    await expect(progressBar).toBeVisible();

    // Step 4: Add special character for strong password
    await passwordEntryBox.fill("Abcdefgh1!");
    await expect(
      page.locator('span.text-sm.font-medium.capitalize:has-text("strong")'),
    ).toBeVisible();
    await expect(progressBar).toBeVisible();

    // Verify password strength component is working
    const strengthIndicator = page.locator(
      'span.text-sm.font-medium:has-text("Password Strength")',
    );
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
    await page.goto("https://localhost:3000", {
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
    await page.goto("https://localhost:3000", {
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

    // Verify password strength shows as Strong
    const strengthText = page.locator(
      'span.text-sm.font-medium.capitalize:has-text("strong")',
    );
    await expect(strengthText).toBeVisible();

    // Verify password strength component is present
    const strengthIndicator = page.locator(
      'span.text-sm.font-medium:has-text("Password Strength")',
    );
    await expect(strengthIndicator).toBeVisible();

    // Verify progress bar is present
    const progressBar = page.locator('div[role="progressbar"]');
    await expect(progressBar).toBeVisible();

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
    await page.goto("https://localhost:3000", {
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
    await page.goto("https://localhost:3000", {
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

async function processPlaylistDialog(page: Page) {
  const fiveStringBanjoRow = page.getByRole("row", {
    name: "5-String Banjo BGRA 5",
  });
  await fiveStringBanjoRow.waitFor({ state: "visible", timeout: 10000 });

  const fiveStringBanjoCheckBox = fiveStringBanjoRow
    .getByRole("button")
    .first();
  await fiveStringBanjoCheckBox.waitFor({ state: "visible" });
  await expect(fiveStringBanjoCheckBox).toBeEnabled();
  await page.waitForTimeout(500);
  await fiveStringBanjoCheckBox.click();

  // Wait for any UI updates after clicking the checkbox
  await page.waitForTimeout(500);

  const submitButton = page.getByTestId("submit-button");
  await submitButton.waitFor({ state: "visible" });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
}

async function initialSignIn(page: Page) {
  console.log("===> test-signup-1.spec.ts:33 ~ Basic signup test");
  const ttPO = new TuneTreesPageObject(page);

  await checkHealth();

  await page.goto("https://localhost:3000", {
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
    name: "We sent a verification link to",
  });
  await checkEmailHeader.isVisible();
  // await expect(checkEmailHeader).toHaveText("Check your email");
  return ttPO;
}
