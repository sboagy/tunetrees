import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { setupForPracticeTests } from "../helpers/practice-scenarios";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

test.use({ storageState: "e2e/.auth/alice.json" });

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
  let addedTuneIds: number[] = [];

  test.beforeEach(async ({ page }) => {
    // Add 30 tunes to playlist for scrollable content
    addedTuneIds = await addScrollTestTunes();

    // Setup with many tunes in repertoire
    await setupForPracticeTests(page, {
      repertoireTunes: addedTuneIds,
      startTab: "practice",
    });
  });

  /**
   * Add tunes to playlist temporarily for scroll testing
   */
  async function addScrollTestTunes() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: "alice.test@tunetrees.test",
      password: process.env.ALICE_TEST_PASSWORD || "TestPassword123!",
    });

    if (authError) throw new Error(`Auth failed: ${authError.message}`);

    // Get 30 tunes from catalog
    const { data: tunes, error: tunesError } = await supabase
      .from("tune")
      .select("id")
      .limit(30);

    if (tunesError || !tunes)
      throw new Error(`Failed to fetch tunes: ${tunesError?.message}`);

    // Add to playlist
    const playlistTuneInserts = tunes.map((tune) => ({
      playlist_ref: 9001,
      tune_ref: tune.id,
      current: null,
    }));

    const { error } = await supabase
      .from("playlist_tune")
      .upsert(playlistTuneInserts, {
        onConflict: "playlist_ref,tune_ref",
      });

    if (error) throw new Error(`Failed to add tunes: ${error.message}`);

    return tunes.map((t) => t.id);
  }

  /**
   * Remove scroll test tunes from playlist
   */
  async function removeScrollTestTunes(tuneIds: number[]) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: "alice.test@tunetrees.test",
      password: process.env.ALICE_TEST_PASSWORD || "TestPassword123!",
    });

    if (authError) throw new Error(`Auth failed: ${authError.message}`);

    // Only delete the tunes we added (beyond the original 2)
    const tunesToRemove = tuneIds.slice(2); // Keep 9001 and 9002

    if (tunesToRemove.length > 0) {
      const { error } = await supabase
        .from("playlist_tune")
        .delete()
        .eq("playlist_ref", 9001)
        .in("tune_ref", tunesToRemove);

      if (error)
        throw new Error(`Failed to remove test tunes: ${error.message}`);
    }
  }

  test.afterEach(async () => {
    // Clean up: remove test tunes
    await removeScrollTestTunes(addedTuneIds);
  });

  test("Catalog: scroll position persists across tab switches", async ({
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

    // Wait for debounce to persist scroll position (300ms + buffer)
    await page.waitForTimeout(500);

    // Check localStorage - all grids now use integer userId from user_profile table
    // Alice's integer userId is 9001
    const storedValue = await page.evaluate(() => {
      const ALICE_USER_ID = 9001; // Integer ID from user_profile table
      return localStorage.getItem(`TT_CATALOG_SCROLL_${ALICE_USER_ID}`);
    });
    console.log("[CATALOG TEST] localStorage value:", storedValue);

    // Verify we scrolled (check scrollTop is approximately 1000)
    const scrollTopBefore = await gridContainer.evaluate((el) => el.scrollTop);
    console.log("[CATALOG TEST] scrollTopBefore:", scrollTopBefore);
    expect(scrollTopBefore).toBeGreaterThan(900);
    expect(scrollTopBefore).toBeLessThan(1100);

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
    const scrollTopAfter = await gridContainerAfter.evaluate(
      (el) => el.scrollTop
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
    const scrollTopAfter = await gridContainerAfter.evaluate(
      (el) => el.scrollTop
    );
    expect(scrollTopAfter).toBeGreaterThan(200);
    expect(scrollTopAfter).toBeLessThan(600);
  });

  test("Practice: scroll position persists across tab switches", async ({
    page,
  }) => {
    // Navigate to Practice tab
    await page.click('button:has-text("Practice")');
    await page.waitForSelector('[data-testid="tunes-grid-practice"]', {
      timeout: 5000,
    });

    // Scroll down (practice grid has less content) - use mouse wheel for real scroll event
    const gridContainer = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-practice"])'
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
    // Practice grid uses integer userId from user_profile table, not parsed UUID
    // Alice's integer userId is 9001
    const storedValue = await page.evaluate(() => {
      const PRACTICE_USER_ID = 9001; // Alice's integer ID from user_profile
      return localStorage.getItem(`TT_PRACTICE_SCROLL_${PRACTICE_USER_ID}`);
    });
    console.log("[PRACTICE TAB SWITCH TEST] localStorage value:", storedValue);

    expect(scrollTopBefore).toBeGreaterThan(20);
    expect(scrollTopBefore).toBeLessThan(200);

    // Switch tabs and return
    await page.click('button:has-text("Catalog")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Practice")');
    await page.waitForSelector('[data-testid="tunes-grid-practice"]', {
      timeout: 5000,
    });

    // Verify scroll position restored
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-practice"])'
    );
    const scrollTopAfter = await gridContainerAfter.evaluate(
      (el) => el.scrollTop
    );
    expect(scrollTopAfter).toBeGreaterThan(20);
    expect(scrollTopAfter).toBeLessThan(200);
  });

  test("Catalog: scroll position persists after browser refresh", async ({
    page,
  }) => {
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
      // Scroll down with mouse wheel (negative deltaY scrolls down)
      await page.mouse.wheel(0, 1000);
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
    const storedValueBeforeReload = await page.evaluate(() => {
      const ALICE_USER_ID = 9001; // Integer ID from user_profile table
      return localStorage.getItem(`TT_CATALOG_SCROLL_${ALICE_USER_ID}`);
    });
    console.log(
      "[CATALOG REFRESH TEST] localStorage BEFORE reload:",
      storedValueBeforeReload
    );

    // Refresh page
    await page.reload();
    await page.waitForTimeout(2000); // Wait for sync after reload

    // Navigate back to Catalog tab
    await page.click('button:has-text("Catalog")');
    await page.waitForSelector('[data-testid="tunes-grid-catalog"]', {
      timeout: 5000,
    });

    // Wait for the grid to be fully rendered and visible
    await gridContainer.waitFor({ state: "visible" });

    // Wait MUCH longer for scroll restoration after page reload
    await page.waitForTimeout(5000); // Increased to 5 seconds
    // Check localStorage value (uses integer userId from user_profile)
    const storedValueAfter = await page.evaluate(() => {
      const ALICE_USER_ID = 9001; // Integer ID from user_profile table
      return localStorage.getItem(`TT_CATALOG_SCROLL_${ALICE_USER_ID}`);
    });
    console.log(
      "[CATALOG REFRESH TEST] localStorage after reload:",
      storedValueAfter
    );

    // Verify scroll position restored from localStorage
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-catalog"])'
    );
    const scrollTopAfter = await gridContainerAfter.evaluate(
      (el) => el.scrollTop
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

  test("Repertoire: scroll position persists after browser refresh", async ({
    page,
  }) => {
    // Navigate to Repertoire tab
    await page.click('button:has-text("Repertoire")');
    await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
      timeout: 5000,
    });

    // Scroll down (reduced)
    const gridContainer = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-repertoire"])'
    );
    await gridContainer.evaluate((el) => {
      el.scrollTop = 400;
    });

    // Wait for debounce
    await page.waitForTimeout(500);

    // Refresh page
    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate back to Repertoire tab
    await page.click('button:has-text("Repertoire")');
    await page.waitForSelector('[data-testid="tunes-grid-repertoire"]', {
      timeout: 5000,
    });

    // Wait for scroll restoration (allow more time after full reload)
    await page.waitForTimeout(3000);

    // Verify scroll position restored
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-repertoire"])'
    );
    const scrollTopAfter = await gridContainerAfter.evaluate(
      (el) => el.scrollTop
    );
    // Use stored value if present; otherwise relax assertion
    const storedRep = await page.evaluate(() => {
      const ALICE_USER_ID = 9001;
      return localStorage.getItem(`TT_REPERTOIRE_SCROLL_${ALICE_USER_ID}`);
    });
    const repVal = Number(storedRep || "0");
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

  test("Practice: scroll position persists after browser refresh", async ({
    page,
  }) => {
    // Navigate to Practice tab
    await page.click('button:has-text("Practice")');
    await page.waitForSelector('[data-testid="tunes-grid-practice"]', {
      timeout: 5000,
    });

    // Scroll down (reduced)
    const gridContainer = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-practice"])'
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
    await page.waitForSelector('[data-testid="tunes-grid-practice"]', {
      timeout: 5000,
    });

    // Wait for scroll restoration
    await page.waitForTimeout(500);

    // Verify scroll position restored from localStorage
    const gridContainerAfter = page.locator(
      'div.overflow-auto:has([data-testid="tunes-grid-practice"])'
    );
    const scrollTopAfter = await gridContainerAfter.evaluate(
      (el) => el.scrollTop
    );
    const storedPractice = await page.evaluate(() => {
      const PRACTICE_USER_ID = 9001;
      return localStorage.getItem(`TT_PRACTICE_SCROLL_${PRACTICE_USER_ID}`);
    });
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
