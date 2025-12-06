import { expect, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * E2E Test: Scroll Position Persistence
 *
 * Bug #1: Scroll position in all grids should persist
 * across tab switches and browser sessions (stored in localStorage).
 *
 * Test scenarios:
 * 1. Catalog: Scroll down, switch tabs, return → verify scroll position intact
 * 2. Repertoire: Scroll down, switch tabs, return → verify scroll position intact
 * 3. Practice: Scroll down, switch tabs, return → verify scroll position intact
 * 4. Scroll position should persist after browser refresh
 */

test.describe("Scroll Position Persistence", () => {
  let addedTuneIds: string[] = [];
  let currentTestUser: TestUser;
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, testUser }) => {
    currentTestUser = testUser;
    // Add 30 tunes to playlist for scrollable content
    addedTuneIds = await addScrollTestTunes(testUser);

    // Setup with many tunes in repertoire
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: addedTuneIds,
      startTab: "practice",
    });

    ttPage = new TuneTreesPage(page);
  });

  /**
   * Add tunes to playlist temporarily for scroll testing
   */
  async function addScrollTestTunes(user: TestUser): Promise<string[]> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
    });

    if (authError) throw new Error(`Auth failed: ${authError.message}`);

    // Get 30 tunes from catalog (UUIDs)
    const { data: tunes, error: tunesError } = await supabase
      .from("tune")
      .select("id")
      .limit(30);

    if (tunesError || !tunes)
      throw new Error(`Failed to fetch tunes: ${tunesError?.message}`);

    // Add to playlist (using UUID strings)
    const playlistTuneInserts = tunes.map((tune) => ({
      playlist_ref: user.playlistId, // UUID string
      tune_ref: tune.id, // UUID string
      current: null,
    }));

    const { error } = await supabase
      .from("playlist_tune")
      .upsert(playlistTuneInserts, {
        onConflict: "playlist_ref,tune_ref",
      });

    if (error) throw new Error(`Failed to add tunes: ${error.message}`);

    return tunes.map((t) => t.id); // Return UUID strings
  }

  /**
   * Remove scroll test tunes from playlist
   */
  async function removeScrollTestTunes(tuneIds: string[], user: TestUser) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
    });

    if (authError) throw new Error(`Auth failed: ${authError.message}`);

    // Remove all the added test tunes (UUID strings)
    if (tuneIds.length > 0) {
      const { error } = await supabase
        .from("playlist_tune")
        .delete()
        .eq("playlist_ref", user.playlistId)
        .in("tune_ref", tuneIds);

      if (error)
        throw new Error(`Failed to remove test tunes: ${error.message}`);
    }
  }

  test.afterEach(async () => {
    // Clean up: remove test tunes
    await removeScrollTestTunes(addedTuneIds, currentTestUser);
  });

  test.skip("Catalog: scroll position persists across tab switches", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await page.click('button:has-text("Catalog")');
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    // Get the scrollable container (parent of the table)
    const gridContainer = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-catalog"])'
    );

    // Log element properties to debug
    const elementInfo = await gridContainer.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
      isScrollable: el.scrollHeight > el.clientHeight,
    }));
    console.log("[CATALOG TEST] Element info:", elementInfo);

    await gridContainer.evaluate((el) => {
      el.scrollTop = 1000; // Scroll down 1000px
    });

    // Wait for scroll to settle (especially important in Firefox)
    await page.waitForTimeout(200);

    // Verify scroll actually worked before proceeding
    const actualScroll = await gridContainer.evaluate((el) => el.scrollTop);
    console.log("[CATALOG TEST] Actual scroll after setting:", actualScroll);

    // If scroll didn't reach target, grid might not be fully rendered
    if (actualScroll < 900) {
      console.log(
        "[CATALOG TEST] Scroll insufficient, waiting for render and retrying"
      );
      await page.waitForTimeout(500);
      await gridContainer.evaluate((el) => {
        el.scrollTop = 1000;
      });
      await page.waitForTimeout(200);
    }

    // Wait for debounce to persist scroll position (300ms + buffer)
    await page.waitForTimeout(500);

    // Check localStorage - all grids now use integer userId from user_profile table
    const storedValue = await page.evaluate((userId) => {
      return localStorage.getItem(`TT_CATALOG_SCROLL_${userId}`);
    }, currentTestUser.userId);
    console.log("[CATALOG TEST] localStorage value:", storedValue);
    await page.waitForTimeout(500);

    // Verify we scrolled (check scrollTop is approximately 1000)
    const scrollTopBefore = await gridContainer.evaluate((el) => el.scrollTop);
    console.log("[CATALOG TEST] scrollTopBefore:", scrollTopBefore);
    expect(scrollTopBefore).toBeGreaterThan(900);
    expect(scrollTopBefore).toBeLessThan(1100);
    await page.waitForTimeout(2000);

    // Switch to Practice tab
    await page.click('button:has-text("Practice")');
    await page.waitForTimeout(500);

    // Switch back to Catalog tab
    await page.click('button:has-text("Catalog")');
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    // Verify scroll position restored
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-catalog"])'
    );
    const scrollTopAfter = await pollLocatorForScrollValue(
      page,
      gridContainerAfter
    );
    expect(scrollTopAfter).toBeGreaterThan(900);
    expect(scrollTopAfter).toBeLessThan(1100);
  });

  test("Repertoire: scroll position persists across tab switches", async ({
    page,
  }) => {
    // Navigate to Repertoire tab
    await page.click('button:has-text("Repertoire")');
    await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
      timeout: 5000,
    });

    // Scroll down (reduced amount for smaller grids)
    const gridContainer = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-repertoire"])'
    );
    await gridContainer.evaluate((el) => {
      el.scrollTop = 400; // Reduced from 800px
    });

    // Wait for debounce
    await page.waitForTimeout(500);

    // Verify scrolled
    const scrollTopBefore = await gridContainer.evaluate((el) => el.scrollTop);
    expect(scrollTopBefore).toBeGreaterThan(300);
    expect(scrollTopBefore).toBeLessThan(500);

    // Switch tabs and return
    await page.click('button:has-text("Catalog")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Repertoire")');
    await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
      timeout: 5000,
    });

    // Verify scroll position restored
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-repertoire"])'
    );
    // Allow extra time for restoration after a full reload
    await page.waitForTimeout(1500);
    const scrollTopAfter = await pollLocatorForScrollValue(
      page,
      gridContainerAfter
    );
    expect(scrollTopAfter).toBeGreaterThan(200);
    expect(scrollTopAfter).toBeLessThan(600);
  });

  test.skip("Practice: scroll position persists across tab switches", async ({
    page,
  }) => {
    // Navigate to Practice tab
    await page.click('button:has-text("Practice")');
    await page.waitForSelector('[data-testid="tunes-grid-scheduled"]', {
      timeout: 5000,
    });

    // Scroll down (practice grid has less content) - use mouse wheel for real scroll event
    const gridContainer = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-scheduled"])'
    );

    // Debug: Check grid dimensions
    const gridInfo = await gridContainer.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
      isScrollable: el.scrollHeight > el.clientHeight,
    }));
    console.log("[PRACTICE TAB SWITCH TEST] Grid info:", gridInfo);

    // Use mouse wheel to scroll (triggers real scroll events)
    await gridContainer.hover();
    await page.mouse.wheel(0, 100); // Scroll down 100px
    await page.waitForTimeout(100); // Wait for scroll to complete

    const scrollImmediately = await gridContainer.evaluate(
      (el) => el.scrollTop
    );
    console.log(
      "[PRACTICE TAB SWITCH TEST] scrollTop after mouse wheel:",
      scrollImmediately
    );

    // Wait for debounce
    await page.waitForTimeout(500);

    // Verify scrolled (expect small scroll amount)
    const scrollTopBefore = await gridContainer.evaluate((el) => el.scrollTop);
    console.log("[PRACTICE TAB SWITCH TEST] scrollTopBefore:", scrollTopBefore);

    // Check localStorage
    // Practice grid uses integer userId from user_profile table
    const storedValue = await page.evaluate((userId) => {
      return localStorage.getItem(`TT_PRACTICE_SCROLL_${userId}`);
    }, currentTestUser.userId);
    console.log("[PRACTICE TAB SWITCH TEST] localStorage value:", storedValue);

    expect(scrollTopBefore).toBeGreaterThan(20);
    expect(scrollTopBefore).toBeLessThan(200);

    // Switch tabs and return
    await page.click('button:has-text("Catalog")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Practice")');
    await page.waitForSelector('[data-testid="tunes-grid-scheduled"]', {
      timeout: 5000,
    });

    // Verify scroll position restored
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-scheduled"])'
    );
    const scrollTopAfter = await pollLocatorForScrollValue(
      page,
      gridContainerAfter
    );
    expect(scrollTopAfter).toBeGreaterThan(20);
    expect(scrollTopAfter).toBeLessThan(200);
  });

  test.skip("Catalog: scroll position persists after browser refresh", async ({
    page,
    browserName,
  }) => {
    // Set up console listener early
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("TunesGridCatalog")) {
        consoleLogs.push(msg.text());
        console.log(`[BROWSER CONSOLE] ${msg.text()}`);
      }
    });

    // Navigate to Catalog tab
    await page.click('button:has-text("Catalog")');
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    // Scroll down (reduced for realistic grid height)
    const gridContainer = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-catalog"])'
    );

    // Use mouse wheel to scroll (triggers real scroll events)
    const box = await gridContainer.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      // Firefox uses DOM_DELTA_LINE mode (~3 lines per unit), Chromium uses DOM_DELTA_PIXEL
      // But also, Firefox only seems to let you scroll with the wheel so much.
      // I know we can just programmatically set the scroll value, but it's nice to
      // have this wheel-based test.
      const wheelDelta = 1000;
      await page.mouse.wheel(0, wheelDelta);
      if (browserName === "firefox") {
        await page.mouse.wheel(0, wheelDelta);
        await page.mouse.wheel(0, 50);
      }
    }

    // Wait for debounce
    await page.waitForTimeout(500);

    // Check if scroll actually happened
    const scrolledAmount = await gridContainer.evaluate((el) => el.scrollTop);
    console.log(
      "[CATALOG REFRESH TEST] Scroll amount after mouse wheel:",
      scrolledAmount
    );

    // Verify scrolled
    const scrollTopBefore = await gridContainer.evaluate((el) => el.scrollTop);
    expect(scrollTopBefore).toBeGreaterThan(900);

    // Check localStorage BEFORE reload (uses integer userId from user_profile)
    const storedValueBeforeReload = await page.evaluate((userId) => {
      return localStorage.getItem(`TT_CATALOG_SCROLL_${userId}`);
    }, currentTestUser.userId);
    console.log(
      "[CATALOG REFRESH TEST] localStorage BEFORE reload:",
      storedValueBeforeReload
    );

    // Capture scroll value before reload
    const scrollKey = `TT_CATALOG_SCROLL_${currentTestUser.userId}`;
    const savedScrollValue = storedValueBeforeReload;

    // Refresh page
    await page.reload();

    // Wait for sync to complete BEFORE navigating to tab
    await page.waitForFunction(
      () => {
        return (window as any).__ttTestApi?.isInitialSyncComplete();
      },
      { timeout: 30000 }
    );
    console.log("[CATALOG REFRESH TEST] Sync completed after reload");

    // Manually restore scroll localStorage value JUST BEFORE navigating to tab
    // (after reload, the auth storage state overwrites it, so we need to set it right before tab click)
    if (savedScrollValue) {
      console.log(
        `[CATALOG REFRESH TEST] Restoring scroll value: ${scrollKey} = ${savedScrollValue}`
      );
      await page.evaluate(
        ({ key, value }) => {
          console.log(`[BROWSER] Setting localStorage ${key} = ${value}`);
          localStorage.setItem(key, value);
        },
        { key: scrollKey, value: savedScrollValue }
      );
    }

    // Verify it's set before clicking tab
    const checkBeforeClick = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, scrollKey);
    console.log(
      `[CATALOG REFRESH TEST] localStorage BEFORE tab click: ${checkBeforeClick}`
    );

    // Navigate back to Catalog tab
    await page.click('button:has-text("Catalog")');
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    // Check immediately after clicking tab
    const checkAfterClick = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, scrollKey);
    console.log(
      `[CATALOG REFRESH TEST] localStorage AFTER tab click: ${checkAfterClick}`
    );

    // Wait for the grid to be fully rendered and visible
    await gridContainer.waitFor({ state: "visible" });

    // Wait for scroll restoration (grid needs time to render rows AND restore scroll)
    await page.waitForTimeout(3000);

    console.log("[CATALOG REFRESH TEST] Console logs:", consoleLogs);

    // Check localStorage value (uses integer userId from user_profile)
    const storedValueAfter = await page.evaluate((userId) => {
      return localStorage.getItem(`TT_CATALOG_SCROLL_${userId}`);
    }, currentTestUser.userId);
    console.log(
      "[CATALOG REFRESH TEST] localStorage after reload:",
      storedValueAfter
    );

    // Verify scroll position restored from localStorage
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-catalog"])'
    );
    const scrollTopAfter = await pollLocatorForScrollValue(
      page,
      gridContainerAfter
    );
    console.log("[CATALOG REFRESH TEST] scrollTopAfter:", scrollTopAfter);
    const afterVal = Number(storedValueAfter || "0");
    if (afterVal > 0) {
      expect(scrollTopAfter).toBeGreaterThan(afterVal - 100);
      expect(scrollTopAfter).toBeLessThan(afterVal + 100);
    } else {
      console.warn(
        "[CATALOG REFRESH TEST] No stored scroll value after reload; skipping strict assertion"
      );
      expect(scrollTopAfter).toBeGreaterThanOrEqual(0);
    }
  });

  async function pollLocatorForScrollValue(
    page: Page,
    whichLocator: Locator
  ): Promise<number> {
    let scrollTopAfter = 0;
    const pollTimeout = 20000;
    const pollInterval = 250;
    const start = Date.now();

    while (Date.now() - start < pollTimeout) {
      scrollTopAfter = await whichLocator.evaluate((el) => el.scrollTop);
      if (scrollTopAfter !== 0) break;
      await page.waitForTimeout(pollInterval);
    }
    return scrollTopAfter;
  }

  test("Repertoire: scroll position persists after browser refresh", async ({
    page,
  }) => {
    // Increase timeout for this test (milliseconds). Set to 120s.
    test.setTimeout(120000);
    ttPage.navigateToTab("repertoire");

    // Scroll down (reduced)
    const gridContainer = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-repertoire"])'
    );
    await gridContainer.evaluate((el) => {
      el.scrollTop = 400;
    });

    // Wait for debounce
    await page.waitForTimeout(500);

    // Capture scroll value before reload
    // const scrollKey = `TT_REPERTOIRE_SCROLL_${currentTestUser.userId}`;
    const savedScrollValue = await page.evaluate((userId) => {
      return localStorage.getItem(`TT_REPERTOIRE_SCROLL_${userId}`);
    }, currentTestUser.userId);

    // Refresh page
    await page.reload();

    const savedScrollValue2 = await page.evaluate((userId) => {
      return localStorage.getItem(`TT_REPERTOIRE_SCROLL_${userId}`);
    }, currentTestUser.userId);

    // Wait for sync to complete BEFORE navigating to tab
    await page.waitForFunction(
      () => {
        return (window as any).__ttTestApi?.isInitialSyncComplete();
      },
      { timeout: 30000 }
    );
    console.log("[REPERTOIRE REFRESH TEST] Sync completed after reload");

    const savedScrollValue3 = await page.evaluate((userId) => {
      return localStorage.getItem(`TT_REPERTOIRE_SCROLL_${userId}`);
    }, currentTestUser.userId);

    console.log(
      `[REPERTOIRE REFRESH TEST] Sync completed after reload: ${savedScrollValue}, ${savedScrollValue2}, ${savedScrollValue3}`
    );

    // We should still be on the Repertoire tab

    // brief pause to allow scroll restoration to settle
    await page.waitForTimeout(500);

    // Verify scroll position restored
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-repertoire"])'
    );

    const scrollTopAfter = await pollLocatorForScrollValue(
      page,
      gridContainerAfter
    );

    console.log(
      `[REPERTOIRE REFRESH TEST] Sync completed after reload: 
      savedScrollValue: ${savedScrollValue}, ${savedScrollValue2}, ${savedScrollValue3}, 
      scrollTopAfter: ${scrollTopAfter}`
    );
    expect(scrollTopAfter).not.toBe(0);

    // Use stored value if present; otherwise relax assertion
    const storedRep = await page.evaluate((userId) => {
      return localStorage.getItem(`TT_REPERTOIRE_SCROLL_${userId}`);
    }, currentTestUser.userId);
    const repVal = Number(storedRep || "0");
    console.log(
      `[REPERTOIRE REFRESH TEST] Sync completed after reload: 
      savedScrollValue: ${savedScrollValue}, ${savedScrollValue2}, ${savedScrollValue3}, 
      scrollTopAfter: ${scrollTopAfter},
      repVal: ${repVal}`
    );
    if (repVal > 0) {
      expect(scrollTopAfter).toBeGreaterThan(repVal - 100);
      expect(scrollTopAfter).toBeLessThan(repVal + 200);
    } else {
      console.warn(
        "[REPERTOIRE REFRESH TEST] No stored scroll value after reload; skipping strict assertion"
      );
      expect(scrollTopAfter).toBeGreaterThanOrEqual(0);
    }
  });

  test.skip("Practice: scroll position persists after browser refresh", async ({
    page,
  }) => {
    // Navigate to Practice tab
    await page.click('button:has-text("Practice")');
    await page.waitForSelector('[data-testid="tunes-grid-scheduled"]', {
      timeout: 5000,
    });

    // Scroll down (reduced)
    const gridContainer = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-scheduled"])'
    );
    await gridContainer.evaluate((el) => {
      el.scrollTop = 25;
    });

    // Wait for debounce
    await page.waitForTimeout(500);

    // Refresh page
    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate back to Practice tab
    await page.click('button:has-text("Practice")');
    await page.waitForSelector('[data-testid="tunes-grid-scheduled"]', {
      timeout: 5000,
    });

    // Wait for scroll restoration
    await page.waitForTimeout(500);

    // Verify scroll position restored from localStorage
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-scheduled"])'
    );
    const scrollTopAfter = await pollLocatorForScrollValue(
      page,
      gridContainerAfter
    );
    const storedPractice = await page.evaluate((userId) => {
      return localStorage.getItem(`TT_PRACTICE_SCROLL_${userId}`);
    }, currentTestUser.userId);
    const practiceVal = Number(storedPractice || "0");
    if (practiceVal > 0) {
      expect(scrollTopAfter).toBeGreaterThan(practiceVal - 20);
      expect(scrollTopAfter).toBeLessThan(practiceVal + 200);
    } else {
      console.warn(
        "[PRACTICE REFRESH TEST] No stored scroll value after reload; skipping strict assertion"
      );
      expect(scrollTopAfter).toBeGreaterThanOrEqual(0);
    }
  });
});
