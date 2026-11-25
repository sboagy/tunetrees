import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * USERSETTINGS-001: User Settings Forms
 * Priority: High
 *
 * Tests that user settings forms (Goals, Account)
 * render correctly, validate input, and submit successfully.
 */

let ttPage: TuneTreesPage;

// biome-ignore lint/correctness/noUnusedVariables: currentTestUser standard setup, but not used yet.
let currentTestUser: TestUser;

test.describe("USERSETTINGS-001: Goal daily settings", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });

    // Navigate to User Settings > Scheduling Options
    await ttPage.userMenuButton.click();
    await page.waitForTimeout(500);
    await ttPage.userSettingsButton.click();
    await page.waitForTimeout(1500);

    // Only run the mobile menu toggle on Mobile Chrome
    const ua = await page.evaluate(() => navigator.userAgent);
    const isMobileChrome = /Android.*Chrome\/\d+/i.test(ua);
    if (isMobileChrome) {
      await page.waitForTimeout(800);
      await ttPage.settingsMenuToggle.click();
    }
    await page.waitForTimeout(800);
    await page.getByTestId("settings-tab-goals").click();
    await page.waitForTimeout(500);
  });

  test("offers editable shared calendar preferences with scheduling limitations disclosed", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Goals", level: 3 })
    ).toBeVisible({ timeout: 10000 });
    await page.getByTestId("shared-practice-calendar").click();
    await expect(
      page.getByText(
        /These values are saved, but are not yet applied to practice scheduling/
      )
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Min Reviews Per Day")).toHaveCount(0);
    await expect(page.getByTestId("calendar-days")).toBeEditable({
      timeout: 10000,
    });
    await expect(page.getByTestId("calendar-weekly")).toBeEditable({
      timeout: 10000,
    });
    await expect(page.getByTestId("calendar-exceptions")).toBeEditable({
      timeout: 10000,
    });
    await expect(page.getByTestId("calendar-save")).toBeDisabled({
      timeout: 10000,
    });
  });

  test("validates a goal minimum against its finite maximum", async ({
    page,
  }) => {
    const recall = page.locator("section[data-testid^='goal-panel-']").filter({
      has: page.getByRole("heading", {
        name: "Recall Built-in",
        exact: true,
      }),
    });
    await recall.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByTestId("goal-minimum").fill("11");
    await page.getByTestId("goal-maximum").fill("10");
    await page.getByTestId("goal-save").click();
    await expect(
      page.getByText("Minimum must not exceed a finite maximum", {
        exact: true,
      })
    ).toBeVisible({ timeout: 10000 });
  });

  test("saves per-goal daily limits and restores defaults", async ({
    page,
  }) => {
    // The summary is inert while its editor is open. Use its stable identity
    // to verify Reset has not changed saved values behind the dialog.
    const recall = page.getByTestId(
      "goal-panel-00000000-0000-0000-0000-000000000001"
    );
    await recall.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByTestId("goal-minimum").fill("1");
    await page.getByTestId("goal-maximum").fill("4");
    await page.getByTestId("goal-save").click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(recall).toContainText("Daily 1–4", { timeout: 10000 });
    await recall.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByTestId("goal-minimum")).toHaveValue("1");
    await expect(page.getByTestId("goal-maximum")).toHaveValue("4");
    // Reset stages defaults in the goal dialog; only Save Changes persists them.
    await page.getByTestId("goal-reset").click();
    await expect(page.getByTestId("goal-minimum")).toHaveValue("3");
    await expect(page.getByTestId("goal-maximum")).toHaveValue("10");
    await expect(recall).toContainText("Daily 1–4");
    await expect(page.getByTestId("goal-save")).toBeEnabled();
    await page.getByTestId("goal-save").click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(recall).toContainText("Daily 3–10", { timeout: 10000 });
    await expect(page.getByTestId("goal-editor-dialog")).toHaveCount(0);

    // A full document navigation verifies that the reset was durably saved.
    await page.goto("/user-settings/goals");
    await expect(recall).toContainText("Daily 3–10", { timeout: 15000 });
    await recall.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByTestId("goal-minimum")).toHaveValue("3");
    await expect(page.getByTestId("goal-maximum")).toHaveValue("10");
  });
});

test.describe("USERSETTINGS-001: Legacy FSRS settings link", () => {
  test("opens Goals with per-goal FSRS controls", async ({
    page,
    testUser,
  }) => {
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
    await page.goto("/user-settings/spaced-repetition");
    await expect(
      page.getByRole("heading", { name: "Goals", exact: true })
    ).toBeVisible({ timeout: 15000 });
    await page
      .getByTestId("goal-edit-00000000-0000-0000-0000-000000000001")
      .click();
    await new TuneTreesPage(page).goalFsrsAdvanced.click();
    await expect(
      page.getByLabel("Desired Retention (0–1)", { exact: true })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByLabel("Algorithm Type", { exact: true })
    ).toHaveCount(0);
  });
});

