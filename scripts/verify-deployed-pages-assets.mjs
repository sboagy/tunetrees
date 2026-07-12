#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const baseUrlInput = process.argv[2] ?? process.env.DEPLOYED_PAGES_URL;

if (!baseUrlInput) {
  console.error(
    "Usage: node scripts/verify-deployed-pages-assets.mjs <public-pages-url>"
  );
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(baseUrlInput);
} catch {
  console.error(`Invalid public Pages URL: ${baseUrlInput}`);
  process.exit(1);
}

const assetsDirectory = path.join(process.cwd(), "dist", "assets");
const contentTypePatterns = {
  ".css": /text\/css/i,
  ".js": /(?:text|application)\/(?:javascript|ecmascript)/i,
  ".wasm": /application\/wasm/i,
};

let assetNames;
try {
  assetNames = await fs.readdir(assetsDirectory);
} catch {
  console.error(
    "Deployed Pages asset verification failed: dist/assets does not exist; run the build first."
  );
  process.exit(1);
}

const assetsToVerify = assetNames.filter((assetName) =>
  Object.hasOwn(contentTypePatterns, path.extname(assetName))
);

if (assetsToVerify.length === 0) {
  console.error(
    "Deployed Pages asset verification failed: no JavaScript, CSS, or WASM assets were found."
  );
  process.exit(1);
}

const FETCH_TIMEOUT_MS = 15_000;
const failures = [];
for (const assetName of assetsToVerify) {
  const assetUrl = new URL(`/assets/${assetName}`, baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(assetUrl, {
      headers: { Accept: "*/*", "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    await response.body?.cancel();

    const expectedContentType = contentTypePatterns[path.extname(assetName)];
    const contentType = response.headers.get("content-type") ?? "(missing)";
    if (!response.ok || !expectedContentType.test(contentType)) {
      failures.push(
        `${assetUrl.pathname}: ${response.status} ${contentType} (expected ${expectedContentType})`
      );
    }
  } catch (error) {
    clearTimeout(timer);
    const message =
      error.name === "AbortError"
        ? `timeout after ${FETCH_TIMEOUT_MS}ms`
        : error.message || String(error);
    failures.push(`${assetUrl.pathname}: ${message}`);
  }
}

if (failures.length > 0) {
  console.error("Deployed Pages asset verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Deployed Pages asset verification passed for ${baseUrl.origin} (${assetsToVerify.length} assets).`
);
