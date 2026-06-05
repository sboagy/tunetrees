#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, "dist");
const assetsDir = path.join(distDir, "assets");
const indexPath = path.join(distDir, "index.html");

function fail(message) {
  console.error(`SQLite WASM build verification failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  fail("dist directory does not exist; run the production build first");
}

if (!fs.existsSync(assetsDir)) {
  fail("dist/assets directory does not exist");
}

const assetFiles = fs.readdirSync(assetsDir);
const sqliteWasmFiles = assetFiles.filter(
  (fileName) => /^sqlite3-.*\.wasm$/.test(fileName)
);

if (sqliteWasmFiles.length === 0) {
  fail("expected a hashed dist/assets/sqlite3-*.wasm asset");
}

if (!fs.existsSync(indexPath)) {
  fail("dist/index.html does not exist");
}

const indexHtml = fs.readFileSync(indexPath, "utf8");
if (indexHtml.includes("/sql-wasm/")) {
  fail("dist/index.html still references /sql-wasm/");
}

for (const fileName of assetFiles.filter((entry) => entry.endsWith(".js"))) {
  const jsPath = path.join(assetsDir, fileName);
  const contents = fs.readFileSync(jsPath, "utf8");
  if (contents.includes("sql-wasm.wasm") || contents.includes("/sql-wasm/")) {
    fail(`${path.relative(repoRoot, jsPath)} references legacy sql-wasm assets`);
  }
}

console.log(
  `SQLite WASM build verification passed (${sqliteWasmFiles.join(", ")})`
);
