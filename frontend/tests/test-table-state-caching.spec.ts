import { test, expect } from "@playwright/test";
import { TuneTreesPO } from "../test-scripts/tunetrees.po";

test.describe("Table State Caching Optimization", () => {
  let ttPO: TuneTreesPO;

  test.beforeEach(async ({ page }) => {
    ttPO = new TuneTreesPO(page);
    await ttPO.gotoMainPage();
  });

  test("should batch table state updates and reduce API calls", async ({ page }) => {
    // Set up network monitoring to track API calls
    const tableStateRequests = [];
    page.on('request', request => {
      if (request.url().includes('/settings/table_state')) {
        tableStateRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });

    // Navigate to practice page where table state is used
    await ttPO.clickPracticeTab();
    await page.waitForTimeout(1000);

    // Clear any existing requests from initial load
    tableStateRequests.length = 0;

    // Perform multiple rapid table interactions that would normally trigger multiple API calls
    const repertoireTab = page.locator('[data-testid="tab-repertoire"]');
    const practiceTab = page.locator('[data-testid="tab-practice"]');

    // Switch tabs multiple times rapidly (this normally triggers table state saves)
    await repertoireTab.click();
    await page.waitForTimeout(100);
    await practiceTab.click();
    await page.waitForTimeout(100);
    await repertoireTab.click();
    await page.waitForTimeout(100);
    await practiceTab.click();

    // Try to interact with table sorting if available
    const sortHeaders = page.locator('[data-testid^="sort-header"]');
    const sortHeaderCount = await sortHeaders.count();
    
    if (sortHeaderCount > 0) {
      // Click a few sort headers to trigger more state changes
      await sortHeaders.first().click();
      await page.waitForTimeout(100);
      if (sortHeaderCount > 1) {
        await sortHeaders.nth(1).click();
        await page.waitForTimeout(100);
      }
    }

    // Wait for the background polling interval (2.5 seconds plus buffer)
    await page.waitForTimeout(3000);

    // Check that we have fewer API calls than we would expect without caching
    // With caching, we should see significantly fewer calls
    console.log(`Table state API calls made: ${tableStateRequests.length}`);
    
    // Without caching, each interaction would trigger an immediate API call
    // With caching, we should see at most a few batched calls
    expect(tableStateRequests.length).toBeLessThan(8); // Should be much less than number of interactions
    
    // Most requests should be GET requests for initial loads, with fewer POST/PATCH for updates
    const updateRequests = tableStateRequests.filter(req => 
      req.method === 'POST' || req.method === 'PATCH'
    );
    
    console.log(`Update API calls made: ${updateRequests.length}`);
    expect(updateRequests.length).toBeLessThan(5); // Should be batched
  });

  test("should immediately flush on page navigation", async ({ page }) => {
    // Monitor for table state requests
    const tableStateRequests = [];
    page.on('request', request => {
      if (request.url().includes('/settings/table_state')) {
        tableStateRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });

    // Navigate to practice page
    await ttPO.clickPracticeTab();
    await page.waitForTimeout(1000);

    // Clear initial requests
    tableStateRequests.length = 0;

    // Perform a table interaction
    const repertoireTab = page.locator('[data-testid="tab-repertoire"]');
    await repertoireTab.click();
    await page.waitForTimeout(500);

    // Navigate away (this should trigger immediate flush)
    await page.goto(page.url().replace(/\/pages\/practice.*/, '/pages/user-settings'));
    await page.waitForTimeout(1000);

    // Should have triggered at least one immediate flush
    const updateRequests = tableStateRequests.filter(req => 
      req.method === 'POST' || req.method === 'PATCH'
    );
    
    expect(updateRequests.length).toBeGreaterThan(0);
    console.log(`Immediate flush requests: ${updateRequests.length}`);
  });

  test("should handle table sorting with cached updates", async ({ page }) => {
    // Navigate to a page with sortable tables
    await ttPO.clickPracticeTab();
    await page.waitForTimeout(1000);

    // Wait for table to load
    const tableContainer = page.locator('[data-testid*="table"], table').first();
    await tableContainer.waitFor({ state: 'visible', timeout: 10000 });

    // Monitor table state requests
    const tableStateRequests = [];
    page.on('request', request => {
      if (request.url().includes('/settings/table_state')) {
        tableStateRequests.push({
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });

    // Try to find and click sortable columns
    const sortableHeaders = page.locator('th[role="columnheader"], [data-testid*="sort"]');
    const headerCount = await sortableHeaders.count();

    if (headerCount > 0) {
      // Click multiple headers in succession
      for (let i = 0; i < Math.min(3, headerCount); i++) {
        await sortableHeaders.nth(i).click();
        await page.waitForTimeout(200);
      }

      // Wait for batch processing
      await page.waitForTimeout(3000);

      // Should have fewer API calls than clicks due to batching
      const updateRequests = tableStateRequests.filter(req => 
        req.method === 'POST' || req.method === 'PATCH'
      );
      
      console.log(`Sort interactions: 3, API calls: ${updateRequests.length}`);
      expect(updateRequests.length).toBeLessThanOrEqual(2); // Should be batched
    } else {
      console.log("No sortable headers found, skipping sort test");
    }
  });
});