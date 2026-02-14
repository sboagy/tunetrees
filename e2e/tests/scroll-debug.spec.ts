import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";
import { BASE_URL } from "../test-config";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

// Debug helper to set localStorage flags before any app scripts run
const setDebugFlags = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("TT_DEBUG_REPERTOIRE_SCROLL", "true");
      localStorage.setItem("TT_DEBUG_PRACTICE_SCROLL", "true");
      localStorage.setItem("TT_DEBUG_CATALOG_SCROLL", "true");
    } catch {}
  });
};

// Scroll utility: find the scroll container for a grid table by test id
async function getGridContainer(
  page: import("@playwright/test").Page,
  gridTestId: string
) {
  const table = page.getByTestId(gridTestId);
  await expect(table).toBeVisible({ timeout: 15000 });
  const handle = await table.elementHandle();
  if (!handle) throw new Error(`Table ${gridTestId} not found`);
  const container = await handle.evaluateHandle(
    (el) => el.parentElement as HTMLElement
  );
  return container;
}

async function scrollTo(
  _page: import("@playwright/test").Page,
  containerHandle: any,
  top: number
) {
  await containerHandle.evaluate((el: Element, y: number) => {
    (el as HTMLElement).scrollTop = y;
  }, top);
}

async function getScrollTop(
  _page: import("@playwright/test").Page,
  containerHandle: any
) {
  return containerHandle.evaluate(
    (el: Element) => (el as HTMLElement).scrollTop as number
  );
}

// Click a column header by its data-testid ch-*
async function clickHeader(page: import("@playwright/test").Page, id: string) {
  await page.getByTestId(`ch-${id}`).click();
}

// Navigate via page object to ensure robust waits
async function gotoTab(
  app: TuneTreesPage,
  tab: "practice" | "repertoire" | "catalog"
) {
  await app.navigateToTab(tab);
}

// Collect page console logs
function captureConsole(page: import("@playwright/test").Page) {
  const logs: string[] = [];
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    logs.push(`[${type}] ${text}`);
  });
  return logs;
}

// Main test: attempt to provoke scroll resets and capture traces
// Seeds data and logs in via the shared Playwright fixture so grids mount and are scrollable

