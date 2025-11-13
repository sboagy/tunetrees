/**
 * User Settings Forms E2E Tests
 *
 * Tests for Scheduling Options, Spaced Repetition, and Account settings forms
 *
 * NOTE: This test file follows the current repo pattern (similar to avatar-picker.spec.ts).
 * The testing.instructions.md references test helpers (getStorageState, logTestStart, etc.)
 * that don't exist yet in the codebase. Once those helpers are implemented, this file
 * should be updated to use them.
 */

import { expect, test } from "@playwright/test";

test.describe("User Settings - Scheduling Options", () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for redirect to home
    await expect(page).toHaveURL("/");

    // Navigate to scheduling options
    await page.getByTestId("user-menu-button").click();
    await page.getByRole("menuitem", { name: "User Settings" }).click();
    await page.getByRole("link", { name: "Scheduling Options" }).click();
  });

  test("displays scheduling options page", async ({ page }) => {
    // Check page title
    await expect(
      page.getByRole("heading", { name: "Scheduling Options", level: 3 })
    ).toBeVisible();

    // Check description
    await expect(
      page.getByText("Configure scheduling constraints and your practice calendar")
    ).toBeVisible();
  });

  test("displays all form fields", async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Check all fields are present
    await expect(page.getByLabel("Acceptable Delinquency Window (days)")).toBeVisible();
    await expect(page.getByLabel("Min Reviews Per Day")).toBeVisible();
    await expect(page.getByLabel("Max Reviews Per Day")).toBeVisible();
    await expect(page.getByLabel("Days per Week")).toBeVisible();
    await expect(page.getByLabel("Weekly Rules (JSON)")).toBeVisible();
    await expect(page.getByLabel("Exceptions (JSON)")).toBeVisible();
  });

  test("validates acceptable delinquency window range", async ({ page }) => {
    await page.waitForTimeout(1000);

    const input = page.getByLabel("Acceptable Delinquency Window (days)");
    
    // Try invalid value
    await input.fill("-1");
    await page.waitForTimeout(300);
    await expect(page.getByText("Must be between 0 and 365 days")).toBeVisible();

    // Try valid value
    await input.fill("30");
    await page.waitForTimeout(300);
    await expect(page.getByText("Must be between 0 and 365 days")).not.toBeVisible();
  });

  test("validates JSON format for weekly rules", async ({ page }) => {
    await page.waitForTimeout(1000);

    const input = page.getByLabel("Weekly Rules (JSON)");
    
    // Type invalid JSON
    await input.fill("not json");
    await page.waitForTimeout(300);
    await expect(page.getByText(/Must be valid JSON/)).toBeVisible();

    // Type valid JSON object
    await input.fill('{"mon": true, "wed": true}');
    await page.waitForTimeout(300);
    await expect(page.getByText(/Must be valid JSON/)).not.toBeVisible();
  });

  test("can submit valid form", async ({ page }) => {
    await page.waitForTimeout(1000);

    const input = page.getByLabel("Acceptable Delinquency Window (days)");
    const submitButton = page.getByRole("button", { name: /update/i });

    // Make changes
    await input.fill("30");
    await page.waitForTimeout(300);

    // Submit
    await submitButton.click();

    // Check for success message
    await expect(
      page.getByText("Scheduling options updated successfully")
    ).toBeVisible({timeout: 5000});
  });
});

