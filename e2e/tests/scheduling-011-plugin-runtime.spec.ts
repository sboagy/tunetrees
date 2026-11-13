import { expect, type Page, test } from "@playwright/test";
import { DEFAULT_PLUGIN_SCRIPT } from "../../src/lib/plugins/scheduling-template";

/** SCHEDULING-011 (HIGH): real module-worker/VM transport, without auth or DB.
 * Uses the same browser API against dev and preview builds so emitted WASM and
 * worker URLs are covered too. Database behavior is covered by scheduling-012.
 */
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.PLUGIN_TEST_BASE_URL ?? "/");
  await page.waitForFunction(() => Boolean(window.__ttTestApi));
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__ttTestApi?.disposePluginWorker());
  expect(pageErrors.get(page)).toEqual([]);
});

test("delivers normal dedicated-worker messages", async ({ page }) => {
  const result = await page.evaluate(async () => {
    if (!window.__ttTestApi) throw new Error("Test API missing");
    return window.__ttTestApi.runPlugin({
      script: 'function parseImport() {return {title:"Worker reached"};}',
      functionName: "parseImport",
      payload: {},
    });
  });
  expect(result).toEqual({ title: "Worker reached" });
});

test("runs Fluency history through the real async bridge", async ({ page }) => {
  const result = await page.evaluate(async (script) => {
    if (!window.__ttTestApi) throw new Error("Test API missing");
    return window.__ttTestApi.runPlugin({
      script,
      functionName: "createScheduler",
      methodName: "processReview",
      payload: {
        input: {
          practiced: "2026-01-20T12:00:00Z",
          quality: 3,
          repertoireRef: "r",
          tuneRef: "t",
        },
        fallback: { interval: 21 },
      },
      bridge: { queryDb: async () => [{ quality: 3 }, { quality: 3 }] },
    });
  }, DEFAULT_PLUGIN_SCRIPT);
  expect(result).toMatchObject({
    interval: 4,
    scheduledDays: 4,
    nextDue: "2026-01-24T12:00:00.000Z",
  });
});

test("reports database rejection without waiting for the execution timeout", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    if (!window.__ttTestApi) throw new Error("Test API missing");
    try {
      await window.__ttTestApi.runPlugin({
        script:
          'async function parseImport() {await Promise.resolve(); return queryDb("history");}',
        functionName: "parseImport",
        payload: {},
        bridge: {
          queryDb: async () => {
            throw new Error("no such column: playlist_ref");
          },
        },
      });
      return "unexpected success";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  expect(result).toContain("no such column: playlist_ref");
});

test("imports fetched data through the worker", async ({ page }) => {
  await page.route("**/api/proxy?**", (route) =>
    route.fulfill({
      contentType: "text/csv",
      body: "title,type\nImported Jig,Jig",
    })
  );
  const result = await page.evaluate(async () => {
    if (!window.__ttTestApi) throw new Error("Test API missing");
    return window.__ttTestApi.runPlugin({
      script:
        'async function parseImport() {return parseCsv(await fetchUrl("https://example.test/tunes"))[0];}',
      functionName: "parseImport",
      payload: {},
    });
  });
  expect(result).toEqual({ title: "Imported Jig", type: "Jig" });
});

test("terminates a runaway worker and succeeds on the next invocation", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const api = window.__ttTestApi;
    if (!api) throw new Error("Test API missing");
    const normal = {
      script: "function parseImport() {return 8;}",
      functionName: "parseImport" as const,
      payload: {},
    };
    // Warm the VM first: the short test deadline measures runaway execution,
    // not WASM download/compilation, and never blocks the Playwright thread.
    await api.runPlugin(normal);
    let errorMessage = "";
    try {
      await api.runPlugin({
        ...normal,
        script: "function parseImport() {while(true) {}}",
        timeoutMs: 100,
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    return { errorMessage, recovered: await api.runPlugin(normal) };
  });
  expect(result).toEqual({
    errorMessage: "Plugin execution timed out (100 ms)",
    recovered: 8,
  });
});
