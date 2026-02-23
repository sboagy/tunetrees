#!/usr/bin/env node

import { execSync } from "node:child_process";

const ref = process.argv[2];

if (!ref) {
  console.error("Usage: npm run deps:oosync:update -- <tag-or-sha>");
  process.exit(1);
}

if (!/^[A-Za-z0-9._/-]+$/.test(ref)) {
  console.error(`Invalid ref: ${ref}`);
  process.exit(1);
}

const spec = `oosync@https://codeload.github.com/sboagy/oosync/tar.gz/${ref}`;

execSync(`npm install --save-exact "${spec}"`, { stdio: "inherit" });

console.log("\nUpdated oosync dependency.");
console.log("Run smoke checks:");
console.log("  npm run codegen:schema:check");
console.log("  npm run typecheck");
console.log(
  "  npm run test:unit -- tests/lib/sync/adapters.test.ts tests/lib/sync/table-meta.test.ts tests/lib/sync/casing.test.ts"
);
