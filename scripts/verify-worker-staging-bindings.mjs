#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import process from "node:process";

const ROOT_CONFIG_PATH = "worker/wrangler.toml";
const WORKER_CONFIG_PATH = "wrangler.toml";
const PRODUCTION_BUCKET = "tunetrees-vault";
const STAGING_BUCKET = "tunetrees-vault-staging";
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
  const stagingR2 = section(content, /^\[\[env\.staging\.r2_buckets\]\]/m);
  const stagingHyperdrive = section(
    content,
    /^\[\[env\.staging\.hyperdrive\]\]/m
  );

  if (!stagingSection) {
    throw new Error("worker/wrangler.toml is missing [env.staging].");
  }
  if (!stagingR2.includes(`bucket_name = "${STAGING_BUCKET}"`)) {
    throw new Error(
      `worker/wrangler.toml must bind env.staging TUNETREES_VAULT to ${STAGING_BUCKET}.`
    );
  }
  if (stagingR2.includes(`bucket_name = "${PRODUCTION_BUCKET}"`)) {
    throw new Error(
      "env.staging R2 binding points at the production vault bucket."
    );
  }
  if (!/id = "[^"]+"/.test(stagingHyperdrive)) {
    throw new Error("env.staging Hyperdrive binding is missing an ID.");
  }
  if (stagingHyperdrive.includes(PRODUCTION_HYPERDRIVE_ID)) {
    throw new Error("env.staging Hyperdrive binding uses the production ID.");
  }

  console.log("Staging Worker binding preflight passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
