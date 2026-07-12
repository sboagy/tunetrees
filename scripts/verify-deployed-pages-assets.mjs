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
const MAX_ATTEMPTS = 8;
const RETRY_DELAY_MS = 5_000;
const failures = new Map();
let remainingAssets = assetsToVerify;

for (
  let attempt = 1;
  attempt <= MAX_ATTEMPTS && remainingAssets.length;
  attempt++
) {
  failures.clear();

  for (const assetName of remainingAssets) {
    const assetUrl = new URL(`/assets/${assetName}`, baseUrl);
    // A Pages custom hostname can briefly route to the previous deployment.
    // Cache-busting prevents that deployment's SPA fallback from being cached
    // as an immutable response for a newly emitted hashed asset.
    assetUrl.searchParams.set(
      "deployed-asset-verification",
      `${Date.now()}-${attempt}`
    );
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
        failures.set(
          assetName,
          `${assetUrl.pathname}: ${response.status} ${contentType} (expected ${expectedContentType})`
        );
      }
    } catch (error) {
      clearTimeout(timer);
      const message =
        error.name === "AbortError"
          ? `timeout after ${FETCH_TIMEOUT_MS}ms`
          : error.message || String(error);
      failures.set(assetName, `${assetUrl.pathname}: ${message}`);
    }
  }

  remainingAssets = [...failures.keys()];
  if (remainingAssets.length && attempt < MAX_ATTEMPTS) {
    console.log(
      `Waiting ${RETRY_DELAY_MS / 1_000}s for ${remainingAssets.length} asset(s) to reach ${baseUrl.origin} (attempt ${attempt}/${MAX_ATTEMPTS}).`
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}

if (failures.size > 0) {
  console.error("Deployed Pages asset verification failed:");
  for (const failure of failures.values()) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Deployed Pages asset verification passed for ${baseUrl.origin} (${assetsToVerify.length} assets).`
);
