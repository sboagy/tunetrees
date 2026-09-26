import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { resolveExecutable } from "./resolve-executable.mjs";

const [template, mode] = process.argv.slice(2);
if (!process.env.GITHUB_ENV || !template) {
  throw new Error("Usage in GitHub Actions: bootstrap-ci-env.mjs <template>");
}
const environment = resolve(template);
const values = parse(readFileSync(environment));

function exportValue(key, value, secret = false) {
  if (value === undefined || value === "" || value.startsWith("op://")) {
    throw new Error(`Missing resolved CI value: ${key}`);
  }
  if (secret) {
    const escaped = value
      .replaceAll("%", "%25")
      .replaceAll("\r", "%0D")
      .replaceAll("\n", "%0A");
    console.log(`::add-mask::${escaped}`);
  }
  const delimiter = randomUUID();
  appendFileSync(
    process.env.GITHUB_ENV,
    `${key}<<${delimiter}\n${value}\n${delimiter}\n`
  );
}

if (environment === resolve(".env.local.template")) {
  // Local Supabase supplies its own keys later. Only the shared password comes
  // from 1Password; OAuth and Gemini credentials aren't needed by local tests.
  const password = execFileSync(
    resolveExecutable("op", process.env.OP_EXECUTABLE),
    ["read", values.ALICE_TEST_PASSWORD],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }
  ).replace(/\r?\n$/, "");
  exportValue("ALICE_TEST_PASSWORD", password, true);
  exportValue("TEST_USER_PASSWORD", password);
  for (const [key, value] of Object.entries(values)) {
    if (!value.startsWith("op://") && value !== "") {
      exportValue(key, process.env[key] || value);
    }
  }
  exportValue("VITE_WORKER_URL", "http://localhost:8787");
} else if (mode === "--export") {
  // Export only template keys, never the service account token. op run handles
  // resolution once; later job steps and all descendants inherit these values.
  for (const [key, value] of Object.entries(values)) {
    exportValue(key, process.env[key], value.startsWith("op://"));
  }
} else {
  // GitHub must receive the actual add-mask commands from the exporter.
  // CLI output masking would replace their values before GitHub registers them.
  execFileSync(
    resolveExecutable("op", process.env.OP_EXECUTABLE),
    [
      "run",
      "--no-masking",
      `--env-file=${environment}`,
      "--",
      process.execPath,
      fileURLToPath(import.meta.url),
      environment,
      "--export",
    ],
    { stdio: "inherit" }
  );
  process.exit(0);
}
exportValue("TUNETREES_LOADED_ENV", environment);

// Prevent a future test helper or subprocess from silently restoring API calls.
// GitHub adds this directory to PATH for subsequent steps in this job only.
if (process.env.GITHUB_PATH) {
  const guardDir = mkdtempSync(
    join(process.env.RUNNER_TEMP || tmpdir(), "tunetrees-no-op-")
  );
  writeFileSync(
    join(guardDir, "op"),
    "#!/bin/sh\necho '1Password access is forbidden after CI bootstrap; use the inherited environment.' >&2\nexit 1\n",
    { mode: 0o700 }
  );
  appendFileSync(process.env.GITHUB_PATH, `${guardDir}\n`);
}
console.log(
  `CI environment ready: ${environment}; subsequent commands reuse it.`
);
