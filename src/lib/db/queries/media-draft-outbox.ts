import { sql } from "drizzle-orm";
import { persistDb, type SqliteDatabase } from "../client-sqlite";

export interface MediaDraftOutboxEntry {
  id: string;
  userRef: string;
  blobUrl: string;
  fileName: string;
  contentType: string;
  createdAt: string;
}

export async function enqueueMediaDraftUpload(
  db: SqliteDatabase,
  entry: MediaDraftOutboxEntry
): Promise<void> {
  await db.run(sql`
    INSERT INTO media_draft_outbox (
      id,
      user_ref,
      blob_url,
      file_name,
      content_type,
      created_at
    )
    VALUES (
      ${entry.id},
      ${entry.userRef},
      ${entry.blobUrl},
      ${entry.fileName},
      ${entry.contentType},
      ${entry.createdAt}
    )
    ON CONFLICT(id) DO UPDATE SET
      user_ref = excluded.user_ref,
      blob_url = excluded.blob_url,
      file_name = excluded.file_name,
      content_type = excluded.content_type,
      created_at = excluded.created_at
  `);

  await persistDb();
}

export async function listMediaDraftUploads(
  db: SqliteDatabase,
  userId: string
): Promise<MediaDraftOutboxEntry[]> {
  return await db.all<MediaDraftOutboxEntry>(sql`
    SELECT
      id as id,
      user_ref as userRef,
      blob_url as blobUrl,
      file_name as fileName,
      content_type as contentType,
      created_at as createdAt
    FROM media_draft_outbox
    WHERE user_ref = ${userId}
    ORDER BY created_at ASC
  `);
}

export async function deleteMediaDraftUpload(
  db: SqliteDatabase,
  id: string
): Promise<void> {
  await db.run(sql`DELETE FROM media_draft_outbox WHERE id = ${id}`);
  await persistDb();
}
