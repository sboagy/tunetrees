#!/usr/bin/env node
/**
 * Sync tunetrees-vault R2 objects from production to staging for a specific
 * user ID.  Vault keys follow the pattern `users/{userId}/{mediaKind}/...`
 * (see worker/src/media.ts), so this script filters by `users/<userId>/`.
 *
 * Safety: --user-id is required.  Dry-run is the default; pass --apply to
 * actually copy.  The script refuses to run if source == target bucket.
 *
 * Usage:
 *   node scripts/sync-tunetrees-vault-r2.mjs --user-id <uuid>               # dry-run
 *   node scripts/sync-tunetrees-vault-r2.mjs --user-id <uuid> --apply       # copy
 *   node scripts/sync-tunetrees-vault-r2.mjs --user-id <uuid> --prefix users/uuid/notes/  # narrow
 *   node scripts/sync-tunetrees-vault-r2.mjs --user-id <uuid> --limit 10    # cap
 *
 * Env vars (same as rhythm-assets sync):
 *   CLOUDFLARE_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID  (or AWS_ACCESS_KEY_ID)
 *   R2_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY)
 *   TUNETREES_VAULT_SOURCE_BUCKET  (default: tunetrees-vault)
 *   TUNETREES_VAULT_TARGET_BUCKET  (default: tunetrees-vault-staging)
 */

import { createHash, createHmac } from "node:crypto";
import process from "node:process";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_SOURCE_BUCKET = "tunetrees-vault";
const DEFAULT_TARGET_BUCKET = "tunetrees-vault-staging";
const USER_ROOT_PREFIX = "users";
const SERVICE = "s3";
const REGION = "auto";
const EMPTY_HASH = hashHex("");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function env(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function hashHex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.codePointAt(0).toString(16).toUpperCase()}`
  );
}

function encodeKeyPath(key) {
  return key.split("/").map(rfc3986).join("/");
}

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function formatAmzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function credentialScope(dateStamp) {
  return `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
}

