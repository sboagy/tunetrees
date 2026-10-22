import type { StorageConfig } from "./storage-config";
import type { ByosUploadedFile } from "./types";

export interface AudioDraftFields {
  url: string;
  title: string;
  refType: string;
  comment: string;
  favorite: boolean;
  public: boolean;
  sourceMode: "url" | "upload";
  uploadFile: File | null;
}
export interface AudioDraft {
  id: string;
  userId: string;
  tuneId: string;
  fields: AudioDraftFields;
  destination?: StorageConfig;
  uploadId?: string;
  uploaded?: ByosUploadedFile;
  error?: string;
}

// Separate from SQLite and the token store: these records must never sync/export.
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("tunetrees-byos-drafts", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("drafts", { keyPath: ["userId", "id"] });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("drafts", mode);
      const request = action(tx.objectStore("drafts"));
      // Only acknowledge durable writes after commit, including quota failures.
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error || new Error("Could not save the local audio draft."));
    });
  } finally {
    db.close();
  }
}
export async function putAudioDraft(draft: AudioDraft) {
  await transaction("readwrite", (store) => store.put(draft));
  window.dispatchEvent(new Event("byos-drafts-changed"));
}
/** Update only while the draft still exists: cancellation must not resurrect it. */
export async function updateAudioDraft(draft: AudioDraft): Promise<boolean> {
  const previous = await transaction<AudioDraft | undefined>(
    "readwrite",
    (store) => {
      const request = store.get([draft.userId, draft.id]);
      request.onsuccess = () => {
        if (request.result) store.put(draft);
      };
      return request;
    }
  );
  window.dispatchEvent(new Event("byos-drafts-changed"));
  return !!previous;
}
export function getAudioDraft(
  userId: string,
  id: string
): Promise<AudioDraft | undefined> {
  return transaction("readonly", (store) => store.get([userId, id]));
}
export async function deleteAudioDraft(userId: string, id: string) {
  await transaction("readwrite", (store) => store.delete([userId, id]));
  window.dispatchEvent(new Event("byos-drafts-changed"));
}
export async function listAudioDrafts(userId: string): Promise<AudioDraft[]> {
  return transaction("readonly", (store) =>
    store.getAll(IDBKeyRange.bound([userId], [userId, []]))
  );
}

let capture: (() => Promise<void>) | undefined;
export function registerReferenceDraftCapture(callback: () => Promise<void>) {
  capture = callback;
  return () => {
    if (capture === callback) capture = undefined;
  };
}
export async function captureReferenceDraft() {
  await capture?.();
}

export function safeReturnPath(path: string) {
  const url = new URL(path, location.origin);
  return url.origin === location.origin && !url.pathname.startsWith("/byos/")
    ? `${url.pathname}${url.search}${url.hash}`
    : "/";
}
