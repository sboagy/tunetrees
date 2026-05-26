/**
 * Test Helper: Clear Browser Storage
 *
 * Clears IndexedDB, localStorage, and other storage to ensure tests start fresh.
 */

import type { Page } from "@playwright/test";

/**
 * Clear all browser storage including IndexedDB
 */
export async function clearAllStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Clear localStorage
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();

    // Clear all IndexedDB databases
    if (!globalThis.indexedDB) {
      return;
    }

    const databases = await globalThis.indexedDB.databases();
    const deletePromises: Promise<void>[] = [];

    for (const db of databases) {
      if (!db.name) continue;
      deletePromises.push(
        new Promise<void>((resolve) => {
          const request = globalThis.indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve(); // Continue even on error
        })
      );
    }

    await Promise.all(deletePromises);
    console.log("✅ Cleared all IndexedDB databases");
  });
}

/**
 * Clear specific IndexedDB database
 */
export async function clearIndexedDB(
  page: Page,
  dbName: string
): Promise<void> {
  await page.evaluate((name) => {
    return new Promise<void>((resolve, reject) => {
      const request = globalThis.indexedDB.deleteDatabase(name);
      request.onsuccess = () => {
        console.log(`✅ Deleted IndexedDB: ${name}`);
        resolve();
      };
      request.onerror = () => {
        console.error(`❌ Failed to delete IndexedDB: ${name}`);
        reject(new Error(`Failed to delete database: ${name}`));
      };
    });
  }, dbName);
}
