import { sql } from "drizzle-orm";
import { buildMediaUploadUrl } from "@/components/notes/media-auth";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import {
  deleteMediaDraftUpload,
  enqueueMediaDraftUpload,
  listMediaDraftUploads,
} from "@/lib/db/queries/media-draft-outbox";
import { deleteMediaDraft, getMediaDraft, putMediaDraft } from "./media-vault";

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
    persistedFiles?: string[];
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

const OFFLINE_NOTE_MEDIA_DRAFT_URL_PREFIX = "tunetrees-note-media-draft://";

export const buildOfflineNoteMediaDraftUrl = (draftId: string) =>
  `${OFFLINE_NOTE_MEDIA_DRAFT_URL_PREFIX}${draftId}`;

export const hasOfflineNoteMediaDraftUrlsInHtml = (html: string) =>
  html.includes(OFFLINE_NOTE_MEDIA_DRAFT_URL_PREFIX);

function getOfflineNoteMediaDraftId(url: string): string | null {
  if (!url.startsWith(OFFLINE_NOTE_MEDIA_DRAFT_URL_PREFIX)) {
    return null;
  }

  const draftId = url.slice(OFFLINE_NOTE_MEDIA_DRAFT_URL_PREFIX.length);
  return draftId || null;
}

function replaceNoteMediaUrlsInHtml(
  html: string,
  replacements: ReadonlyMap<string, string>
): string {
  if (!html || replacements.size === 0) {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  for (const element of template.content.querySelectorAll<HTMLElement>(
    "img[src],a[href]"
  )) {
    const attr = element.tagName === "IMG" ? "src" : "href";
    const currentValue = element.getAttribute(attr);
    if (!currentValue) {
      continue;
    }

    const nextValue = replacements.get(currentValue);
    if (nextValue) {
      element.setAttribute(attr, nextValue);
    }
  }

  return template.innerHTML;
}

export function persistOfflineNoteMediaDraftUrlsInHtml(
  html: string,
  displayUrlToDraftUrl: ReadonlyMap<string, string>
): string {
  return replaceNoteMediaUrlsInHtml(html, displayUrlToDraftUrl);
}

export interface ResolvedOfflineNoteMediaHtml {
  html: string;
  displayUrlByDraftUrl: Map<string, string>;
  revoke: () => void;
}

export async function resolveOfflineNoteMediaDraftUrlsInHtml(
  html: string,
  options: {
    reuseDisplayUrlByDraftUrl?: ReadonlyMap<string, string>;
  } = {}
): Promise<ResolvedOfflineNoteMediaHtml> {
  if (!html) {
    return {
      html,
      displayUrlByDraftUrl: new Map(),
      revoke: () => undefined,
    };
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  const displayUrlByDraftUrl = new Map<string, string>();
  const createdDisplayUrls: string[] = [];

  try {
    for (const element of template.content.querySelectorAll<HTMLElement>(
      "img[src],a[href]"
    )) {
      const attr = element.tagName === "IMG" ? "src" : "href";
      const currentValue = element.getAttribute(attr);
      if (!currentValue) {
        continue;
      }

      const draftId = getOfflineNoteMediaDraftId(currentValue);
      if (!draftId) {
        continue;
      }

      let displayUrl =
        displayUrlByDraftUrl.get(currentValue) ??
        options.reuseDisplayUrlByDraftUrl?.get(currentValue);

      if (!displayUrl) {
        const draft = await getMediaDraft(draftId);
        if (!draft) {
          continue;
        }

        displayUrl = URL.createObjectURL(draft.blob);
        createdDisplayUrls.push(displayUrl);
      }

      displayUrlByDraftUrl.set(currentValue, displayUrl);
      element.setAttribute(attr, displayUrl);
    }
  } catch (error) {
    for (const displayUrl of createdDisplayUrls) {
      URL.revokeObjectURL(displayUrl);
    }
    throw error;
  }

  return {
    html: template.innerHTML,
    displayUrlByDraftUrl,
    revoke: () => {
      for (const displayUrl of createdDisplayUrls) {
        URL.revokeObjectURL(displayUrl);
      }
    },
  };
}

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

export async function queueOfflineNoteMedia({
  db,
  file,
  userId,
  showProgress,
}: QueueOfflineNoteMediaParams): Promise<NoteMediaUploadResult> {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "Offline media queueing is unavailable because persistent browser storage is not supported."
    );
  }

  const draftId = crypto.randomUUID();
  const draftUrl = buildOfflineNoteMediaDraftUrl(draftId);
  const blobUrl = URL.createObjectURL(file);
  const createdAt = new Date().toISOString();

  try {
    await putMediaDraft({
      id: draftId,
      blobUrl,
      blob: file,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      createdAt,
    });
  } catch (error) {
    // Avoid leaking an object URL when durable offline storage fails and
    // ensure we do not enqueue an upload entry that cannot be fulfilled.
    URL.revokeObjectURL(blobUrl);
    throw error;
  }
  await enqueueMediaDraftUpload(db, {
    id: draftId,
    userRef: userId,
    blobUrl: draftUrl,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    createdAt,
  });

  showProgress?.(100);
  return {
    success: true,
    data: {
      files: [blobUrl],
      persistedFiles: [draftUrl],
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
    if (!uploadedUrl) {
      throw new Error("Media upload completed without a file URL.");
    }

    const referencesToReplace = new Map<string, string>([
      [entry.blobUrl, uploadedUrl],
    ]);
    if (draft.blobUrl && draft.blobUrl !== entry.blobUrl) {
      referencesToReplace.set(draft.blobUrl, uploadedUrl);
    }

    const now = new Date().toISOString();
    const notesToUpdate = new Map<
      string,
      { id: string; noteText: string | null }
    >();
    let didUpdateNotes = false;

    for (const referenceUrl of referencesToReplace.keys()) {
      const matchingNotes = await db.all<{
        id: string;
        noteText: string | null;
      }>(sql`
        SELECT
          id as id,
          note_text as noteText
        FROM note
        WHERE
          user_ref = ${userId}
          AND deleted = 0
          AND note_text IS NOT NULL
          AND instr(note_text, ${referenceUrl}) > 0
      `);

      for (const note of matchingNotes) {
        notesToUpdate.set(note.id, note);
      }
    }

    for (const note of notesToUpdate.values()) {
      const noteText = note.noteText ?? "";
      const nextNoteText = replaceNoteMediaUrlsInHtml(
        noteText,
        referencesToReplace
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
      didUpdateNotes = true;
    }

    if (didUpdateNotes) {
      const { persistDb } = await import("../db/client-sqlite");
      await persistDb();
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
