import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TOPNAV-004: Repertoire Manager Modal Dialog
 * Priority: High
 *
 * Tests that the "Manage Repertoires..." button opens a modal dialog
 * instead of navigating to a separate page, matching the legacy app behavior.
 */

let ttPage: TuneTreesPage;
let currentTestUser: TestUser;

test.describe("TOPNAV-004: Repertoire Manager Modal", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
  });

  // Helper: open TopNav repertoire dropdown and then open the manager modal
  async function openRepertoireManagerModal() {
    const { page } = ttPage;
    const repertoireButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(`Irish Flute|${currentTestUser.repertoireId}`, "i"),
      })
      .first();

    await expect(repertoireButton).toBeVisible({ timeout: 10000 });
    await repertoireButton.click();

    // Dropdown panel visible
    await expect(ttPage.topNavManageRepertoiresPanel).toBeVisible({
      timeout: 5000,
    });

    // Click "Manage Repertoires..."
    await page.getByTestId("manage-repertoires-button").click();

    // Wait for modal
    const modal = page.getByTestId("repertoire-manager-dialog");
    await expect(modal).toBeVisible({ timeout: 10000 });
    return { modal };
  }

  test("should open repertoire manager modal when clicking 'Manage Repertoires' button", async () => {
    const { modal } = await openRepertoireManagerModal();
    await expect(
      ttPage.page.getByRole("heading", { name: "Repertoires" })
    ).toBeVisible({
      timeout: 5000,
    });
    await expect(modal).toBeVisible();
  });

  test("should display repertoire list in modal", async () => {
    const { modal } = await openRepertoireManagerModal();
    await expect(modal.getByText(/Showing.*repertoires/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("should close modal when clicking X button", async () => {
    const { modal } = await openRepertoireManagerModal();
    await ttPage.page.getByTestId("close-repertoire-manager").click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test("should close modal when clicking backdrop", async () => {
    const { modal } = await openRepertoireManagerModal();
    await ttPage.page
      .getByTestId("repertoire-manager-backdrop")
      .click({ position: { x: 10, y: 10 } });
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test("should close modal when pressing Escape key", async () => {
    const { modal } = await openRepertoireManagerModal();
    await ttPage.page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test("should have Create New Repertoire button in modal", async () => {
    await openRepertoireManagerModal();
    const createButton = ttPage.page.getByTestId("create-repertoire-button");
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await expect(createButton).toContainText(/New Repertoire/i);
  });

  test("should not navigate to /repertoires route when opening modal", async () => {
    const initialUrl = ttPage.page.url();
    await openRepertoireManagerModal();
    expect(ttPage.page.url()).toBe(initialUrl);
  });
});