test.describe("Scroll Reset Debugger", () => {
  let addedTuneIds: string[] = [];
  let currentTestUser: TestUser;
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, testUser }) => {
    currentTestUser = testUser;

    // Ensure there is ample content to scroll: add ~30 tunes to the user's playlist
    addedTuneIds = await addScrollTestTunes(testUser);

    // Bring the app to a known state and land on Practice (ensures grids mount + auth is ready)
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: addedTuneIds,
      startTab: "practice",
    });

    ttPage = new TuneTreesPage(page);
  });

  // Add tunes to playlist temporarily for scroll testing
  async function addScrollTestTunes(user: TestUser): Promise<string[]> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
    });
    if (authError) throw new Error(`Auth failed: ${authError.message}`);

    // Pull a batch of tunes from catalog (UUIDs)
    const { data: tunes, error: tunesError } = await supabase
      .from("tune")
      .select("id")
      .limit(30);
    if (tunesError || !tunes)
      throw new Error(`Failed to fetch tunes: ${tunesError?.message}`);

    // Upsert them into the user's playlist (using UUID strings)
    const playlistTuneInserts = tunes.map((tune) => ({
      playlist_ref: user.repertoireId, // UUID string
      tune_ref: tune.id, // UUID string
      current: null,
    }));
    const { error } = await supabase
      .from("playlist_tune")
      .upsert(playlistTuneInserts, { onConflict: "playlist_ref,tune_ref" });
    if (error) throw new Error(`Failed to add tunes: ${error.message}`);

    return tunes.map((t) => t.id); // Return UUID strings
  }

  // Remove test tunes so we don't pollute subsequent runs
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
        .eq("playlist_ref", user.repertoireId)
        .in("tune_ref", tuneIds);
      if (error)
        throw new Error(`Failed to remove test tunes: ${error.message}`);
    }
  }

  test.afterEach(async () => {
    try {
      await removeScrollTestTunes(addedTuneIds, currentTestUser);
    } catch (e) {
      console.warn("Scroll debug cleanup failed:", e);
    }
  });

  test.skip("trace scroll resets across tabs and actions", async ({ page }) => {
    // Force a desktop-like viewport to ensure tab buttons are visible
    await page.setViewportSize({ width: 1366, height: 900 });
    await setDebugFlags(page);

    // Capture console
    const logs = captureConsole(page);

    // Go to app
    await ttPage.goto(`${BASE_URL}`);
    // Prime routes to encourage grids to mount even in odd initial states
    try {
      await page.goto(`${BASE_URL}/repertoire`);
      await page.waitForTimeout(800);
    } catch {}
    try {
      await page.goto(`${BASE_URL}/catalog`);
      await page.waitForTimeout(800);
    } catch {}
    try {
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForTimeout(800);
    } catch {}
    // Don't hard-require the user menu; instead, wait for any tab or grid to be visible
    const anyUiVisible = await Promise.race([
      page
        .getByTestId("tab-repertoire")
        .isVisible({ timeout: 3000 })
        .catch(() => false),
      page
        .getByTestId("tab-catalog")
        .isVisible({ timeout: 3000 })
        .catch(() => false),
      page
        .getByTestId("tab-practice")
        .isVisible({ timeout: 3000 })
        .catch(() => false),
      page
        .getByTestId("tunes-grid-repertoire")
        .isVisible({ timeout: 3000 })
        .catch(() => false),
      page
        .getByTestId("tunes-grid-catalog")
        .isVisible({ timeout: 3000 })
        .catch(() => false),
      page
        .getByTestId("tunes-grid-scheduled")
        .isVisible({ timeout: 3000 })
        .catch(() => false),
    ]);
    if (!anyUiVisible) {
      // As a last resort, try navigating directly to repertoire route
      await page.goto(`${BASE_URL}/repertoire`);
      await page.waitForTimeout(1000);
    }

    // Dynamically detect which grids are present (robust to layout differences)
    type TabId = "practice" | "repertoire" | "catalog";
    const candidates: Array<{
      tab: TabId;
      grid: string;
      headerToSort: string;
    }> = [
      // Prefer Catalog first (tall grid ensures non-zero scroll for assertions)
      { tab: "catalog", grid: "tunes-grid-catalog", headerToSort: "title" },
      {
        tab: "repertoire",
        grid: "tunes-grid-repertoire",
        headerToSort: "title",
      },
      { tab: "practice", grid: "tunes-grid-scheduled", headerToSort: "title" },
    ];
    const present: Array<{ tab: TabId; grid: string; headerToSort: string }> =
      [];
    for (const c of candidates) {
      const visible = await page
        .getByTestId(c.grid)
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (visible) present.push(c);
    }

    const flows = present.length > 0 ? present : candidates;

    let didAnyScroll = false;
    const attempts: string[] = [];
    for (const flow of flows) {
      await test.step(`Tab: ${flow.tab}`, async () => {
        // Try to navigate to the tab if the tab control exists; otherwise assume current
        const hasTab = await page
          .getByTestId(`tab-${flow.tab}`)
          .isVisible({ timeout: 500 })
          .catch(() => false);
        if (hasTab) {
          try {
            await gotoTab(ttPage, flow.tab);
          } catch {
            // Fallback to route-based nav if tab button not interactable in this viewport/layout
            await page.goto(`${BASE_URL}/${flow.tab}`);
            await page.waitForTimeout(500);
          }
        } else {
          // No visible tab button; try route-based nav directly
          await page.goto(`${BASE_URL}/${flow.tab}`);
          await page.waitForTimeout(500);
        }
        // If the expected grid/table isn't visible, skip this flow
        // Ensure grid is visible or attached, with a generous timeout
        const gridLocator = page.getByTestId(flow.grid);
        const gridVisible = await gridLocator
          .isVisible({ timeout: 20000 })
          .catch(async () => {
            try {
              await page.waitForSelector(`[data-testid='${flow.grid}']`, {
                state: "attached",
                timeout: 20000,
              });
              return await gridLocator
                .isVisible({ timeout: 1000 })
                .catch(() => false);
            } catch {
              return false;
            }
          });
        if (!gridVisible) {
          console.log(`[DEBUG] skipping ${flow.tab}: grid not visible`);
          attempts.push(`${flow.tab}: grid not visible`);
          return;
        }

        // Locate container and scroll
        const container = await getGridContainer(page, flow.grid);
        await scrollTo(page, container, 1000);
        didAnyScroll = true;
        const s1 = await getScrollTop(page, container);
        console.log(
          `[DEBUG] after initial scroll: ${flow.tab} scrollTop=${s1}`
        );
        attempts.push(`${flow.tab}: scrolled to ${s1}`);

        // Strong assertion for Catalog: must actually scroll
        if (flow.tab === "catalog") {
          if (s1 < 900) {
            await page.screenshot({
              path: `test-results/scroll-debug-catalog-initial-${Date.now()}.png`,
            });
            const stored = await page.evaluate(
              (uid) => localStorage.getItem(`TT_CATALOG_SCROLL_${uid}`),
              currentTestUser.userId
            );
            throw new Error(
              `Catalog failed to scroll to >=900 (got ${s1}). stored=${stored}. Attempts=\n${attempts.join("\n")}`
            );
          }
        }

        // Sort by header twice (asc/desc) which often triggers virtualization/layout
        await clickHeader(page, flow.headerToSort);
        await page.waitForTimeout(250);
        const s2 = await getScrollTop(page, container);
        console.log(`[DEBUG] after sort 1: ${flow.tab} scrollTop=${s2}`);

        await clickHeader(page, flow.headerToSort);
        await page.waitForTimeout(250);
        const s3 = await getScrollTop(page, container);
        console.log(`[DEBUG] after sort 2: ${flow.tab} scrollTop=${s3}`);

        // Switch away and back to this tab to emulate common user flows
        // Go to catalog then back (or repertoire then back)
        const bounceTab: TabId =
          flow.tab === "catalog" ? "repertoire" : "catalog";
        const bounceExists = await page
          .getByTestId(`tab-${bounceTab}`)
          .isVisible({ timeout: 500 })
          .catch(() => false);
        if (hasTab && bounceExists) {
          await gotoTab(ttPage, bounceTab);
          await page.waitForTimeout(100);
          await gotoTab(ttPage, flow.tab);
        }
        await page.waitForTimeout(250);
        const s4 = await getScrollTop(page, container);
        console.log(`[DEBUG] after tab bounce: ${flow.tab} scrollTop=${s4}`);

        // Strong assertion for Catalog: should not regress to zero after interactions
        if (flow.tab === "catalog") {
          if (s4 < 800) {
            const stored = await page.evaluate(
              (uid) => localStorage.getItem(`TT_CATALOG_SCROLL_${uid}`),
              currentTestUser.userId
            );
            await page.screenshot({
              path: `test-results/scroll-debug-catalog-regressed-${Date.now()}.png`,
            });
            throw new Error(
              `Catalog scroll regressed (<800) after interactions (got ${s4}). stored=${stored}. Attempts=\n${attempts.join(
                "\n"
              )}`
            );
          }
        }
      });
    }

    // Dump captured console lines related to scroll
    const interesting = logs.filter(
      (l) =>
        l.includes("SCROLL:") ||
        l.includes("[REPERTOIRE_SCROLL]") ||
        l.includes("[PRACTICE_SCROLL]") ||
        l.includes("[CATALOG_SCROLL]") ||
        l.includes("scrollTo invoked") ||
        l.includes("scroll event: scrollTop")
    );

    console.log(
      `\n===== Scroll Debug Console Snippets =====\n${interesting.join("\n")}`
    );

    // If we couldn't interact with any grid, fail loudly with diagnostics
    if (!didAnyScroll) {
      await page.screenshot({
        path: `test-results/scroll-debug-no-grids-${Date.now()}.png`,
      });
      throw new Error(
        `No grids became visible within timeouts. Attempts: \n${attempts.join("\n")}`
      );
    }

    // If we did interact, we expect grid instrumentation to have logged at least one apply line
    expect(interesting.join("\n")).toContain("applied scrollTop=");
  });
});
