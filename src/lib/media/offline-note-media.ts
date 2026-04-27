import { sql } from "drizzle-orm";
import { buildMediaUploadUrl } from "@/components/notes/media-auth";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import {
  deleteMediaDraftUpload,
  enqueueMediaDraftUpload,
  listMediaDraftUploads,
} from "@/lib/db/queries/media-draft-outbox";
import {
  deleteMediaDraft,
  getMediaDraft,
  putMediaDraft,
} from "./media-vault";

interface UploadResponsePayload {
  error?: string;
  data?: {
    files?: string[];
  };
}

export interface NoteMediaUploadResult {
  success: boolean;
  data: {
    files: string[];
  };
}

interface QueueOfflineNoteMediaParams {
  db: SqliteDatabase;
  file: File;
  userId: string;
  showProgress?: (progress: number) => void;
}

interface UploadNoteMediaFileParams extends QueueOfflineNoteMediaParams {
  accessToken?: string | null;
}

interface ProcessPendingNoteMediaDraftsParams {
  db: SqliteDatabase;
  userId: string;
  accessToken: string;
}

const isBrowserOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

async function uploadNoteMediaToWorker(
  file: File,
  accessToken: string,
  showProgress?: (progress: number) => void
): Promise<NoteMediaUploadResult> {
  const formData = new FormData();
  formData.append("files[0]", file, file.name);

  showProgress?.(25);
  const response = await fetch(buildMediaUploadUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  const payload = (await response.json()) as UploadResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error || "Media upload failed.");
  }

  const uploadedUrl = payload.data?.files?.[0];
  if (!uploadedUrl) {
    throw new Error("Media upload completed without a file URL.");
  }

  showProgress?.(100);
  return {
    success: true,
    data: {
      files: [uploadedUrl],
    },
  };
}

function replaceBlobUrlInHtml(
  html: string,
  blobUrl: string,
  uploadedUrl: string
): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  for (const element of template.content.querySelectorAll<HTMLElement>(
    "img[src],a[href]"
  )) {
    const attr = element.tagName === "IMG" ? "src" : "href";
    if (element.getAttribute(attr) === blobUrl) {
      element.setAttribute(attr, uploadedUrl);
    }
  }

  return template.innerHTML;
}

export async function queueOfflineNoteMedia({
  db,
  file,
  userId,
  showProgress,
}: QueueOfflineNoteMediaParams): Promise<NoteMediaUploadResult> {
  const draftId = crypto.randomUUID();
  const blobUrl = URL.createObjectURL(file);
  const createdAt = new Date().toISOString();

  await putMediaDraft({
    id: draftId,
    blobUrl,
    blob: file,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    createdAt,
  });
  await enqueueMediaDraftUpload(db, {
    id: draftId,
    userRef: userId,
    blobUrl,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    createdAt,
  });

  showProgress?.(100);
  return {
    success: true,
    data: {
      files: [blobUrl],
    },
  };
}

export async function uploadNoteMediaFile({
  db,
  file,
  userId,
  accessToken,
  showProgress,
}: UploadNoteMediaFileParams): Promise<NoteMediaUploadResult> {
  if (!isBrowserOnline()) {
    return await queueOfflineNoteMedia({
      db,
      file,
      userId,
      showProgress,
    });
  }

  if (!accessToken) {
    throw new Error("You must be signed in to upload note media.");
  }

  return await uploadNoteMediaToWorker(file, accessToken, showProgress);
}

export async function processPendingNoteMediaDrafts({
  db,
  userId,
  accessToken,
}: ProcessPendingNoteMediaDraftsParams): Promise<{
  processedCount: number;
  skippedCount: number;
}> {
  if (!isBrowserOnline()) {
    return {
      processedCount: 0,
      skippedCount: 0,
    };
  }

  const entries = await listMediaDraftUploads(db, userId);
  let processedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    const draft = await getMediaDraft(entry.id);
    if (!draft) {
      await deleteMediaDraftUpload(db, entry.id);
      skippedCount += 1;
      continue;
    }

    const file = new File([draft.blob], draft.fileName, {
      type: draft.contentType,
    });
    const upload = await uploadNoteMediaToWorker(file, accessToken);
    const uploadedUrl = upload.data.files[0];
    const now = new Date().toISOString();
    const notesToUpdate = await db.all<{ id: string; noteText: string | null }>(sql`
      SELECT
        id as id,
        note_text as noteText
      FROM note
      WHERE
        user_ref = ${userId}
        AND deleted = 0
        AND note_text IS NOT NULL
        AND instr(note_text, ${entry.blobUrl}) > 0
    `);

    for (const note of notesToUpdate) {
      const noteText = note.noteText ?? "";
      const nextNoteText = replaceBlobUrlInHtml(
        noteText,
        entry.blobUrl,
        uploadedUrl
      );

      if (nextNoteText === noteText) {
        continue;
      }

      await db.run(sql`
        UPDATE note
        SET
          note_text = ${nextNoteText},
          last_modified_at = ${now},
          sync_version = sync_version + 1
        WHERE id = ${note.id}
      `);
    }

    await deleteMediaDraftUpload(db, entry.id);
    await deleteMediaDraft(entry.id);
    processedCount += 1;
  }

  return {
    processedCount,
    skippedCount,
  };
}
