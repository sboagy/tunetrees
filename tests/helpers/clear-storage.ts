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
  await page.evaluate(() => {
    // Clear localStorage
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();

    // Clear all IndexedDB databases
    return new Promise<void>((resolve) => {
      if (!window.indexedDB) {
        resolve();
        return;
      }

      // Get all databases and delete them
      window.indexedDB.databases().then((databases) => {
        const deletePromises = databases.map((db) => {
          if (db.name) {
            return new Promise<void>((deleteResolve) => {
              const request = window.indexedDB.deleteDatabase(db.name!);
              request.onsuccess = () => deleteResolve();
              request.onerror = () => deleteResolve(); // Continue even on error
            });
          }
          return Promise.resolve();
        });

        Promise.all(deletePromises).then(() => {
          console.log("✅ Cleared all IndexedDB databases");
          resolve();
        });
      });
    });
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
      const request = window.indexedDB.deleteDatabase(name);
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
