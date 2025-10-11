import { expect, test } from "@playwright/test";
import { TuneTreesPage } from "../helpers/page-objects";

test.describe("Authentication", () => {
  let tuneTreesPage: TuneTreesPage;

  test.beforeEach(async ({ page }) => {
    tuneTreesPage = new TuneTreesPage(page);
  });

  test.skip("should redirect to login when not authenticated", async () => {
    // This test is skipped until we implement Supabase auth
    await tuneTreesPage.gotoPractice();
    await expect(tuneTreesPage.page).toHaveURL(/login/);
  });

  test.skip("should login with valid credentials", async () => {
    // This test is skipped until we implement Supabase auth
    await tuneTreesPage.gotoLogin();

    await tuneTreesPage.page
      .locator('[data-testid="email-input"]')
      .fill("test@example.com");
    await tuneTreesPage.page
      .locator('[data-testid="password-input"]')
      .fill("testpassword123");
    await tuneTreesPage.page.locator('[data-testid="login-button"]').click();

    // Should redirect to dashboard or catalog after login
    await expect(tuneTreesPage.page).toHaveURL(
      /\/(catalog|practice|dashboard)/
    );
  });

  test.skip("should show error with invalid credentials", async () => {
    // This test is skipped until we implement Supabase auth
    await tuneTreesPage.gotoLogin();

    await tuneTreesPage.page
      .locator('[data-testid="email-input"]')
      .fill("invalid@example.com");
    await tuneTreesPage.page
      .locator('[data-testid="password-input"]')
      .fill("wrongpassword");
    await tuneTreesPage.page.locator('[data-testid="login-button"]').click();

    // Should show error message
    await expect(
      tuneTreesPage.page.locator('[data-testid="error-message"]')
    ).toBeVisible();
  });
});
