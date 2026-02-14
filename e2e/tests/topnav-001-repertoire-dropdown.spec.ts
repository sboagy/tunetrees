import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TOPNAV-001: Repertoire dropdown shows user's repertoires
 * Priority: Critical
 *
 * Tests that the repertoire dropdown in TopNav correctly displays
 * user's repertoire with proper details after login.
 */

let ttPage: TuneTreesPage;
let currentTestUser: TestUser;

test.describe("TOPNAV-001: Repertoire Dropdown Population", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
  });

  test("should display default selected repertoire in TopNav", async ({
    page,
  }) => {
    // Look for repertoire button/dropdown in TopNav
    // Adjust selector based on your actual implementation
    const repertoireButton = page.locator("button").filter({
      hasText: new RegExp(`Irish Flute|${currentTestUser.repertoireId}`, "i"),
    });

    await expect(repertoireButton).toBeVisible({ timeout: 10000 });

    // Should show repertoire name or instrument name
    await expect(repertoireButton).toContainText(
      new RegExp(`Irish Flute|${currentTestUser.repertoireId}`, "i")
    );
  });

  test("should open dropdown menu when clicked", async ({ page }) => {
    // Click the repertoire dropdown button
    const repertoireButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.repertoireId}`, "i"),
      })
      .first();
    await repertoireButton.click();

    // Dropdown menu should be visible
    // This might be a role="menu" or specific class
    await expect(ttPage.topNavManageRepertoiresPanel).toBeVisible({
      timeout: 2000,
    });
  });

  test("should show repertoire details in dropdown", async ({ page }) => {
    const repertoireButton = page
      .locator("button")
      .filter({
        hasText: "Irish Flute",
      })
      .first();
    await repertoireButton.click();

    // Should show the repertoire item with subtitle
    // Show a tunes count; value may vary depending on previous tests adding tunes
    await expect(
      ttPage.topNavManageRepertoiresPanel.getByText(/tunes/i, {
        exact: false,
      })
    ).toBeVisible({
      timeout: 2000,
    });
    await expect(
      ttPage.topNavManageRepertoiresPanel.getByText(/ITRAD/i, {
        exact: false,
      })
    ).toBeVisible({
      timeout: 2000,
    });
  });

  test("should show 'Manage Repertoires' button in dropdown", async ({
    page,
  }) => {
    const repertoireButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.repertoireId}`, "i"),
      })
      .first();
    await repertoireButton.click();

    // Look for "Manage Repertoires" button
    await expect(page.getByTestId("manage-repertoires-button")).toBeVisible({
      timeout: 2000,
    });
  });

  test("should close dropdown when clicking outside", async ({ page }) => {
    const repertoireButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.repertoireId}`, "i"),
      })
      .first();
    await repertoireButton.click();

    // Dropdown should be visible
    const dropdown = ttPage.topNavManageRepertoiresPanel;
    await expect(dropdown).toBeVisible();

    // Click outside the dropdown
    await page.locator("body").click({ position: { x: 0, y: 0 } });

    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 2000 });
  });

  test("should not show loading state after sync completes", async ({
    page,
  }) => {
    await page.waitForTimeout(3000); // Give sync time to complete

    // Should not show loading text for repertoire dropdown
    await expect(
      page.getByText(/Loading (repertoires|repertoires)/i)
    ).not.toBeVisible();

    // Repertoire button should be enabled and show content
    const repertoireButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.repertoireId}`, "i"),
      })
      .first();
    await expect(repertoireButton).toBeEnabled();
  });
});
