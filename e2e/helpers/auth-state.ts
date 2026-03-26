/**
 * e2e/helpers/auth-state.ts
 *
 * Helpers for reading and validating persisted Playwright auth state files.
 * Auth state files live in e2e/.auth/<userKey>.json and include both
 * localStorage (Supabase session) and IndexedDB (local SQLite snapshot).
 *
 * isAuthFileFresh() is used by auth.setup.ts and test-fixture.ts to decide
 * whether to re-authenticate a user or reuse the cached state.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Must match the storageKey in src/lib/supabase/client.ts ("tunetrees-auth")
const AUTH_STORAGE_KEY = "tunetrees-auth";

/**
 * localStorage key written during setup to record which DB schema version
 * the snapshot was taken against — used to detect stale snapshots after
 * a DB migration.
 */
export const AUTH_STATE_DB_VERSION_STORAGE_KEY = "tunetrees-e2e-db-version";

/**
 * localStorage key written during setup to record the snapshot shape version —
 * bump CURRENT_AUTH_STATE_SNAPSHOT_VERSION to force re-auth across all workers.
 */
export const AUTH_STATE_SNAPSHOT_VERSION_STORAGE_KEY =
  "tunetrees-e2e-auth-snapshot-version";

/**
 * Bump this when the structure of the saved auth state changes in a way that
 * makes older snapshots incompatible (e.g. new localStorage keys expected by
 * tests, new IndexedDB store layout, etc.).
 */
export const CURRENT_AUTH_STATE_SNAPSHOT_VERSION = 1;

const __dirname = dirname(fileURLToPath(import.meta.url));
const CODEGEN_CONFIG_PATH = resolve(
  __dirname,
  "../../oosync.codegen.config.json"
);

function readCurrentAuthStateDbVersion(): number | null {
  try {
    const raw = JSON.parse(readFileSync(CODEGEN_CONFIG_PATH, "utf-8")) as {
      browserSqlite?: { databaseVersion?: unknown };
    };
    const version = raw.browserSqlite?.databaseVersion;
    return typeof version === "number" ? version : null;
  } catch {
    return null;
  }
}

/**
 * The database schema version from oosync.codegen.config.json.
 * If the snapshot was taken against a different version the auth state is stale.
 */
export const CURRENT_AUTH_STATE_DB_VERSION = readCurrentAuthStateDbVersion();

// ── internal types ─────────────────────────────────────────────────────────

type StoredSession = {
  expires_at?: unknown;
  user?: {
    email?: unknown;
  };
};

type AuthStateOrigin = {
  indexedDB?: unknown[];
  localStorage?: Array<{
    name?: string;
    value?: string;
  }>;
};

// ── public types ───────────────────────────────────────────────────────────

export type StoredAuthStateMetadata = {
  /** True when the snapshot has at least one IndexedDB entry (local SQLite). */
  hasIndexedDbSnapshot: boolean;
  /** The stored user email extracted from the Supabase session. */
  storedUserEmail: string | null;
  /** Session expiry in epoch milliseconds, or null if un-parseable. */
  expiresAtMs: number | null;
  /** The DB schema version recorded in the snapshot, or null. */
  dbVersion: number | null;
  /** The snapshot shape version recorded in the snapshot, or null. */
  snapshotVersion: number | null;
};

// ── helpers ────────────────────────────────────────────────────────────────

function parseStoredSession(value: string): StoredSession | null {
  try {
    const parsed = JSON.parse(value) as StoredSession;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Read metadata from a persisted Playwright auth state file without loading
 * the full IndexedDB content into memory.
 *
 * Returns null if the file does not exist or cannot be parsed.
 */
export function readStoredAuthStateMetadata(
  filePath: string
): StoredAuthStateMetadata | null {
  if (!existsSync(filePath)) return null;

  try {
    const authData = JSON.parse(readFileSync(filePath, "utf-8")) as {
      origins?: AuthStateOrigin[];
    };
    const origins = authData.origins ?? [];

    const hasIndexedDbSnapshot = origins.some(
      (origin) => (origin.indexedDB?.length ?? 0) > 0
    );
    let storedUserEmail: string | null = null;
    let expiresAtMs: number | null = null;
    let dbVersion: number | null = null;
    let snapshotVersion: number | null = null;

    for (const origin of origins) {
      for (const entry of origin.localStorage ?? []) {
        if (entry.name === AUTH_STORAGE_KEY && entry.value) {
          const session = parseStoredSession(entry.value);
          if (session) {
            expiresAtMs =
              typeof session.expires_at === "number"
                ? session.expires_at * 1000
                : null;
            storedUserEmail =
              typeof session.user?.email === "string"
                ? session.user.email
                : null;
          }
        }

        if (entry.name === AUTH_STATE_DB_VERSION_STORAGE_KEY && entry.value) {
          const parsed = Number(entry.value);
          dbVersion = Number.isFinite(parsed) ? parsed : null;
        }

        if (
          entry.name === AUTH_STATE_SNAPSHOT_VERSION_STORAGE_KEY &&
          entry.value
        ) {
          const parsed = Number(entry.value);
          snapshotVersion = Number.isFinite(parsed) ? parsed : null;
        }
      }
    }

    return {
      hasIndexedDbSnapshot,
      storedUserEmail,
      expiresAtMs,
      dbVersion,
      snapshotVersion,
    };
  } catch {
    return null;
  }
}
