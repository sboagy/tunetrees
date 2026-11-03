import { eq, sql } from "drizzle-orm";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { persistDb } from "@/lib/db/client-sqlite";
import { userProfile } from "@/lib/db/schema";
import { parseStorageConfig, type StorageConfig } from "./storage-config";
import type { ByosProviderId } from "./types";

export function getStorageConfig(db: SqliteDatabase, userId: string) {
  const row = db
    .select()
    .from(userProfile)
    .where(eq(userProfile.id, userId))
    .get();
  const config = parseStorageConfig(row?.byosStorageConfig);
  return config?.providerId === row?.byosProvider ? config : null;
}

export async function saveStorageConfig(
  db: SqliteDatabase,
  userId: string,
  config: StorageConfig
) {
  const value = parseStorageConfig(JSON.stringify(config));
  if (!value) throw new Error("Invalid storage configuration.");
  const row = db
    .update(userProfile)
    .set({
      byosProvider: value.providerId,
      byosStorageConfig: JSON.stringify(value),
      syncVersion: sql.raw(`${userProfile.syncVersion.name} + 1`),
      lastModifiedAt: new Date().toISOString(),
    })
    .where(eq(userProfile.id, userId))
    .returning({ id: userProfile.id })
    .get();
  if (!row) throw new Error("Your profile is not ready. Please try again.");
  await persistDb();
  globalThis.dispatchEvent(new Event("byos-settings-changed"));
}

function isByosProviderId(value: string | null): value is ByosProviderId {
  return value === "google-drive" || value === "dropbox";
}

export async function getSelectedByosProvider(
  db: SqliteDatabase,
  userId: string
): Promise<ByosProviderId | null> {
  const row = db
    .select({ providerId: userProfile.byosProvider })
    .from(userProfile)
    .where(eq(userProfile.id, userId))
    .get();
  const providerId = row?.providerId ?? null;
  return isByosProviderId(providerId) ? providerId : null;
}

export async function setSelectedByosProvider(
  db: SqliteDatabase,
  userId: string,
  providerId: ByosProviderId
) {
  db.update(userProfile)
    .set({
      byosProvider: providerId,
      syncVersion: sql.raw(`${userProfile.syncVersion.name} + 1`),
      lastModifiedAt: new Date().toISOString(),
    })
    .where(eq(userProfile.id, userId))
    .run();
  await persistDb();
}
