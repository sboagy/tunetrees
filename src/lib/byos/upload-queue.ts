import { createSignal } from "solid-js";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { persistDb } from "@/lib/db/client-sqlite";
import { buildByosStoragePath } from "@/lib/db/queries/media-assets";
import { mediaAsset, reference } from "@/lib/db/schema";
import { validateByosAudioFile } from "./audio-validation";
import {
  deleteAudioDraft,
  getAudioDraft,
  listAudioDrafts,
  updateAudioDraft,
} from "./draft-store";
import { type ByosProviderOptions, createByosProviders } from "./providers";

const active = new Map<string, AbortController>();
const [activeIds, setActiveIds] = createSignal<string[]>([]);
export function isAudioUploadActive(userId: string, id: string) {
  return activeIds().includes(`${userId}:${id}`);
}
export function cancelAudioUpload(userId: string, id: string) {
  active.get(`${userId}:${id}`)?.abort();
  return deleteAudioDraft(userId, id);
}

export async function replayAudioDrafts(
  db: SqliteDatabase,
  options: ByosProviderOptions,
  stillCurrent: () => boolean
) {
  // Web Locks prevent two tabs from replaying the same queue simultaneously.
  await navigator.locks.request(
    `byos-uploads:${options.userId}`,
    { ifAvailable: true },
    async (lock) => {
      if (!lock) return;
      for (const original of await listAudioDrafts(options.userId)) {
        if (!stillCurrent() || !navigator.onLine) break;
        if (
          !original.destination ||
          !original.fields.uploadFile ||
          original.id === "oauth"
        )
          continue;
        const draft = await getAudioDraft(options.userId, original.id);
        if (!draft?.destination || !draft.fields.uploadFile) continue;
        const controller = new AbortController();
        active.set(`${options.userId}:${draft.id}`, controller);
        setActiveIds([...active.keys()]);
        try {
          const file = draft.fields.uploadFile;
          const invalid = validateByosAudioFile(file);
          if (invalid) throw new Error(invalid);
          const provider =
            createByosProviders(options)[draft.destination.providerId];
          if (!draft.uploadId) {
            draft.uploadId = await provider.reserveUploadId();
            if (controller.signal.aborted || !stillCurrent()) continue;
            if (!(await updateAudioDraft(draft))) continue;
          }
          draft.uploaded ??= await provider.upload(file, {
            folderId: draft.destination.folderId,
            uploadId: draft.uploadId,
            signal: controller.signal,
          });
          if (controller.signal.aborted || !stillCurrent()) continue;
          if (
            !(await updateAudioDraft(draft)) ||
            !stillCurrent() ||
            controller.signal.aborted
          )
            continue;
          const upload = draft.uploaded;
          const storagePath = buildByosStoragePath(
            draft.destination.providerId,
            upload.fileId
          );
          const now = new Date().toISOString();
          // Stable IDs plus one SQLite transaction close both response-loss windows.
          db.transaction((tx) => {
            tx.insert(reference)
              .values({
                id: draft.id,
                tuneRef: draft.tuneId,
                userRef: options.userId,
                url: storagePath,
                refType: "audio",
                title: draft.fields.title || file.name,
                comment: draft.fields.comment,
                favorite: draft.fields.favorite ? 1 : 0,
                public: draft.fields.public ? 1 : 0,
                deleted: 0,
                syncVersion: 1,
                lastModifiedAt: now,
              })
              .onConflictDoNothing()
              .run();
            tx.insert(mediaAsset)
              .values({
                id: draft.id,
                referenceRef: draft.id,
                userRef: options.userId,
                storagePath,
                storageKind: "byos",
                byosProvider: draft.destination!.providerId,
                providerFileId: upload.fileId,
                originalFilename: file.name,
                contentType: upload.contentType,
                fileSizeBytes: upload.size,
                deleted: 0,
                syncVersion: 1,
                lastModifiedAt: now,
              })
              .onConflictDoNothing()
              .run();
          });
          await persistDb();
          await deleteAudioDraft(options.userId, draft.id);
          window.dispatchEvent(new Event("byos-upload-complete"));
        } catch {
          if (!controller.signal.aborted && stillCurrent()) {
            draft.error =
              "Upload waiting. Check your connection and storage settings, then retry.";
            await updateAudioDraft(draft);
          }
        } finally {
          active.delete(`${options.userId}:${draft.id}`);
          setActiveIds([...active.keys()]);
        }
      }
    }
  );
}
