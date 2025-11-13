/**
 * User Settings Forms E2E Tests
 *
 * Tests for Scheduling Options, Spaced Repetition, and Account settings forms
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
    await expect(page.getByTestId("sched-acceptable-delinquency-input")).toBeVisible();

    // Check all fields are present
    await expect(page.getByLabel("Acceptable Delinquency Window (days)")).toBeVisible();
    await expect(page.getByLabel("Min Reviews Per Day")).toBeVisible();
    await expect(page.getByLabel("Max Reviews Per Day")).toBeVisible();
    await expect(page.getByLabel("Days per Week")).toBeVisible();
    await expect(page.getByLabel("Weekly Rules (JSON)")).toBeVisible();
    await expect(page.getByLabel("Exceptions (JSON)")).toBeVisible();
  });

  test("loads existing preferences", async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Default value should be loaded
    const acceptableDelinquency = page.getByTestId("sched-acceptable-delinquency-input");
    await expect(acceptableDelinquency).toHaveValue("21");
  });

  test("validates acceptable delinquency window range", async ({ page }) => {
    const input = page.getByTestId("sched-acceptable-delinquency-input");
    const submitButton = page.getByTestId("sched-submit-button");

    // Try invalid value
    await input.fill("-1");
    await expect(page.getByText("Must be between 0 and 365 days")).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Try valid value
    await input.fill("30");
    await expect(page.getByText("Must be between 0 and 365 days")).not.toBeVisible();
  });

  test("validates JSON format for weekly rules", async ({ page }) => {
    const input = page.getByTestId("sched-weekly-rules-input");
    const submitButton = page.getByTestId("sched-submit-button");

    // Type invalid JSON
    await input.fill("not json");
    await expect(page.getByText(/Must be valid JSON/)).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Type valid JSON object
    await input.fill('{"mon": true, "wed": true}');
    await expect(page.getByText(/Must be valid JSON/)).not.toBeVisible();
  });

  test("validates exceptions must be JSON array", async ({ page }) => {
    const input = page.getByTestId("sched-exceptions-input");
    const submitButton = page.getByTestId("sched-submit-button");

    // Type JSON object (should fail - expects array)
    await input.fill('{"date": "2025-01-01"}');
    await expect(page.getByText(/Must be a valid JSON array/)).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Type valid JSON array
    await input.fill('["2025-01-01", "2025-12-25"]');
    await expect(page.getByText(/Must be a valid JSON array/)).not.toBeVisible();
  });

  test("submit button disabled until form is dirty", async ({ page }) => {
    const submitButton = page.getByTestId("sched-submit-button");

    // Initially disabled
    await expect(submitButton).toBeDisabled();

    // Make a change
    const input = page.getByTestId("sched-acceptable-delinquency-input");
    await input.fill("30");

    // Should become enabled
    await expect(submitButton).toBeEnabled();
  });

  test("can submit valid form", async ({ page }) => {
    const input = page.getByTestId("sched-acceptable-delinquency-input");
    const submitButton = page.getByTestId("sched-submit-button");

    // Make changes
    await input.fill("30");
    await page.getByTestId("sched-min-per-day-input").fill("10");
    await page.getByTestId("sched-max-per-day-input").fill("50");

    // Submit
    await submitButton.click();

    // Check for success message
    await expect(
      page.getByText("Scheduling options updated successfully")
    ).toBeVisible();

    // Submit button should be disabled again (no longer dirty)
    await expect(submitButton).toBeDisabled();
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
    await page.waitForTimeout(500);

    // Check all fields are present
    await expect(page.getByLabel("Maximum Interval (days)")).toBeVisible();
    await expect(page.getByLabel("Algorithm Type")).toBeVisible();
  });

  test("FSRS fields shown when FSRS selected", async ({ page }) => {
    await page.waitForTimeout(500);

    const algorithmSelect = page.getByLabel("Algorithm Type");
    await algorithmSelect.selectOption("FSRS");

    // FSRS-specific fields should be visible
    await expect(page.getByLabel("FSRS Initial Weights")).toBeVisible();
    await expect(page.getByLabel("Target Retention Rate")).toBeVisible();
    await expect(page.getByTestId("optimize-params-inline-button")).toBeVisible();
    await expect(page.getByTestId("optimize-params-main-button")).toBeVisible();
  });

  test("FSRS fields hidden when SM2 selected", async ({ page }) => {
    await page.waitForTimeout(500);

    const algorithmSelect = page.getByLabel("Algorithm Type");
    
    // First ensure FSRS is selected and fields are visible
    await algorithmSelect.selectOption("FSRS");
    await expect(page.getByLabel("FSRS Initial Weights")).toBeVisible();

    // Switch to SM2
    await algorithmSelect.selectOption("SM2");

    // FSRS-specific fields should be hidden
    await expect(page.getByLabel("FSRS Initial Weights")).not.toBeVisible();
    await expect(page.getByLabel("Target Retention Rate")).not.toBeVisible();
  });

  test("validates maximum interval must be positive", async ({ page }) => {
    await page.waitForTimeout(500);

    const input = page.getByLabel("Maximum Interval (days)");
    const submitButton = page.getByTestId("spaced-rep-update-button");

    // Try zero
    await input.fill("0");
    await expect(page.getByText("Must be a positive number")).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Try valid value
    await input.fill("365");
    await expect(page.getByText("Must be a positive number")).not.toBeVisible();
  });

  test("validates retention rate range 0-1", async ({ page }) => {
    await page.waitForTimeout(500);

    const algorithmSelect = page.getByLabel("Algorithm Type");
    await algorithmSelect.selectOption("FSRS");

    const input = page.getByLabel("Target Retention Rate");
    const submitButton = page.getByTestId("spaced-rep-update-button");

    // Try value > 1
    await input.fill("1.5");
    await expect(page.getByText("Must be between 0 and 1")).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Try valid value
    await input.fill("0.9");
    await expect(page.getByText("Must be between 0 and 1")).not.toBeVisible();
  });

  test("validates FSRS weights format", async ({ page }) => {
    await page.waitForTimeout(500);

    const algorithmSelect = page.getByLabel("Algorithm Type");
    await algorithmSelect.selectOption("FSRS");

    const input = page.getByLabel("FSRS Initial Weights");
    const submitButton = page.getByTestId("spaced-rep-update-button");

    // Clear and type invalid format
    await input.clear();
    await input.fill("not, numbers, here");
    await expect(page.getByText(/Must be comma-separated numbers/)).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Type valid format
    await input.clear();
    await input.fill("0.4, 1.2, 3.1");
    await expect(page.getByText(/Must be comma-separated numbers/)).not.toBeVisible();
  });

  test("can submit valid form with FSRS", async ({ page }) => {
    await page.waitForTimeout(500);

    const algorithmSelect = page.getByLabel("Algorithm Type");
    const submitButton = page.getByTestId("spaced-rep-update-button");

    // Select FSRS
    await algorithmSelect.selectOption("FSRS");

    // Make changes
    const maxInterval = page.getByLabel("Maximum Interval (days)");
    await maxInterval.fill("180");

    // Submit
    await submitButton.click();

    // Check for success message
    await expect(
      page.getByText("Spaced repetition preferences updated successfully")
    ).toBeVisible();
  });

  test("optimize buttons show not implemented message", async ({ page }) => {
    await page.waitForTimeout(500);

    const algorithmSelect = page.getByLabel("Algorithm Type");
    await algorithmSelect.selectOption("FSRS");

    // Click optimize button
    const optimizeButton = page.getByTestId("optimize-params-inline-button");
    await optimizeButton.click();

    // Should show not implemented message
    await expect(
      page.getByText(/FSRS optimization API not yet implemented/)
    ).toBeVisible();
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
      page.getByText("Update your account settings and avatar")
    ).toBeVisible();
  });

  test("displays all form fields", async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(500);

    // Check fields are present
    await expect(page.getByTestId("user_name")).toBeVisible();
    await expect(page.getByTestId("user_email")).toBeVisible();
    await expect(page.getByTestId("user_phone")).toBeVisible();
  });

  test("email field is read-only", async ({ page }) => {
    await page.waitForTimeout(500);

    const emailInput = page.getByTestId("user_email");
    await expect(emailInput).toBeDisabled();
  });

  test("validates name is required", async ({ page }) => {
    await page.waitForTimeout(500);

    const nameInput = page.getByTestId("user_name");
    const submitButton = page.getByRole("button", { name: "Update account" });

    // Clear name
    await nameInput.clear();
    await expect(page.getByText("Name is required")).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Fill name
    await nameInput.fill("Test User");
    await expect(page.getByText("Name is required")).not.toBeVisible();
  });

  test("validates phone format", async ({ page }) => {
    await page.waitForTimeout(500);

    const phoneInput = page.getByTestId("user_phone");
    const submitButton = page.getByRole("button", { name: "Update account" });

    // Type invalid phone
    await phoneInput.fill("abc");
    await expect(page.getByText("Invalid phone format")).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Type valid phone
    await phoneInput.fill("+1234567890");
    await expect(page.getByText("Invalid phone format")).not.toBeVisible();
  });

  test("displays avatar with link to avatar page", async ({ page }) => {
    await page.waitForTimeout(500);

    // Check for avatar section
    await expect(page.getByText("Avatar")).toBeVisible();

    // Check for link to avatar page
    const avatarLink = page.getByRole("link", { name: "Change Avatar" });
    await expect(avatarLink).toBeVisible();
    await expect(avatarLink).toHaveAttribute("href", "/user-settings/avatar");
  });

  test("can navigate to avatar page", async ({ page }) => {
    await page.waitForTimeout(500);

    // Click avatar link
    await page.getByRole("link", { name: "Change Avatar" }).click();

    // Should navigate to avatar page
    await expect(page).toHaveURL("/user-settings/avatar");
    await expect(page.getByRole("heading", { name: "Profile Avatar" })).toBeVisible();
  });

  test("password reset button sends email", async ({ page }) => {
    await page.waitForTimeout(500);

    // Click password reset button
    const resetButton = page.getByRole("button", {
      name: "Send Password Reset Email",
    });
    await resetButton.click();

    // Check for success message
    await expect(
      page.getByText("Password reset email sent. Check your inbox.")
    ).toBeVisible();
  });

  test("submit button disabled until form is dirty", async ({ page }) => {
    await page.waitForTimeout(500);

    const submitButton = page.getByRole("button", { name: "Update account" });

    // Initially disabled
    await expect(submitButton).toBeDisabled();

    // Make a change
    const nameInput = page.getByTestId("user_name");
    await nameInput.fill("Updated Name");

    // Should become enabled
    await expect(submitButton).toBeEnabled();
  });

  test("can submit valid form", async ({ page }) => {
    await page.waitForTimeout(500);

    const nameInput = page.getByTestId("user_name");
    const submitButton = page.getByRole("button", { name: "Update account" });

    // Make changes
    await nameInput.fill("Updated Test User");

    // Submit
    await submitButton.click();

    // Check for success message
    await expect(
      page.getByText("Account settings updated successfully")
    ).toBeVisible();

    // Submit button should be disabled again (no longer dirty)
    await expect(submitButton).toBeDisabled();
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
    await expect(page.getByRole("link", { name: "Avatar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Scheduling Options" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Spaced Repetition" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Account" })).toBeVisible();
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

  test("close button works", async ({ page }) => {
    // Click close button
    await page.getByTestId("settings-close-button").click();

    // Should redirect to home
    await expect(page).toHaveURL("/");
  });

  test("backdrop click closes modal", async ({ page }) => {
    // Click backdrop
    await page.getByTestId("settings-modal-backdrop").click();

    // Should redirect to home
    await expect(page).toHaveURL("/");
  });

  test("Escape key closes modal", async ({ page }) => {
    // Press Escape
    await page.keyboard.press("Escape");

    // Should redirect to home
    await expect(page).toHaveURL("/");
  });
});
