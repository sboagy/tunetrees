import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * ABOUT-001: About TuneTrees Dialog
 * Priority: Medium
 *
 * Tests that the About TuneTrees dialog:
 * - Opens from logo dropdown
 * - Displays version information correctly
 * - Contains working links
 * - Is keyboard accessible
 * - Works on mobile viewports
 */

let ttPage: TuneTreesPage;
let currentTestUser: TestUser;

test.describe("ABOUT-001: About TuneTrees Dialog", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentTestUser = testUser;

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });

    // Navigate to home page (Practice tab)
    await page.goto("/");
    await page.waitForTimeout(1000);
  });

  test("should open logo dropdown and display menu items", async ({ page }) => {
    // Click logo dropdown button
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);

    // Verify dropdown panel is visible
    await expect(ttPage.logoDropdownPanel).toBeVisible();

    // Verify menu items exist
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(ttPage.logoDropdownAboutButton).toBeVisible();
    await expect(ttPage.logoDropdownWhatsNewLink).toBeVisible();
  });

  test("should open About dialog from logo dropdown", async ({ page }) => {
    // Open logo dropdown
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);

    // Click "About TuneTrees..." button
    await ttPage.logoDropdownAboutButton.click();
    await page.waitForTimeout(500);

    // Verify About dialog is visible
    await expect(ttPage.aboutDialog).toBeVisible();

    // Verify dialog contains the logo
    const logo = ttPage.aboutDialog.locator('img[alt="TuneTrees Logo"]');
    await expect(logo).toBeVisible();

    // Verify dialog title
    await expect(ttPage.aboutDialog.locator("h2")).toContainText("TuneTrees");

    // Verify subtitle/description
    await expect(ttPage.aboutDialog).toContainText(
      "Practice Manager for Tunes"
    );
  });

  test("should display version information in About dialog", async ({
    page,
  }) => {
    // Open About dialog
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);
    await ttPage.logoDropdownAboutButton.click();
    await page.waitForTimeout(500);

    // Verify version is displayed and not empty
    const versionText = await ttPage.aboutVersion.textContent();
    expect(versionText).toBeTruthy();
    expect(versionText).not.toBe("unknown");
    expect(versionText).toMatch(/^\d+\.\d+\.\d+$/); // Matches semver format

    // Verify build info is displayed
    const buildText = await ttPage.aboutBuild.textContent();
    expect(buildText).toBeTruthy();
    expect(buildText).toContain("@"); // Should contain date @ commit

    // Verify branch is displayed
    const branchText = await ttPage.aboutBranch.textContent();
    expect(branchText).toBeTruthy();
    expect(branchText).not.toBe("unknown");

    // Verify environment is displayed
    const envText = await ttPage.aboutEnvironment.textContent();
    expect(envText).toBeTruthy();
    expect(envText).toMatch(/^(development|production)$/i);
  });

  test("should display copyright and license info", async ({ page }) => {
    // Open About dialog
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);
    await ttPage.logoDropdownAboutButton.click();
    await page.waitForTimeout(500);

    // Verify copyright
    await expect(ttPage.aboutDialog).toContainText(
      "© 2024 TuneTrees Contributors"
    );

    // Verify license
    await expect(ttPage.aboutDialog).toContainText("Licensed under MIT");
  });

  test("should have working GitHub link", async ({ page, context }) => {
    // Open About dialog
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);
    await ttPage.logoDropdownAboutButton.click();
    await page.waitForTimeout(500);

    // Verify GitHub link exists and has correct attributes
    await expect(ttPage.aboutGithubLink).toBeVisible();
    await expect(ttPage.aboutGithubLink).toHaveAttribute(
      "href",
      "https://github.com/sboagy/tunetrees"
    );
    await expect(ttPage.aboutGithubLink).toHaveAttribute("target", "_blank");
    await expect(ttPage.aboutGithubLink).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
  });

  test("should have working Documentation link", async ({ page }) => {
    // Open About dialog
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);
    await ttPage.logoDropdownAboutButton.click();
    await page.waitForTimeout(500);

    // Verify Documentation link exists and has correct attributes
    await expect(ttPage.aboutDocsLink).toBeVisible();
    await expect(ttPage.aboutDocsLink).toHaveAttribute(
      "href",
      "https://github.com/sboagy/tunetrees/blob/main/README.md"
    );
    await expect(ttPage.aboutDocsLink).toHaveAttribute("target", "_blank");
    await expect(ttPage.aboutDocsLink).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
  });

  test("should close dialog with Close button", async ({ page }) => {
    // Open About dialog
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);
    await ttPage.logoDropdownAboutButton.click();
    await page.waitForTimeout(500);

    // Verify dialog is visible
    await expect(ttPage.aboutDialog).toBeVisible();

    // Click Close button
    await ttPage.aboutCloseButton.click();
    await page.waitForTimeout(500);

    // Verify dialog is hidden
    await expect(ttPage.aboutDialog).not.toBeVisible();
  });

  test("should close dialog with X button", async ({ page }) => {
    // Open About dialog
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);
    await ttPage.logoDropdownAboutButton.click();
    await page.waitForTimeout(500);

    // Verify dialog is visible
    await expect(ttPage.aboutDialog).toBeVisible();

    // Click X close button (using Kobalte's close button)
    const closeButton = ttPage.aboutDialog
      .locator('button[aria-label*="Close"], button:has(> svg)')
      .first();
    await closeButton.click();
    await page.waitForTimeout(500);

    // Verify dialog is hidden
    await expect(ttPage.aboutDialog).not.toBeVisible();
  });

  test("should close logo dropdown when clicking outside", async ({ page }) => {
    // Open logo dropdown
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);
    await expect(ttPage.logoDropdownPanel).toBeVisible();

    // Click outside the dropdown
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);

    // Verify dropdown is hidden
    await expect(ttPage.logoDropdownPanel).not.toBeVisible();
  });

  test("should navigate to What's New link", async ({ page }) => {
    // Open logo dropdown
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);

    // Verify What's New link
    await expect(ttPage.logoDropdownWhatsNewLink).toBeVisible();
    await expect(ttPage.logoDropdownWhatsNewLink).toHaveAttribute(
      "href",
      "https://github.com/sboagy/tunetrees/releases"
    );
    await expect(ttPage.logoDropdownWhatsNewLink).toHaveAttribute(
      "target",
      "_blank"
    );
  });

  test("should work on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    // Open logo dropdown
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);
    await expect(ttPage.logoDropdownPanel).toBeVisible();

    // Open About dialog
    await ttPage.logoDropdownAboutButton.click();
    await page.waitForTimeout(500);

    // Verify dialog is visible and readable on mobile
    await expect(ttPage.aboutDialog).toBeVisible();
    await expect(ttPage.aboutVersion).toBeVisible();
    await expect(ttPage.aboutGithubLink).toBeVisible();
    await expect(ttPage.aboutDocsLink).toBeVisible();
    await expect(ttPage.aboutCloseButton).toBeVisible();

    // Close dialog
    await ttPage.aboutCloseButton.click();
    await page.waitForTimeout(500);
    await expect(ttPage.aboutDialog).not.toBeVisible();
  });

  test("should support keyboard navigation", async ({ page }) => {
    // Open logo dropdown with keyboard
    await ttPage.logoDropdownButton.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await expect(ttPage.logoDropdownPanel).toBeVisible();

    // Navigate to About button with Tab
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Open About dialog with keyboard
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    await expect(ttPage.aboutDialog).toBeVisible();

    // Tab through dialog elements
    await page.keyboard.press("Tab"); // Should focus first link (GitHub)
    await page.keyboard.press("Tab"); // Should focus second link (Docs)
    await page.keyboard.press("Tab"); // Should focus Close button

    // Close with keyboard
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    await expect(ttPage.aboutDialog).not.toBeVisible();
  });

  test("should have proper ARIA attributes", async ({ page }) => {
    // Check logo dropdown button ARIA
    await expect(ttPage.logoDropdownButton).toHaveAttribute(
      "aria-label",
      "App menu"
    );
    await expect(ttPage.logoDropdownButton).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    // Open dropdown
    await ttPage.logoDropdownButton.click();
    await page.waitForTimeout(300);

    // Check expanded state
    await expect(ttPage.logoDropdownButton).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });
});
