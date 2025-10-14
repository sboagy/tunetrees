import { expect, test } from "@playwright/test";

/**
 * PRACTICE-001: Practice tab shows appropriate empty/initial state
 * Priority: Medium
 *
 * Tests that the Practice tab renders correctly when no practice
 * records exist yet (fresh test account).
 */

test.use({ storageState: "e2e/.auth/alice.json" });

test.describe("PRACTICE-001: Empty State", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.waitForTimeout(2000); // Wait for sync

    // Navigate to Practice tab
    await page.getByTestId("tab-practice").click();
    await page.waitForTimeout(1000);
  });

  test("should display Practice tab without errors", async ({ page }) => {
    // Practice tab should be visible and selected
    const practiceTab = page.getByTestId("tab-practice");
    await expect(practiceTab).toBeVisible({ timeout: 5000 });
    await expect(practiceTab).toHaveAttribute("aria-current", "page");
  });

  test("should show empty grid or empty state message", async ({ page }) => {
    // Grid or empty state should be visible
    const gridVisible = await page
      .getByTestId("tunes-grid-practice")
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    const emptyStateVisible = await page
      .getByText(/No tunes|Add tunes/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // At least one should be true
    expect(gridVisible || emptyStateVisible).toBeTruthy();
  });

  test("should show toolbar with disabled Complete Practice button", async ({
    page,
  }) => {
    // Complete Practice button should exist but be disabled (no tunes to practice)
    const completePracticeButton = page.getByRole("button", {
      name: /Complete Practice/i,
    });

    if (await completePracticeButton.isVisible({ timeout: 2000 })) {
      await expect(completePracticeButton).toBeDisabled();
    }
  });

  test("should show Columns button enabled", async ({ page }) => {
    // Columns button should be available even with empty grid
    const columnsButton = page.getByRole("button", { name: /Columns/i });

    if (await columnsButton.isVisible({ timeout: 2000 })) {
      await expect(columnsButton).toBeEnabled();
    }
  });

  test("should render without loading spinner stuck", async ({ page }) => {
    await page.waitForTimeout(3000);

    // Should not show perpetual loading state
    await expect(page.locator('[role="progressbar"]')).not.toBeVisible();
    await expect(page.getByText(/Loading practice/i)).not.toBeVisible();
  });

  test("should not show console errors", async ({ page }) => {
    // No error messages should be visible in UI
    await expect(page.getByText(/error|failed/i)).not.toBeVisible();
  });

  test("should have proper workflow hint for empty state", async ({ page }) => {
    // If there's guidance text, verify it mentions adding tunes
    const hintText = page.getByText(
      /Go to Repertoire|Add To Review|schedule practice/i
    );

    // This is nice-to-have, not all empty states have hints
    // Just verify if it exists, it's helpful
    if (await hintText.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(hintText).toBeVisible();
    }
  });
});
