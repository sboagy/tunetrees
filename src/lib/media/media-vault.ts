const MEDIA_VAULT_DB_NAME = "tunetrees-media-vault";
const MEDIA_VAULT_DB_VERSION = 2;
const MEDIA_VAULT_STORE = "media-vault";
const MEDIA_DRAFT_STORE = "media-drafts";

export type MediaVaultKind = "audio";

type MediaVaultRecord = {
  key: string;
  blob: Blob;
  kind: MediaVaultKind;
  updatedAt: string;
};

export type MediaDraftRecord = {
  id: string;
  blobUrl: string;
  blob: Blob;
  fileName: string;
  contentType: string;
  createdAt: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDbAvailable() {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(
        MEDIA_VAULT_DB_NAME,
        MEDIA_VAULT_DB_VERSION
      );

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(MEDIA_VAULT_STORE)) {
          const store = db.createObjectStore(MEDIA_VAULT_STORE, {
            keyPath: "key",
          });
          store.createIndex("kind", "kind", { unique: false });
        } else {
          const transaction = request.transaction;
          const store = transaction?.objectStore(MEDIA_VAULT_STORE);
          if (store && !store.indexNames.contains("kind")) {
            store.createIndex("kind", "kind", { unique: false });
          }
        }

        if (!db.objectStoreNames.contains(MEDIA_DRAFT_STORE)) {
          db.createObjectStore(MEDIA_DRAFT_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        // Clear the cached open attempt so a later call can retry.
        dbPromise = null;
        reject(request.error ?? new Error("Failed to open media vault."));
      };
      request.onblocked = () => {
        // A blocked open cannot make progress; clear the cache so callers
        // are not permanently stuck with this failed attempt.
        dbPromise = null;
        reject(
          new Error(
            "Failed to open media vault because the database is blocked."
          )
        );
      };
    });
  }

  return dbPromise;
}

function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | undefined
): Promise<T | undefined> {
  return openDatabase().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        let settled = false;
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);

        transaction.oncomplete = () => {
          if (!request && !settled) {
            settled = true;
            resolve(undefined);
          }
        };
        transaction.onerror = () =>
          reject(
            transaction.error ?? new Error("IndexedDB transaction failed.")
          );
        transaction.onabort = () =>
          reject(
            transaction.error ?? new Error("IndexedDB transaction aborted.")
          );

        if (request) {
          request.onsuccess = () => {
            if (!settled) {
              settled = true;
              resolve(request.result);
            }
          };
          request.onerror = () =>
            reject(request.error ?? new Error("IndexedDB request failed."));
        }
      })
  );
}

export async function getMediaVaultBlob(key: string): Promise<Blob | null> {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const record = await runTransaction<MediaVaultRecord | undefined>(
    MEDIA_VAULT_STORE,
    "readonly",
    (store) => store.get(key)
  );

  return record?.blob ?? null;
}

export async function putMediaVaultBlob(
  key: string,
  blob: Blob,
  kind: MediaVaultKind = "audio"
): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await runTransaction(MEDIA_VAULT_STORE, "readwrite", (store) =>
    store.put({
      key,
      blob,
      kind,
      updatedAt: new Date().toISOString(),
    } satisfies MediaVaultRecord)
  );
}

export async function deleteMediaVaultBlob(key: string): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await runTransaction(MEDIA_VAULT_STORE, "readwrite", (store) =>
    store.delete(key)
  );
}

export async function listMediaVaultKeysByKind(
  kind: MediaVaultKind
): Promise<string[]> {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  const records = ((await runTransaction<MediaVaultRecord[]>(
    MEDIA_VAULT_STORE,
    "readonly",
    (store) => store.index("kind").getAll(kind)
  )) ?? []) as MediaVaultRecord[];

  return records.map((record) => record.key);
}

export async function putMediaDraft(record: MediaDraftRecord): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await runTransaction(MEDIA_DRAFT_STORE, "readwrite", (store) =>
    store.put(record)
  );
}

export async function getMediaDraft(
  id: string
): Promise<MediaDraftRecord | null> {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const record = await runTransaction<MediaDraftRecord | undefined>(
    MEDIA_DRAFT_STORE,
    "readonly",
    (store) => store.get(id)
  );

  return record ?? null;
}

export async function deleteMediaDraft(id: string): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await runTransaction(MEDIA_DRAFT_STORE, "readwrite", (store) =>
    store.delete(id)
  );
}

export async function listMediaDrafts(): Promise<MediaDraftRecord[]> {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  return (
    ((await runTransaction<MediaDraftRecord[]>(
      MEDIA_DRAFT_STORE,
      "readonly",
      (store) => store.getAll()
    )) as MediaDraftRecord[] | undefined) ?? []
  );
}

export async function clearMediaVaultForTests(): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(MEDIA_VAULT_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(
        request.error ?? new Error("Failed to delete media vault database.")
      );
    request.onblocked = () => resolve();
  });
}