test.describe("User Settings - Spaced Repetition", () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for redirect to home
    await expect(page).toHaveURL("/");

    // Navigate to spaced repetition
    await page.getByTestId("user-menu-button").click();
    await page.getByRole("menuitem", { name: "User Settings" }).click();
    await page.getByRole("link", { name: "Spaced Repetition" }).click();
  });

  test("displays spaced repetition page", async ({ page }) => {
    // Check page title
    await expect(
      page.getByRole("heading", { name: "Spaced Repetition", level: 3 })
    ).toBeVisible();

    // Check description
    await expect(
      page.getByText("Configure your spaced repetition algorithm preferences")
    ).toBeVisible();
  });

  test("displays all form fields", async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Check all fields are present
    await expect(page.getByLabel("Maximum Interval (days)")).toBeVisible();
    await expect(page.getByLabel("Algorithm Type")).toBeVisible();
  });

  test("FSRS fields shown when FSRS selected", async ({ page }) => {
    await page.waitForTimeout(1000);

    const algorithmSelect = page.getByLabel("Algorithm Type");
    await algorithmSelect.selectOption("FSRS");
    await page.waitForTimeout(500);

    // FSRS-specific fields should be visible
    await expect(page.getByLabel("FSRS Initial Weights")).toBeVisible();
    await expect(page.getByLabel("Target Retention Rate")).toBeVisible();
  });

  test("FSRS fields hidden when SM2 selected", async ({ page }) => {
    await page.waitForTimeout(1000);

    const algorithmSelect = page.getByLabel("Algorithm Type");
    
    // First ensure FSRS is selected and fields are visible
    await algorithmSelect.selectOption("FSRS");
    await page.waitForTimeout(300);
    await expect(page.getByLabel("FSRS Initial Weights")).toBeVisible();

    // Switch to SM2
    await algorithmSelect.selectOption("SM2");
    await page.waitForTimeout(300);

    // FSRS-specific fields should be hidden
    await expect(page.getByLabel("FSRS Initial Weights")).not.toBeVisible();
    await expect(page.getByLabel("Target Retention Rate")).not.toBeVisible();
  });

  test("validates maximum interval must be positive", async ({ page }) => {
    await page.waitForTimeout(1000);

    const input = page.getByLabel("Maximum Interval (days)");

    // Try zero
    await input.fill("0");
    await page.waitForTimeout(300);
    await expect(page.getByText("Must be a positive number")).toBeVisible();

    // Try valid value
    await input.fill("365");
    await page.waitForTimeout(300);
    await expect(page.getByText("Must be a positive number")).not.toBeVisible();
  });

  test("can submit valid form with FSRS", async ({ page }) => {
    await page.waitForTimeout(1000);

    const algorithmSelect = page.getByLabel("Algorithm Type");
    const submitButton = page.getByRole("button", { name: /update/i });

    // Select FSRS
    await algorithmSelect.selectOption("FSRS");
    await page.waitForTimeout(300);

    // Make changes
    const maxInterval = page.getByLabel("Maximum Interval (days)");
    await maxInterval.fill("180");
    await page.waitForTimeout(300);

    // Submit
    await submitButton.click();

    // Check for success message
    await expect(
      page.getByText("Spaced repetition preferences updated successfully")
    ).toBeVisible({timeout: 5000});
  });
});

test.describe("User Settings - Account", () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for redirect to home
    await expect(page).toHaveURL("/");

    // Navigate to account settings
    await page.getByTestId("user-menu-button").click();
    await page.getByRole("menuitem", { name: "User Settings" }).click();
    await page.getByRole("link", { name: "Account" }).click();
  });

  test("displays account page", async ({ page }) => {
    // Check page title
    await expect(
      page.getByRole("heading", { name: "Account", level: 3 })
    ).toBeVisible();

    // Check description
    await expect(
      page.getByText(/Update your account settings/)
    ).toBeVisible();
  });

  test("displays all form fields", async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Check fields are present using labels
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Phone")).toBeVisible();
  });

  test("email field is read-only", async ({ page }) => {
    await page.waitForTimeout(1000);

    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toBeDisabled();
  });

  test("validates name is required", async ({ page }) => {
    await page.waitForTimeout(1000);

    const nameInput = page.getByLabel("Name");

    // Clear name
    await nameInput.clear();
    await page.waitForTimeout(300);
    await expect(page.getByText("Name is required")).toBeVisible();

    // Fill name
    await nameInput.fill("Test User");
    await page.waitForTimeout(300);
    await expect(page.getByText("Name is required")).not.toBeVisible();
  });

  test("can submit valid form", async ({ page }) => {
    await page.waitForTimeout(1000);

    const nameInput = page.getByLabel("Name");
    const submitButton = page.getByRole("button", { name: /update/i });

    // Make changes
    await nameInput.fill("Updated Test User");
    await page.waitForTimeout(300);

    // Submit
    await submitButton.click();

    // Check for success message
    await expect(
      page.getByText("Account settings updated successfully")
    ).toBeVisible({timeout: 5000});
  });
});

test.describe("User Settings - Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for redirect to home
    await expect(page).toHaveURL("/");

    // Open settings
    await page.getByTestId("user-menu-button").click();
    await page.getByRole("menuitem", { name: "User Settings" }).click();
  });

  test("all navigation links are present", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Scheduling Options" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Spaced Repetition" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Avatar" })).toBeVisible();
  });

  test("can navigate between settings pages", async ({ page }) => {
    // Navigate to scheduling options
    await page.getByRole("link", { name: "Scheduling Options" }).click();
    await expect(page.getByRole("heading", { name: "Scheduling Options", level: 3 })).toBeVisible();

    // Navigate to spaced repetition
    await page.getByRole("link", { name: "Spaced Repetition" }).click();
    await expect(page.getByRole("heading", { name: "Spaced Repetition", level: 3 })).toBeVisible();

    // Navigate to account
    await page.getByRole("link", { name: "Account" }).click();
    await expect(page.getByRole("heading", { name: "Account", level: 3 })).toBeVisible();

    // Navigate to avatar
    await page.getByRole("link", { name: "Avatar" }).click();
    await expect(page.getByRole("heading", { name: "Profile Avatar" })).toBeVisible();
  });
});
