import { eq, sql } from "drizzle-orm";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { persistDb } from "@/lib/db/client-sqlite";
import { userProfile } from "@/lib/db/schema";
import type { ByosProviderId } from "./types";

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
