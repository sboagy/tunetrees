#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import process from "node:process";

const ROOT_CONFIG_PATH = "worker/wrangler.toml";
const WORKER_CONFIG_PATH = "wrangler.toml";
const PRODUCTION_BUCKET = "tunetrees-vault";
const STAGING_BUCKET = "tunetrees-vault-staging";
const STAGING_WRITE_BINDING = "TUNETREES_VAULT";
const PRODUCTION_READ_BINDING = "TUNETREES_PRODUCTION_VAULT";
const PRODUCTION_HYPERDRIVE_ID = "541252cc94ca43cf83aa01ec4936726f";
const PRODUCTION_SUPABASE_URL = "https://pjxuonglsvouttihjven.supabase.co";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function section(content, startPattern) {
  const start = content.search(startPattern);
  if (start < 0) {
    return "";
  }

  const afterHeader = content.indexOf("\n", start);
  if (afterHeader < 0) {
    return content.slice(start);
  }

  const next = content.slice(afterHeader + 1).search(/^\[/m);
  return next < 0
    ? content.slice(start)
    : content.slice(start, afterHeader + 1 + next);
}

/** Return every TOML [[section]] block matching startPattern. */
function findAllSections(content, startPattern) {
  const blocks = [];
  const pattern =
    typeof startPattern === "string"
      ? startPattern.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
      : startPattern.source;
  const re = new RegExp(pattern, "gm");
  let match = re.exec(content);
  while (match !== null) {
    const start = match.index;
    const afterHeader = content.indexOf("\n", start);
    const searchFrom = afterHeader < 0 ? start : afterHeader + 1;
    const next = content.slice(searchFrom).search(/^\[/m);
    const end = next < 0 ? content.length : searchFrom + next;
    blocks.push(content.slice(start, end));
    match = re.exec(content);
  }
  return blocks;
}

async function main() {
  const stagingSupabaseUrl = requireEnv("SUPABASE_URL");
  if (stagingSupabaseUrl === PRODUCTION_SUPABASE_URL) {
    throw new Error("Staging SUPABASE_URL resolves to the production project.");
  }

  const configPath = await access(ROOT_CONFIG_PATH)
    .then(() => ROOT_CONFIG_PATH)
    .catch(() => WORKER_CONFIG_PATH);
  const content = await readFile(configPath, "utf8");
  const stagingSection = section(content, /^\[env\.staging\]/m);
  const stagingR2Blocks = findAllSections(
    content,
    /^\[\[env\.staging\.r2_buckets\]\]/m
  );
  const stagingHyperdrive = section(
    content,
    /^\[\[env\.staging\.hyperdrive\]\]/m
  );

  if (!stagingSection) {
    throw new Error("worker/wrangler.toml is missing [env.staging].");
  }
  if (stagingR2Blocks.length === 0) {
    throw new Error(
      "worker/wrangler.toml is missing [[env.staging.r2_buckets]]."
    );
  }
  const expectedR2Bindings = new Map([
    [STAGING_WRITE_BINDING, STAGING_BUCKET],
    [PRODUCTION_READ_BINDING, PRODUCTION_BUCKET],
  ]);
  const foundR2Bindings = new Set();
  for (const block of stagingR2Blocks) {
    const binding = /^binding\s*=\s*"([^"]+)"/m.exec(block)?.[1];
    const bucketName = /^bucket_name\s*=\s*"([^"]+)"/m.exec(block)?.[1];
    if (!binding || !bucketName) {
      throw new Error(
        'env.staging R2 binding must declare both `binding = "..."` and `bucket_name = "..."`.'
      );
    }

    if (foundR2Bindings.has(binding)) {
      throw new Error(
        `Duplicate env.staging R2 binding: ${binding} is declared more than once.`
      );
    }
    const expectedBucket = expectedR2Bindings.get(binding);
    if (!expectedBucket || bucketName !== expectedBucket) {
      throw new Error(
        `Unexpected env.staging R2 binding ${binding} -> ${bucketName}.`
      );
    }
    foundR2Bindings.add(binding);
  }
  for (const binding of expectedR2Bindings.keys()) {
    if (!foundR2Bindings.has(binding)) {
      throw new Error(
        `env.staging is missing the required R2 binding: ${binding}.`
      );
    }
  }
  if (!/id = "[^"]+"/.test(stagingHyperdrive)) {
    throw new Error("env.staging Hyperdrive binding is missing an ID.");
  }
  if (stagingHyperdrive.includes(PRODUCTION_HYPERDRIVE_ID)) {
    throw new Error("env.staging Hyperdrive binding uses the production ID.");
  }

  console.log("Staging Worker binding preflight passed.");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
