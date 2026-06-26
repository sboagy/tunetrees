#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const DEFAULT_BUCKET = "tunetrees-rhythm-assets";
const DEFAULT_SAMPLE_PATH =
  "audio/kits/bodhran/65818__bosone__bodhran-border01.mp3";
const DEFAULT_ORIGINS = [
  "https://staging.tunetrees.com",
  "https://tunetrees.com",
];
const VERIFY_ATTEMPTS = 6;
const VERIFY_RETRY_DELAY_MS = 10_000;

function env(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function parseOrigins() {
  const raw = env("RHYTHM_ASSETS_CORS_ORIGINS", DEFAULT_ORIGINS.join(","));
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error(
      `RHYTHM_ASSETS_CORS_ORIGINS produced no valid origins from input: ${JSON.stringify(raw)}`
    );
  }

  return origins;
}

function normalizeBaseUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("VITE_R2_AUDIO_BASE_URL is not set or is empty");
  }
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch (cause) {
    throw new Error(
      `VITE_R2_AUDIO_BASE_URL is not a valid URL: ${withScheme}`,
      { cause }
    );
  }
}

function buildCorsConfig(origins) {
  return {
    rules: [
      {
        allowed: {
          origins,
          methods: ["GET", "HEAD"],
          headers: ["*"],
        },
        exposeHeaders: ["ETag", "Content-Length", "Content-Type"],
        maxAgeSeconds: 86400,
      },
    ],
  };
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`${command} ${args.join(" ")} failed with exit code ${code}`)
      );
    });
  });
}

async function applyCors(bucket, origins) {
  const workDir = await mkdtemp(join(tmpdir(), "tunetrees-r2-cors-"));
  const corsPath = join(workDir, "rhythm-assets-cors.json");

  try {
    await writeFile(
      corsPath,
      `${JSON.stringify(buildCorsConfig(origins), null, 2)}\n`
    );
    await run("npx", [
      "wrangler",
      "r2",
      "bucket",
      "cors",
      "set",
      bucket,
      "--file",
      corsPath,
      "--force",
    ]);
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSampleUrl(baseUrl, samplePath, origin) {
  const sampleUrl = new URL(`${baseUrl}/${samplePath.replace(/^\/+/, "")}`);
  sampleUrl.searchParams.set("cors-check", `${Date.now()}-${origin}`);
  return sampleUrl;
}

async function verifyCors(baseUrl, origins, samplePath) {
  for (const origin of origins) {
    const sampleUrl = buildSampleUrl(baseUrl, samplePath, origin);
    const response = await fetch(sampleUrl, {
      headers: {
        "Cache-Control": "no-cache",
        Origin: origin,
        Range: "bytes=0-0",
      },
    });
    if (![200, 206].includes(response.status)) {
      throw new Error(
        `Rhythm asset sample request failed for ${origin}: ${response.status} ${response.statusText} (${sampleUrl.toString()})`
      );
    }

    const allowOrigin = response.headers.get("access-control-allow-origin");
    if (allowOrigin !== "*" && allowOrigin !== origin) {
      throw new Error(
        `Rhythm asset CORS is not configured for ${origin}. Expected Access-Control-Allow-Origin to be "${origin}" or "*", got ${allowOrigin ?? "<missing>"}. Run npm run r2:rhythm-assets:cors:apply.`
      );
    }
  }
}

async function verifyCorsWithRetry(baseUrl, origins, samplePath) {
  let lastError;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      await verifyCors(baseUrl, origins, samplePath);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === VERIFY_ATTEMPTS) {
        break;
      }
      console.warn(
        `Rhythm asset CORS verification attempt ${attempt}/${VERIFY_ATTEMPTS} failed; retrying in ${VERIFY_RETRY_DELAY_MS / 1000}s.`
      );
      await delay(VERIFY_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const shouldCheck = shouldApply || process.argv.includes("--check");
  if (!shouldApply && !shouldCheck) {
    throw new Error(
      "Usage: node scripts/ensure-rhythm-assets-cors.mjs --check|--apply"
    );
  }

  const bucket = env("RHYTHM_ASSETS_BUCKET", DEFAULT_BUCKET);
  const origins = parseOrigins();
  const baseUrl = normalizeBaseUrl(env("VITE_R2_AUDIO_BASE_URL", ""));
  const samplePath = env("RHYTHM_ASSETS_CORS_SAMPLE_PATH", DEFAULT_SAMPLE_PATH);

  if (shouldApply) {
    await applyCors(bucket, origins);
  }

  await verifyCorsWithRetry(baseUrl, origins, samplePath);
  console.log(
    `Rhythm asset CORS ${shouldApply ? "applied and " : ""}verified for ${origins.join(", ")}.`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