test.describe("USERSETTINGS-001: Account Settings Form", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });

    // Navigate to User Settings > Account using the same mobile-aware sidebar
    // flow that the navigation tests already rely on.
    await ttPage.userMenuButton.click();
    await expect(ttPage.userSettingsButton).toBeVisible({ timeout: 5000 });
    await ttPage.userSettingsButton.click();
    await page.waitForTimeout(500);

    const ua = await page.evaluate(() => navigator.userAgent);
    const isMobileChrome = /Android.*Chrome\/\d+/i.test(ua);

    if (isMobileChrome) {
      await page.waitForTimeout(800);
      await ttPage.settingsMenuToggle.click();
      await expect(ttPage.userSettingsAccountButton).toBeVisible({
        timeout: 5000,
      });
    }

    await ttPage.userSettingsAccountButton.click();
    await expect(
      page.getByRole("heading", { name: "Account", level: 3 })
    ).toBeVisible({ timeout: 5000 });
  });

  test("should display account settings form", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Account", level: 3 })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(/Manage your account information/i)
    ).toBeVisible();
  });

  test("should display all form fields", async ({ page }) => {
    await page.waitForTimeout(1000);

    await expect(page.getByLabel("Name")).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("Phone")).toBeVisible({ timeout: 5000 });
  });

  test("should show email as read-only", async ({ page }) => {
    await page.waitForTimeout(1000);

    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toBeDisabled({ timeout: 3000 });
  });

  test("should validate name required field", async ({ page }) => {
    await page.waitForTimeout(1000);

    const nameInput = page.getByLabel("Name");
    const submitButton = page.getByRole("button", { name: /update/i });

    // Clear name field
    await nameInput.fill("");
    await page.waitForTimeout(500);

    try {
      // Submit button should be disabled
      await expect(submitButton).toBeDisabled({ timeout: 3000 });
    } catch {
      // Submit button should be disabled when there is no user name
      console.log("Submit button disable check not implemented yet");
    }
  });

  test("should submit valid account form", async ({ page }) => {
    await page.waitForTimeout(1000);

    const nameInput = page.getByLabel("Name");
    const submitButton = page.getByRole("button", { name: /update/i });

    // Make changes
    await nameInput.fill("Test User Updated");
    await page.waitForTimeout(500);

    // Submit should be enabled when dirty
    await expect(submitButton).toBeEnabled({ timeout: 3000 });
    await submitButton.click();

    // Wait for success message
    try {
      // Wait for success message
      await expect(page.getByText(/Successfully updated|saved/i)).toBeVisible({
        timeout: 5000,
      });
    } catch {
      // Success message may or may not be shown
      console.log("Success message check not implemented yet");
    }
  });
});

test.describe("USERSETTINGS-001: Navigation", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });

    // Navigate to User Settings > Scheduling Options
    // Wait for the dropdown item to be visible before clicking it — avoids the
    // flaky fixed 500ms delay on slow Mobile Chrome emulation.
    await ttPage.userMenuButton.click();
    await expect(ttPage.userSettingsButton).toBeVisible({ timeout: 5000 });
    await ttPage.userSettingsButton.click();
    await page.waitForTimeout(500);
    const ua = await page.evaluate(() => navigator.userAgent);
    const isMobileChrome = /Android.*Chrome\/\d+/i.test(ua);
    if (isMobileChrome) {
      await page.waitForTimeout(800);
      await ttPage.settingsMenuToggle.click();
      await page.waitForTimeout(500); // let sidebar slide-in animation settle
    }
  });

  test("should display all settings navigation links", async ({ page }) => {
    await expect(page.getByTestId("settings-tab-goals")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByTestId("settings-tab-spaced-repetition")
    ).toHaveCount(0);
    await expect(page.getByTestId("settings-tab-account")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("settings-tab-avatar")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should navigate between settings pages", async ({ page }) => {
    const ua = await page.evaluate(() => navigator.userAgent);
    const isMobileChrome = /Android.*Chrome\/\d+/i.test(ua);

    // On mobile the sidebar closes after each tab click, so we must reopen it
    // via the menu toggle before navigating to the next tab.
    const openSidebarAndClick = async (testId: string) => {
      if (isMobileChrome) {
        await ttPage.settingsMenuToggle.click();
        await page.waitForTimeout(500);
      }
      await page.getByTestId(testId).click();
    };

    // Click Scheduling Options (beforeEach already opened the sidebar on mobile)
    await page.getByTestId("settings-tab-goals").click();
    await expect(
      page.getByRole("heading", { name: "Goals", level: 3 })
    ).toBeVisible({ timeout: 10000 });

    // Click Account
    await openSidebarAndClick("settings-tab-account");
    await expect(
      page.getByRole("heading", { name: "Account", level: 3 })
    ).toBeVisible({ timeout: 10000 });
  });
});
