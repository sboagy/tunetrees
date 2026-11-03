import type { ByosProviderId } from "./types";

const DATABASE_NAME = "tunetrees-byos-secrets";
const STORE_NAME = "refresh-tokens";
const DATABASE_VERSION = 1;

type RefreshTokenRecord = {
  key: string;
  refreshToken: string;
  updatedAt: string;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function isIndexedDbAvailable() {
  return typeof indexedDB !== "undefined";
}

function recordKey(userId: string, providerId: ByosProviderId) {
  return `${userId}:${providerId}`;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(
        request.error ?? new Error("Could not open local BYOS secret store.")
      );
    };
  });

  return databasePromise;
}

function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(
            request.error ??
              new Error("Local BYOS secret-store request failed.")
          );
        transaction.onerror = () =>
          reject(
            transaction.error ??
              new Error("Local BYOS secret-store transaction failed.")
          );
      })
  );
}

/**
 * Refresh tokens live in a separate origin-private IndexedDB database. This
 * store is never opened by SQLite/oosync and cannot be included in sync,
 * exports, or Supabase writes.
 */
export async function getLocalRefreshToken(
  userId: string,
  providerId: ByosProviderId
): Promise<string | null> {
  const record = await transact<RefreshTokenRecord | undefined>(
    "readonly",
    (store) => store.get(recordKey(userId, providerId))
  );
  return record?.refreshToken ?? null;
}

export async function putLocalRefreshToken(
  userId: string,
  providerId: ByosProviderId,
  refreshToken: string
): Promise<void> {
  await transact("readwrite", (store) =>
    store.put({
      key: recordKey(userId, providerId),
      refreshToken,
      updatedAt: new Date().toISOString(),
    } satisfies RefreshTokenRecord)
  );
}

export async function deleteLocalRefreshToken(
  userId: string,
  providerId: ByosProviderId
): Promise<void> {
  await transact("readwrite", (store) =>
    store.delete(recordKey(userId, providerId))
  );
}

export async function clearLocalByosSecretsForTests(): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }
  if (databasePromise) {
    const database = await databasePromise;
    database.close();
    databasePromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(
        request.error ?? new Error("Could not clear local BYOS secret store.")
      );
  });
}
