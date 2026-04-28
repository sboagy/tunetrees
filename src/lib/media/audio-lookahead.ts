import { sql } from "drizzle-orm";
import { attachMediaAuthTokenToUrl } from "@/components/notes/media-auth";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import {
  deleteMediaVaultBlob,
  getMediaVaultBlob,
  listMediaVaultKeysByKind,
  putMediaVaultBlob,
} from "./media-vault";

interface SyncPinnedAudioVaultParams {
  db: SqliteDatabase;
  userId: string;
  accessToken: string;
  lookaheadDays?: number;
}

async function listUpcomingAudioReferenceUrls(
  db: SqliteDatabase,
  userId: string,
  lookaheadDays: number
): Promise<string[]> {
  const dayModifier = `+${Math.max(0, Math.trunc(lookaheadDays))} day`;
  const results = await db.all<{ url: string }>(sql`
    WITH scheduled_audio AS (
      SELECT
        r.url AS url,
        datetime(replace(substr(rt.scheduled, 1, 19), 'T', ' ')) AS scheduled_at
      FROM reference r
      INNER JOIN media_asset ma
        ON ma.reference_ref = r.id
       AND ma.deleted = 0
      INNER JOIN repertoire_tune rt
        ON rt.tune_ref = r.tune_ref
       AND rt.deleted = 0
      INNER JOIN repertoire rep
        ON rep.repertoire_id = rt.repertoire_ref
       AND rep.deleted = 0
      WHERE rep.user_ref = ${userId}
        AND r.user_ref = ${userId}
        AND r.deleted = 0
        AND r.ref_type = 'audio'
        AND rt.scheduled IS NOT NULL
    )
    SELECT DISTINCT url
    FROM scheduled_audio
    WHERE scheduled_at <= datetime('now', ${dayModifier})
    ORDER BY scheduled_at ASC
  `);

  return results
    .map((row) => row.url)
    .filter((url) => typeof url === "string");
}

export async function syncPinnedAudioVault({
  db,
  userId,
  accessToken,
  lookaheadDays = 3,
}: SyncPinnedAudioVaultParams): Promise<{
  pinnedCount: number;
  removedCount: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      pinnedCount: 0,
      removedCount: 0,
    };
  }

  const desiredUrls = new Set(
    await listUpcomingAudioReferenceUrls(db, userId, lookaheadDays)
  );
  const existingUrls = await listMediaVaultKeysByKind("audio");

  let removedCount = 0;
  for (const key of existingUrls) {
    if (!desiredUrls.has(key)) {
      await deleteMediaVaultBlob(key);
      removedCount += 1;
    }
  }

  let pinnedCount = 0;
  for (const url of desiredUrls) {
    const existingBlob = await getMediaVaultBlob(url);
    if (existingBlob) {
      continue;
    }

    const response = await fetch(attachMediaAuthTokenToUrl(url, accessToken));
    if (!response.ok) {
      console.warn(
        "[audio-lookahead] Failed to pin audio reference:",
        url,
        response.status
      );
      continue;
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      continue;
    }

    await putMediaVaultBlob(url, blob, "audio");
    pinnedCount += 1;
  }

  return {
    pinnedCount,
    removedCount,
  };
}
