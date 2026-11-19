/** Harness contract tests: intentionally test the guard itself with isolated, mocked HTTP. */
import { expect, type Page, test } from "@playwright/test";
import {
  expectSyncFailures,
  installSyncErrorGuard,
} from "../helpers/sync-error-guard";

import { test as guardedTest } from "../helpers/sync-test";

const origin = "http://sync-guard.test";
const endpoint = `${origin}/api/sync`;

async function completeSync(page: Page, version: number): Promise<void> {
  const event = page.waitForEvent("console", {
    predicate: (message) => message.text() === "[E2ESyncGuard] completed",
  });
  await page.evaluate((nextVersion) => {
    const marker = document.querySelector<HTMLElement>(
      "[data-sync-result-version]"
    );
    if (!marker) throw new Error("Missing sync marker");
    marker.dataset.syncSuccess = "true";
    marker.dataset.syncErrorCount = "0";
    marker.dataset.syncResultVersion = String(nextVersion);
  }, version);
  await event;
}

async function requestSync(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const response = await fetch("/api/sync", { method: "POST" });
    await response.text();
  });
}

test.beforeEach(async ({ page }) => {
  await page.route(origin, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<div data-sync-result-version="0" data-sync-success="" data-sync-error-count="0"></div>',
    })
  );
  await page.route(endpoint, (route) =>
    route.fulfill({ status: 502, body: "Bad Gateway" })
  );
});

test("fails an unrecovered 502 despite previously successful sync", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  await completeSync(page, 1);
  await requestSync(page);
  await expect(guard.finish()).rejects.toThrow("HTTP 502");
});

test("accepts a successful retry followed by completed sync", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 5000);
  await page.goto(origin);
  await requestSync(page);
  await page.route(endpoint, (route) =>
    route.fulfill({
      json: { changes: [], syncedAt: new Date().toISOString(), errors: [] },
    })
  );
  await requestSync(page);
  await completeSync(page, 1);
  await expect(guard.finish()).resolves.toBeUndefined();
});

test("allows only the declared failure phase", async ({ page, context }) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  const end = expectSyncFailures(context, "Deliberate 502 phase", [
    "/api/sync",
  ]);
  await requestSync(page);
  end();
  await requestSync(page);
  await expect(guard.finish()).rejects.toThrow("HTTP 502");
});

test("accepts intentional failures without demanding recovery", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  const end = expectSyncFailures(context, "Deliberate local-only phase", [
    "/api/sync",
  ]);
  await requestSync(page);
  end();
  await expect(guard.finish()).resolves.toBeUndefined();
});

test("does not exempt another endpoint during an expected failure phase", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  const end = expectSyncFailures(context, "Sync deliberately blocked", [
    "/api/sync",
  ]);
  await page.route(`${origin}/rest/v1/rpc/genres`, (route) =>
    route.fulfill({ status: 502 })
  );
  await page.evaluate(async () => {
    await fetch("/rest/v1/rpc/genres");
  });
  end();
  await expect(guard.finish()).rejects.toThrow("/rest/v1/rpc/genres");
});

test("does not treat HTTP 200 containing sync errors as recovery", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  await page.route(endpoint, (route) =>
    route.fulfill({ json: { errors: ["Write rejected"] } })
  );
  await requestSync(page);
  await expect(guard.finish()).rejects.toThrow("Write rejected");
});

test("does not suppress unrelated sync errors during an expected network failure", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  const end = expectSyncFailures(context, "Deliberate backend outage", [
    "/api/sync",
  ]);
  await requestSync(page);
  await page.evaluate(() =>
    console.error("[SyncService] upload failed: disk full")
  );
  end();
  await expect(guard.finish()).rejects.toThrow("disk full");
});

guardedTest(
  "installs the automatic guard for a declared local-only phase",
  async ({ page, context }) => {
    await page.goto(origin);
    const end = expectSyncFailures(context, "Intentional backend outage", [
      "/api/sync",
    ]);
    await requestSync(page);
    end();
  }
);

