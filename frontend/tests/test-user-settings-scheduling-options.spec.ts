import { test, expect } from "@playwright/test";

import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { applyNetworkThrottle } from "../test-scripts/network-utils";
import { checkHealth } from "../test-scripts/check-servers";
import { navigateToPageWithRetry } from "../test-scripts/navigation-utils";
import { runLoginWithCookieSave } from "@/test-scripts/run-login2";
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
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await page.waitForTimeout(10);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test("scheduling options validates JSON and disables submit until valid/dirty", async ({
  page,
}) => {
  await checkHealth();

  // Login first
  await navigateToPageWithRetry(page, "https://localhost:3000");
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

  // Navigate directly to scheduling options
  await page.goto("https://localhost:3000/user-settings/scheduling-options", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("domcontentloaded");

  const submitButton = page.getByTestId("sched-submit-button");
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeDisabled();

  // Enter invalid JSON to trigger validation error
  const weeklyRules = page.getByTestId("sched-weekly-rules-input");
  await weeklyRules.fill("{ invalid json");
  await expect(submitButton).toBeDisabled();

  // Fix to valid JSON object and ensure button can enable when dirty
  await weeklyRules.fill('{"mon": true, "wed": true}');

  // Touch another field to ensure dirty state
  const minPerDay = page.getByTestId("sched-min-per-day-input");
  await minPerDay.fill("10");

  await expect(submitButton).toBeEnabled();
});
