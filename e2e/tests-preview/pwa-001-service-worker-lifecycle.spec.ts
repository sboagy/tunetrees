/**
 * PWA-001: Generated service-worker lifecycle (P0).
 * Verify precaching and offline reload across an update with existing tabs.
 * Requires a local preview build in dist; serves it on an isolated origin.
 */
import { readdir, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, relative, resolve, sep } from "node:path";
import { expect, test } from "@playwright/test";

let server: Server;
let origin: string;
let revision = 1;

test.beforeAll(async () => {
  const buildRoot = resolve(import.meta.dirname, "../../dist");
  const contentTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".wasm": "application/wasm",
    ".sql": "text/plain",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  const assets = new Map<string, { body: Buffer; contentType: string }>();
  // Preload only build files. Incoming URLs select an existing map entry;
  // they never become filesystem paths or outgoing network requests.
  for (const entry of await readdir(buildRoot, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue;
    const file = resolve(entry.parentPath, entry.name);
    const pathname = `/${relative(buildRoot, file).split(sep).join("/")}`;
    assets.set(pathname, {
      body: await readFile(file),
      contentType: contentTypes[extname(file)] ?? "application/octet-stream",
    });
  }
  if (!assets.has("/index.html") || !assets.has("/sw.js")) {
    throw new Error("Run npm run build:preview-local before this test");
  }

  // Give this test its own origin and a controllable SW response without
  // changing dist or the user's running preview server.
  server = createServer((request, response) => {
    let pathname: string;
    try {
      pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    } catch {
      response.writeHead(400).end();
      return;
    }
    // The signed-out app navigates to /login; both routes use the app shell.
    const asset = assets.get(
      pathname === "/" || pathname === "/login" ? "/index.html" : pathname
    );
    if (!asset) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": asset.contentType,
      "Cache-Control": "no-store",
    });
    response.end(
      pathname === "/sw.js"
        ? Buffer.concat([
            asset.body,
            Buffer.from(`\n// lifecycle revision ${revision}\n`),
          ])
        : asset.body
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP test server");
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