test("fails a reported application sync error even without an HTTP error", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  const reported = page.waitForEvent("console", {
    predicate: (message) => message.text().startsWith("[E2ESyncGuard] failed:"),
  });
  await page.evaluate(() => {
    const marker = document.querySelector<HTMLElement>(
      "[data-sync-result-version]"
    );
    if (!marker) throw new Error("Missing sync marker");
    marker.dataset.syncSuccess = "false";
    marker.dataset.syncErrorCount = "1";
    marker.dataset.syncErrorSummary = "Local apply failed";
    marker.dataset.syncResultVersion = "1";
  });
  await reported;
  await expect(guard.finish()).rejects.toThrow("Local apply failed");
});

test("keeps enforcement active until a pending request returns its 503", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await held;
    await route.fulfill({ status: 503 });
  });
  const requested = page.waitForRequest(endpoint);
  await page.evaluate(() => {
    fetch("/api/sync", { method: "POST" }).catch(() => {});
  });
  await requested;
  let finished = false;
  const verdict = guard.finish().then(
    () => {
      finished = true;
      return "passed";
    },
    (error: Error) => {
      finished = true;
      return error.message;
    }
  );
  // A browser round trip lets an erroneous immediate teardown resolve; the route stays held.
  await page.evaluate(() => document.readyState);
  expect(finished).toBe(false);
  release();
  await expect(verdict).resolves.toContain("HTTP 503");
});

test("permits teardown after a pending backend request succeeds", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 5000);
  await page.goto(origin);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await held;
    await route.fulfill({ json: { errors: [] } });
  });
  const requested = page.waitForRequest(endpoint);
  await page.evaluate(() => {
    fetch("/api/sync", { method: "POST" }).catch(() => {});
  });
  await requested;
  const finishing = guard.finish();
  release();
  await expect(finishing).resolves.toBeUndefined();
});

test("retains exception ownership when an in-flight request fails after its phase ends", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 5000);
  await page.goto(origin);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await held;
    await route.fulfill({ status: 504 });
  });
  const requested = page.waitForRequest(endpoint);
  const fetchDone = page.evaluate(async () => {
    await fetch("/api/sync", { method: "POST" });
  });
  await requested;
  const end = expectSyncFailures(
    context,
    "Interrupt an already active request",
    ["/api/sync"]
  );
  end();
  release();
  await fetchDone;
  // Exercise the old one-second heuristic: attribution must survive a delayed status log.
  await page.waitForTimeout(1100);
  await page.evaluate(() =>
    console.error("[SyncService] Sync failed: 504 Gateway Timeout")
  );
  await expect(guard.finish()).resolves.toBeUndefined();
});

test("does not accept an older UI completion when the service becomes idle", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  await requestSync(page);
  await page.route(endpoint, (route) =>
    route.fulfill({ json: { errors: [] } })
  );
  await requestSync(page);
  await page.evaluate(() => {
    Object.assign(window, { __ttSyncControl: { isSyncing: () => true } });
    const marker = document.querySelector<HTMLElement>(
      "[data-sync-result-version]"
    );
    if (!marker) throw new Error("Missing sync marker");
    marker.dataset.syncSuccess = "true";
    marker.dataset.syncErrorCount = "0";
    // An older UI refresh is not a transport completion.
    marker.dataset.syncVersion = "1";
  });
  await page.evaluate(() => {
    Object.assign(globalThis, { __ttSyncControl: { isSyncing: () => false } });
  });
  await expect(guard.finish()).rejects.toThrow("HTTP 502");
});

test("attributes an expected summary delivered after successful recovery", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  const end = expectSyncFailures(context, "Deliberate gateway outage", [
    "/api/sync",
  ]);
  await requestSync(page);
  end();
  await completeSync(page, 1);
  await page.evaluate(() =>
    console.error("[SyncService] Sync failed: 502 Bad Gateway")
  );
  await expect(guard.finish()).resolves.toBeUndefined();
});

test("attributes the exact pending-upload failure wrapper to an expected outage", async ({
  page,
  context,
}) => {
  const guard = await installSyncErrorGuard(context, 100);
  await page.goto(origin);
  const end = expectSyncFailures(context, "Deliberate gateway outage", [
    "/api/sync",
  ]);
  await requestSync(page);
  end();
  await page.evaluate(() =>
    console.error(
      "[SyncService] Initial syncDown failed: Error: Cannot syncDown while pending changes exist - upload failed. Local data preserved.\n    at SyncService.syncDown (http://sync-guard.test/service.js:1:1)"
    )
  );
  await expect(guard.finish()).resolves.toBeUndefined();
});
