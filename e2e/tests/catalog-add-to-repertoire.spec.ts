/**
 * E2E Test: Add Tunes from Catalog to Repertoire
 *
 * Tests the "Add To Repertoire" feature on the Catalog toolbar.
 *
 * User Flow:
 * 1. Log in as test user
 * 2. Navigate to Catalog tab
 * 3. Select tunes via checkboxes
 * 4. Click "Add To Repertoire" button
 * 5. Navigate to Repertoire tab
 * 6. Verify selected tunes appear in repertoire
 *
 * Edge Cases:
 * - No tunes selected (button should show alert)
 * - Tunes already in repertoire (should be skipped with feedback)
 * - Multiple tunes selected (batch operation)
 */

import { expect } from "@playwright/test";
import {
  CATALOG_TUNE_A_FIG_FOR_A_KISS,
  CATALOG_TUNE_ALASDRUIMS_MARCH,
} from "../../src/lib/db/catalog-tune-ids";
import {
  CATALOG_TUNE_66_ID,
  CATALOG_TUNE_70_ID,
  getPrivateTuneIds,
} from "../../tests/fixtures/test-data";
import { skipIfMobileChrome } from "../helpers/mobile-project";
import { setupForCatalogTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe
  .serial("Catalog: Add To Repertoire", () => {
    test.setTimeout(45000);

    let currentTestUser: TestUser;
    let ttPage: TuneTreesPage;

    test.beforeEach(async ({ page, testUser }) => {
      currentTestUser = testUser;
      ttPage = new TuneTreesPage(page);
      await setupForCatalogTestsParallel(page, testUser, {
        emptyRepertoire: true,
        startTab: "catalog",
      });
      await page.waitForTimeout(500);
    });

    test("should show alert when no tunes selected", async ({ page }) => {
      let dialogMessage = "";
      page.on("dialog", async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
        timeout: 10000,
      });
      await ttPage.expectToolbarVisible({
        addToRepertoire: true,
        tab: "catalog",
      });

      await ttPage.clickCatalogAddToRepertoire();
      await page.waitForTimeout(500);

      expect(dialogMessage).toContain("No tunes selected");
    });

    test("should add selected tunes to repertoire @side-effects", async ({
      page,
    }) => {
      skipIfMobileChrome(
        test.info().project.name,
        test.skip,
        "Test relies on desktop row-selection checkboxes that are not rendered in the mobile stacked list."
      );

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          console.error(`❌ BROWSER ERROR: ${msg.text()}`);
          return;
        }

        if (
          process.env.E2E_TEST_SETUP_DEBUG === "true" ||
          process.env.E2E_TEST_SETUP_DEBUG === "1"
        ) {
          console.log(`🖥️  BROWSER: ${msg.text()}`);
        }
      });
      page.on("pageerror", (err) =>
        console.error(`❌ PAGE ERROR: ${err.message}`)
      );

      ttPage.navigateToTab("catalog");
      await page.waitForTimeout(200);

      const tune1Checkbox = page.getByRole("checkbox", {
        name: `Select row ${CATALOG_TUNE_A_FIG_FOR_A_KISS}`,
      });
      const tune2Checkbox = page.getByRole("checkbox", {
        name: `Select row ${CATALOG_TUNE_ALASDRUIMS_MARCH}`,
      });

      await tune1Checkbox.check();
      await tune2Checkbox.check();

      const checkedBoxes = await page
        .locator(
          '[data-testid="tunes-grid-catalog"] input[type="checkbox"]:checked'
        )
        .count();
      console.log(`📌 Number of checked boxes: ${checkedBoxes}`);

      let dialogMessage = "";
      page.on("dialog", async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await ttPage.clickCatalogAddToRepertoire();
      await page.waitForTimeout(500);

      console.log(`Dialog: ${dialogMessage}`);
      expect(dialogMessage).toContain("Added 2 tune");

      await page.waitForTimeout(2000);
      await ttPage.navigateToTab("repertoire");
      await page.waitForTimeout(500);

      const supabaseCount = await page.evaluate(async (repertoireId) => {
        const response = await fetch(
          `http://localhost:54321/rest/v1/repertoire_tune?repertoire_ref=eq.${repertoireId}&select=tune_ref`,
          {
            headers: {
              apikey:
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();
        return data.length;
      }, currentTestUser.repertoireId);
      console.log(
        `🔍 Supabase has ${supabaseCount} tunes for user ${currentTestUser.repertoireId}`
      );

      const dataRows = page.locator(
        '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
      );
      const dataCount = await dataRows.count();
      console.log(`📊 Repertoire has ${dataCount} data rows`);
      expect(dataCount).toBe(2);

      const row0Text = await dataRows.nth(0).textContent();
      const row1Text = await dataRows.nth(1).textContent();
      expect(row0Text).toContain("A Fig for a Kiss");
      expect(row1Text).toContain("Alasdruim's March");
    });

    test("should handle tunes already in repertoire @side-effects", async ({
      page,
    }) => {
      skipIfMobileChrome(
        test.info().project.name,
        test.skip,
        "Test relies on desktop row-selection checkboxes that are not rendered in the mobile stacked list."
      );

      await ttPage.navigateToTab("catalog");
      await page.waitForTimeout(500);
      await ttPage.expectGridHasContent(ttPage.catalogGrid);
      await ttPage.searchForTune("Banish Misfortune", ttPage.catalogGrid);

      const { privateTune1Id } = getPrivateTuneIds(currentTestUser.userId);
      const userPrivateTune = await ttPage.getTuneRowById(
        privateTune1Id,
        ttPage.catalogGrid
      );
      await expect(userPrivateTune).toBeVisible({ timeout: 5000 });
      await ttPage.setGridRowChecked(privateTune1Id, ttPage.catalogGrid);

      let dialogMessage = "";
      page.on("dialog", async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await ttPage.clickCatalogAddToRepertoire();
      await page.waitForTimeout(500);
      console.log(`First add: ${dialogMessage}`);
      expect(dialogMessage).toContain("Added 1 tune");

      await ttPage.navigateToTab("catalog");
      await page.waitForTimeout(500);
      await ttPage.clearSearch();
      await ttPage.searchForTune("Banish Misfortune", ttPage.catalogGrid);

      const userPrivateTuneB = await ttPage.getTuneRowById(
        privateTune1Id,
        ttPage.catalogGrid
      );
      await expect(userPrivateTuneB).toBeVisible({ timeout: 5000 });
      await ttPage.setGridRowChecked(privateTune1Id, ttPage.catalogGrid);

      dialogMessage = "";
      await ttPage.clickCatalogAddToRepertoire();
      await page.waitForTimeout(500);

      console.log(`Second add: ${dialogMessage}`);
      expect(dialogMessage).toMatch(
        /already in repertoire|No tunes were added/
      );
    });

    test("should handle batch add with mix of new and existing tunes", async ({
      page,
    }) => {
      skipIfMobileChrome(
        test.info().project.name,
        test.skip,
        "Test relies on desktop row-selection checkboxes that are not rendered in the mobile stacked list."
      );

      await ttPage.navigateToTab("catalog");
      await page.waitForTimeout(500);
      await ttPage.filterByGenre("Irish Traditional Music");

      const checkbox = page.getByRole("checkbox", {
        name: `Select row ${CATALOG_TUNE_66_ID}`,
      });
      await checkbox.check();

      let dialogMessage = "";
      page.on("dialog", async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await ttPage.clickCatalogAddToRepertoire();
      await page.waitForTimeout(500);

      await ttPage.navigateToTab("catalog");
      await page.waitForTimeout(500);

      await page
        .getByRole("checkbox", { name: `Select row ${CATALOG_TUNE_66_ID}` })
        .check();
      await page
        .getByRole("checkbox", { name: `Select row ${CATALOG_TUNE_70_ID}` })
        .check();

      dialogMessage = "";
      await ttPage.clickCatalogAddToRepertoire();
      await page.waitForTimeout(500);

      console.log(`Batch add: ${dialogMessage}`);
      expect(dialogMessage).toContain("Added 1 tune");
    });

    test("CRITICAL: should persist added tunes after page reload @side-effects", async ({
      page,
    }) => {
      skipIfMobileChrome(
        test.info().project.name,
        test.skip,
        "Test relies on desktop row-selection checkboxes that are not rendered in the mobile stacked list."
      );

      await ttPage.navigateToTab("catalog");
      await page.waitForTimeout(500);

      {
        const dataRowsBefore = page.locator(
          '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
        );
        const countBefore = await dataRowsBefore.count();
        console.log(`✅ ${countBefore} tunes before reload (1)`);
        expect(countBefore).toBe(0);
      }

      const tune1Checkbox = page.getByRole("checkbox", {
        name: `Select row ${CATALOG_TUNE_A_FIG_FOR_A_KISS}`,
      });
      const tune2Checkbox = page.getByRole("checkbox", {
        name: `Select row ${CATALOG_TUNE_ALASDRUIMS_MARCH}`,
      });

      await tune1Checkbox.check();
      await tune2Checkbox.check();

      const checkedBoxes = await page
        .locator(
          '[data-testid="tunes-grid-catalog"] input[type="checkbox"]:checked'
        )
        .count();
      console.log(`📌 Number of checked boxes in catalog: ${checkedBoxes}`);

      page.on("dialog", async (dialog) => {
        console.log("Dialog message:", dialog.message());
        await dialog.accept();
      });
      await ttPage.clickCatalogAddToRepertoire();

      console.log("⏳ Waiting for sync to complete...");
      await page.waitForTimeout(3000);

      await ttPage.navigateToTab("repertoire");
      await page.waitForTimeout(200);

      const dataRowsBefore = page.locator(
        '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
      );
      const countBefore = await dataRowsBefore.count();
      console.log(`✅ ${countBefore} tunes before reload (2)`);
      expect(countBefore).toBeGreaterThanOrEqual(2);

      await expect(page.getByText("A Fig for a Kiss")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Alasdruim's March")).toBeVisible({
        timeout: 10000,
      });

      console.log("🔄 Reloading page...");
      await page.reload();
      await page.waitForTimeout(3000);

      await ttPage.navigateToTab("repertoire");
      await page.waitForTimeout(200);

      const dataRowsAfter = page.locator(
        '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
      );
      const countAfter = await dataRowsAfter.count();
      console.log(`📊 ${countAfter} tunes after reload`);
      expect(countAfter).toBeGreaterThanOrEqual(2);

      await expect(page.getByText("A Fig for a Kiss")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Alasdruim's March")).toBeVisible({
        timeout: 10000,
      });

      console.log("✅ PASS: Tunes persist after reload!");
    });
  });
