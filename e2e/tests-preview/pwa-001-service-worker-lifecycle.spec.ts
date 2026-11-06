/**
 * PWA-001: Generated service-worker lifecycle (P0).
 * Verify precaching and offline reload across an update with existing tabs.
 * Requires the local preview build/server, like the other preview tests.
 */
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

let server: Server;
let origin: string;
let revision = 1;

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("The preview baseURL is required");

  // Give this test its own origin and a controllable SW response. Forward the
  // real preview assets without changing dist or the user's running preview.
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", baseURL);
      const upstream = await fetch(url);
      const body = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") ?? "text/plain",
        "Cache-Control": "no-store",
      });
      response.end(
        url.pathname === "/sw.js"
          ? Buffer.concat([
              body,
              Buffer.from(`\n// lifecycle revision ${revision}\n`),
            ])
          : body
      );
    } catch {
      response.writeHead(502);
      response.end("Preview server unavailable");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP preview proxy");
  }
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
});

test("keeps cached assets and existing tabs usable after a service-worker update", async ({
  page,
  context,
}) => {
  await page.goto(origin);
  // Installation includes WASM and SQL, so wait for control rather than a
  // fixed delay before testing the offline shell.
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 30_000,
    })
    .toBe(true);

  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const entries = await Promise.all(
      names.map(async (name) => (await caches.open(name)).keys())
    );
    return entries.flat().map((request) => {
      // Workbox's revision suffix identifies stored entries, not public asset
      // URLs. Fetch the same unversioned URL that SQLite initialization uses.
      const url = new URL(request.url);
      url.searchParams.delete("__WB_REVISION__");
      return url.href;
    });
  });
  expect(
    cachedUrls.some((url) => new URL(url).pathname.endsWith(".wasm"))
  ).toBe(true);
  expect(cachedUrls.some((url) => new URL(url).pathname.endsWith(".sql"))).toBe(
    true
  );

  const secondTab = await context.newPage();
  await secondTab.goto(origin);
  await expect
    .poll(
      () => secondTab.evaluate(() => !!navigator.serviceWorker.controller),
      {
        timeout: 30_000,
      }
    )
    .toBe(true);

  // A byte change makes the browser install a new worker while retaining the
  // actual generated caching/activation code and leaving both old clients open.
  revision = 2;
  const observeUpdate = () =>
    new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => resolve(),
        {
          once: true,
        }
      );
    });
  const firstUpdate = page.evaluate(observeUpdate);
  const secondUpdate = secondTab.evaluate(observeUpdate);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await Promise.all([firstUpdate, secondUpdate]);

  await context.setOffline(true);
  for (const tab of [page, secondTab]) {
    const response = await tab.reload();
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(tab.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    const assets = await tab.evaluate(
      async (urls) => {
        const results = await Promise.all(urls.map((url) => fetch(url)));
        return results.map((result) => result.ok);
      },
      cachedUrls.filter((url) => /\.(wasm|sql)$/.test(new URL(url).pathname))
    );
    expect(assets.every(Boolean)).toBe(true);
  }
});
