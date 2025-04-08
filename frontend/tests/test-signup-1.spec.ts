import { restartBackend } from "@/test-scripts/global-setup";

import { applyNetworkThrottle } from "@/test-scripts/network-utils";

import { initialPageLoadTimeout } from "@/test-scripts/paths-for-tests";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { checkHealth } from "../test-scripts/check-servers";

import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";

test.beforeEach(async ({ page }, testInfo) => {
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  // doConsolelogs(page, testInfo);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(100);
});

test.describe.serial("Signup Tests", () => {
  test("test-signup-1", async ({ page }) => {
    const ttPO = await initialSignIn(page);

    // So, if NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION is true, instead of trying to retrieve the
    // link from the email, we'll just retrieve it from localStorage.
    if (process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION === "true") {
      const linkBackURL = await ttPO.page.evaluate(() => {
        return window.localStorage.getItem("linkBackURL");
      });

      console.log("Retrieved linkBackURL from localStorage:", linkBackURL);

      if (!linkBackURL) {
        throw new Error("No linkBackURL found in localStorage");
      }

      await page.goto(linkBackURL, {
        timeout: initialPageLoadTimeout,
        waitUntil: "networkidle",
      });
    } else {
      const gmailLoginURL = "https://mail.google.com/";
      await page.goto(gmailLoginURL, { waitUntil: "networkidle" });

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
        waitUntil: "networkidle",
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
      const linkBackURL = await ttPO.page.evaluate(() => {
        return window.localStorage.getItem("linkBackURL");
      });

      console.log("Retrieved linkBackURL from localStorage:", linkBackURL);

      if (!linkBackURL) {
        throw new Error("No linkBackURL found in localStorage");
      }

      verificationCode = linkBackURL.split("token=")[1];
    } else {
      // Open Gmail in a new tab
      const gmailPage = await page.context().newPage();
      const gmailLoginURL = "https://mail.google.com/";
      await gmailPage.goto(gmailLoginURL, { waitUntil: "networkidle" });

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
    waitUntil: "networkidle",
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
  await topSignInButton.click();
  const userEmailLocator = ttPO.page.getByTestId("user_email");
  const user = process.env.TEST2_LOGIN_USER_EMAIL;
  const pw = process.env.TEST2_LOGIN_USER_PASSWORD;
  const userName = process.env.TEST2_LOGIN_USER_NAME;
  await userEmailLocator.fill(user || "");
  await userEmailLocator.press("Tab");
  const passwordEntryBox = ttPO.page.getByTestId("user_password");
  await passwordEntryBox.fill(pw || "");
  const passwordEntryVerificationBox = ttPO.page.getByTestId(
    "user_password_verification",
  );
  await passwordEntryVerificationBox.fill(pw || "");

  const userNameBox = ttPO.page.getByTestId("user_name");
  await userNameBox.fill(userName || "");

  const dialogSignInButton = ttPO.page.getByRole("button", {
    name: "Sign Up",
    exact: true,
  });
  await passwordEntryBox.press("Tab");

  await dialogSignInButton.isEnabled();

  await dialogSignInButton.click();

  const checkEmailHeader = ttPO.page.getByRole("heading", {
    name: "Please check Your Email to",
  });
  await checkEmailHeader.isVisible();
  await expect(checkEmailHeader).toHaveText(
    "Please check Your Email to log in",
  );
  return ttPO;
}
