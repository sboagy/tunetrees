#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "db:staging:schema:push"]);
run("npm", ["run", "worker:deploy:staging"]);
run("npm", ["run", "build:staging"]);
run("op", [
  "run",
  "--env-file=.env.staging.template",
  "--",
  "npx",
  "wrangler",
  "pages",
  "deploy",
  "dist",
  "--project-name=tunetrees-pwa",
  "--branch=staging",
]);
