import codegenConfig from "../../../oosync.codegen.config.json";
import { requireUpgradeFullPull } from "./upgrade-policy";

/** Explicitly confirmed recovery only; the blocked runtime has no active DB to clear. */
export async function discardBlockedDatabase(userId: string): Promise<void> {
  if (!userId) throw new Error("An account is required to discard local data");
  const storage = codegenConfig.browserSqlite;
  // Set recovery intent before deletion. A failed/interrupted download must retry fully.
  requireUpgradeFullPull(userId);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(storage.indexedDbName);
    request.onerror = () => reject(new Error("Could not open local storage"));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storage.indexedDbStore)) {
        db.close();
        resolve();
        return;
      }
      let tx: IDBTransaction | undefined;
      try {
        tx = db.transaction(storage.indexedDbStore, "readwrite");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => {
          db.close();
          reject(new Error("Could not discard local data; please retry"));
        };
        const store = tx.objectStore(storage.indexedDbStore);
        // Atomic and account-scoped: never clear the origin, auth, or media stores.
        for (const prefix of [
          storage.dbKeyPrefix,
          storage.dbVersionKeyPrefix,
          storage.outboxBackupKeyPrefix,
        ]) {
          store.delete(`${prefix}-${userId}`);
        }
      } catch {
        tx?.abort();
        db.close();
        reject(new Error("Could not access local storage; please retry"));
      }
    };
  });
}
