import { expect, test } from "@playwright/test";
import { restartBackend } from "@/test-scripts/global-setup";
import { runLoginWithCookieSave } from "@/test-scripts/run-login2";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { checkHealth } from "../test-scripts/check-servers";
import { navigateToPageWithRetry } from "../test-scripts/navigation-utils";
import { applyNetworkThrottle } from "../test-scripts/network-utils";
import { setTestDefaults } from "../test-scripts/set-test-defaults";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "../test-scripts/test-logging";

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  // tiny pause to ensure logs flush
  await restartBackend();
  await page.waitForTimeout(10);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test("user-settings redirects to scheduling-options then account form works", async ({
  page,
}) => {
  await checkHealth();

  // Login first
  await navigateToPageWithRetry(page, "/");
  if (process.env.SAVE_COOKIES === "true") {
    await runLoginWithCookieSave(
      page,
      process.env.TEST1_LOGIN_USER_EMAIL,
      process.env.TEST1_LOGIN_USER_PASSWORD,
    );
  } else {
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.runLogin(
      process.env.TEST1_LOGIN_USER_EMAIL,
      process.env.TEST1_LOGIN_USER_PASSWORD,
    );
  }

  // Navigate to /user-settings and verify redirect to /user-settings/scheduling-options (default tab)
  await page.goto("/user-settings", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("domcontentloaded");

  await expect(page).toHaveURL(/\/user-settings\/scheduling-options$/);

  // Navigate to Account tab via sidebar
  const accountLink = page.getByRole("link", { name: /Account/i });
  await accountLink.click();
  await expect(page).toHaveURL(/\/user-settings\/account$/);

  // Verify the submit button label and disabled state until a change is made on Account form
  const submitButton = page.getByRole("button", { name: "Update account" });
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeDisabled();

  // Make a small change to enable the button
  const nameInput = page.getByTestId("user_name");
  await nameInput.fill("Temp Name");
  await expect(submitButton).toBeEnabled();
});