function signingKey(secretAccessKey, dateStamp) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, REGION);
  const serviceKey = hmac(regionKey, SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function canonicalQuery(searchParams) {
  return [...searchParams.entries()]
    .sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey)
    )
    .map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`)
    .join("&");
}

function canonicalHeaders(headers) {
  const entries = Object.entries(headers)
    .map(([key, value]) => [
      key.toLowerCase(),
      normalizeWhitespace(String(value)),
    ])
    .sort(([a], [b]) => a.localeCompare(b));
  const headerLines = entries.map(([key, value]) => `${key}:${value}`);
  return {
    canonical: `${headerLines.join("\n")}\n`,
    signed: entries.map(([key]) => key).join(";"),
  };
}

function signRequest({
  accessKeyId,
  secretAccessKey,
  method,
  url,
  headers = {},
}) {
  const amzDate = formatAmzDate();
  const dateStamp = amzDate.slice(0, 8);
  const signedHeadersInput = {
    ...headers,
    host: url.host,
    "x-amz-content-sha256": EMPTY_HASH,
    "x-amz-date": amzDate,
  };
  const { canonical, signed } = canonicalHeaders(signedHeadersInput);
  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery(url.searchParams),
    canonical,
    signed,
    EMPTY_HASH,
  ].join("\n");
  const scope = credentialScope(dateStamp);
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hashHex(canonicalRequest),
  ].join("\n");
  const signature = hmac(
    signingKey(secretAccessKey, dateStamp),
    stringToSign,
    "hex"
  );

  return {
    ...signedHeadersInput,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
  };
}

async function request(
  context,
  { method, bucket, key = "", query = {}, headers = {} }
) {
  const path = key ? `/${bucket}/${encodeKeyPath(key)}` : `/${bucket}`;
  const url = new URL(`${context.endpoint}${path}`);
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(name, String(value));
    }
  }
  const signedHeaders = signRequest({
    accessKeyId: context.accessKeyId,
    secretAccessKey: context.secretAccessKey,
    method,
    url,
    headers,
  });
  return fetch(url, { method, headers: signedHeaders });
}

function xmlText(block, tag) {
  const match = block.match(
    new RegExp(String.raw`<${tag}>([\s\S]*?)</${tag}>`)
  );
  return match ? decodeXml(match[1]) : "";
}

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

async function responseText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// R2 operations
// ---------------------------------------------------------------------------

async function listObjects(context, bucket) {
  const objects = [];
  let continuationToken;
  do {
    const response = await request(context, {
      method: "GET",
      bucket,
      query: {
        "list-type": "2",
        "max-keys": "1000",
        "continuation-token": continuationToken,
      },
    });
    const body = await responseText(response);
    if (!response.ok) {
      throw new Error(
        `ListObjectsV2 failed for ${bucket}: ${response.status} ${response.statusText}\n${body}`
      );
    }
    for (const match of body.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const content = match[1];
      objects.push({
        key: xmlText(content, "Key"),
        etag: xmlText(content, "ETag").replace(/^"|"$/g, ""),
        size: Number(xmlText(content, "Size")),
      });
    }
    const truncated = xmlText(body, "IsTruncated") === "true";
    continuationToken = truncated ? xmlText(body, "NextContinuationToken") : "";
  } while (continuationToken);
  return objects;
}

async function headObject(context, bucket, key) {
  const response = await request(context, { method: "HEAD", bucket, key });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `HeadObject failed for ${bucket}/${key}: ${response.status} ${response.statusText}`
    );
  }
  return {
    etag: response.headers.get("etag")?.replace(/^"|"$/g, "") ?? "",
    size: Number(response.headers.get("content-length") ?? "0"),
    contentType: response.headers.get("content-type") ?? "",
    cacheControl: response.headers.get("cache-control") ?? "",
  };
}

async function copyObject(context, sourceBucket, targetBucket, key) {
  const copySource = `/${sourceBucket}/${encodeKeyPath(key)}`;
  const response = await request(context, {
    method: "PUT",
    bucket: targetBucket,
    key,
    headers: {
      "x-amz-copy-source": copySource,
      "x-amz-metadata-directive": "COPY",
    },
  });
  const body = await responseText(response);
  if (!response.ok) {
    throw new Error(
      `CopyObject failed for ${sourceBucket}/${key} -> ${targetBucket}/${key}: ${response.status} ${response.statusText}\n${body}`
    );
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: false,
    userId: "",
    prefix: "",
    limit: 0,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--user-id") args.userId = argv[++index] ?? "";
    else if (arg === "--prefix") args.prefix = argv[++index] ?? "";
    else if (arg === "--limit") args.limit = Number(argv[++index] ?? "0");
    else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node scripts/sync-tunetrees-vault-r2.mjs --user-id <uuid> [--apply] [--prefix ...] [--limit N]",
          "",
          "  --user-id <uuid>   Required. Sync only objects under users/<uuid>/.",
          "  --apply            Actually copy objects (default is dry-run).",
          "  --dry-run          Explicit dry-run (the default).",
          "  --prefix <path>    Override the auto-prefix (advanced).",
          "  --limit N          Cap the number of objects to consider.",
        ].join("\n")
      );
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (!args.userId) {
    fail("Missing required --user-id.  Provide a Supabase auth user UUID.");
  }

  // Auto-derive prefix from userId unless explicitly overridden
  if (!args.prefix) {
    args.prefix = `${USER_ROOT_PREFIX}/${args.userId}/`;
  }

  if (args.apply && args.dryRun)
    fail("Use either --apply or --dry-run, not both.");
  return { ...args, dryRun: !args.apply };
}

// ---------------------------------------------------------------------------
// Context & buckets
// ---------------------------------------------------------------------------

function getContext() {
  const accountId = env("CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = env("R2_ACCESS_KEY_ID", env("AWS_ACCESS_KEY_ID"));
  const secretAccessKey = env(
    "R2_SECRET_ACCESS_KEY",
    env("AWS_SECRET_ACCESS_KEY")
  );
  if (!accountId) fail("Missing CLOUDFLARE_ACCOUNT_ID.");
  if (!accessKeyId) fail("Missing R2_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID.");
  if (!secretAccessKey)
    fail("Missing R2_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY.");
  return {
    accessKeyId,
    secretAccessKey,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

function getBuckets() {
  const sourceBucket = env(
    "TUNETREES_VAULT_SOURCE_BUCKET",
    DEFAULT_SOURCE_BUCKET
  );
  const targetBucket = env(
    "TUNETREES_VAULT_TARGET_BUCKET",
    DEFAULT_TARGET_BUCKET
  );
  if (sourceBucket === targetBucket) {
    fail(
      `Refusing to sync because source and target buckets match: ${sourceBucket}`
    );
  }
  return { sourceBucket, targetBucket };
}

// ---------------------------------------------------------------------------
// Diff logic
// ---------------------------------------------------------------------------

function objectNeedsCopy(sourceObject, sourceHead, targetHead) {
  if (!targetHead) return { needed: true, reason: "missing" };
  if (sourceObject.size !== targetHead.size)
    return { needed: true, reason: "size" };
  if (
    sourceObject.etag &&
    targetHead.etag &&
    sourceObject.etag !== targetHead.etag
  ) {
    return { needed: true, reason: "etag" };
  }
  if (sourceHead.contentType !== targetHead.contentType) {
    return { needed: true, reason: "content-type" };
  }
  if (sourceHead.cacheControl !== targetHead.cacheControl) {
    return { needed: true, reason: "cache-control" };
  }
  return { needed: false, reason: "unchanged" };
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

async function getSourceObjects(context, sourceBucket, args) {
  const listedObjects = await listObjects(context, sourceBucket);
  const sourceObjects = listedObjects
    .filter((object) => !args.prefix || object.key.startsWith(args.prefix))
    .slice(0, args.limit > 0 ? args.limit : undefined);
  return { listedObjects, sourceObjects };
}

async function getCopyDecision(
  context,
  sourceBucket,
  targetBucket,
  sourceObject
) {
  const sourceHead = await headObject(context, sourceBucket, sourceObject.key);
  if (!sourceHead) {
    throw new Error(
      `Source object disappeared while syncing: ${sourceObject.key}`
    );
  }
  const targetHead = await headObject(context, targetBucket, sourceObject.key);
  return objectNeedsCopy(sourceObject, sourceHead, targetHead);
}

async function syncObject(context, buckets, sourceObject, args) {
  const decision = await getCopyDecision(
    context,
    buckets.sourceBucket,
    buckets.targetBucket,
    sourceObject
  );
  if (!decision.needed) return "unchanged";
  if (args.dryRun) {
    console.log(`would copy (${decision.reason}): ${sourceObject.key}`);
    return "wouldCopy";
  }
  await copyObject(
    context,
    buckets.sourceBucket,
    buckets.targetBucket,
    sourceObject.key
  );
  console.log(`copied (${decision.reason}): ${sourceObject.key}`);
  return "copied";
}

function printSummary({ listedObjects, sourceObjects, counts, failures }) {
  console.log(
    `Summary: listed=${listedObjects.length} considered=${sourceObjects.length} unchanged=${counts.unchanged} wouldCopy=${counts.wouldCopy} copied=${counts.copied} failures=${failures.length}`
  );
}

function printFailures(failures) {
  if (failures.length > 0) {
    for (const failure of failures.slice(0, 20)) {
      console.error(`failed: ${failure.key}: ${failure.message}`);
    }
    if (failures.length > 20) {
      console.error(`...and ${failures.length - 20} more failures.`);
    }
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const buckets = getBuckets();
  const context = getContext();

  console.log(
    `${args.dryRun ? "Dry run" : "Apply"}: ${buckets.sourceBucket} -> ${buckets.targetBucket}`
  );
  console.log(`User ID: ${args.userId}  |  Prefix: ${args.prefix}`);

  const { listedObjects, sourceObjects } = await getSourceObjects(
    context,
    buckets.sourceBucket,
    args
  );

  if (sourceObjects.length === 0) {
    console.log(
      `No objects found in ${buckets.sourceBucket} matching prefix "${args.prefix}".`
    );
    process.exit(0);
  }

  const counts = { copied: 0, unchanged: 0, wouldCopy: 0 };
  const failures = [];

  for (const sourceObject of sourceObjects) {
    try {
      counts[await syncObject(context, buckets, sourceObject, args)] += 1;
    } catch (error) {
      failures.push({
        key: sourceObject.key,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  printSummary({ listedObjects, sourceObjects, counts, failures });
  printFailures(failures);
}

await main();
