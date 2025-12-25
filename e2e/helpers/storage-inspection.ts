/**
 * Storage Inspection Helpers
 *
 * Utilities for inspecting local storage, IndexedDB, and service worker state
 * in Playwright E2E tests.
 *
 * @module e2e/helpers/storage-inspection
 */

import type { Page } from "@playwright/test";
import log from "loglevel";

log.setLevel("info");

/**
 * Get a record from local SQLite database
 *
 * @param page - Playwright page instance
 * @param table - Table name
 * @param id - Record ID
 * @returns Record data or null if not found
 */
export async function getSQLiteRecord(
  page: Page,
  table: string,
  id: string | number
): Promise<any> {
  log.info(`🔍 Getting SQLite record from ${table}[${id}]...`);

  const record = await page.evaluate(
    async ({ table, id }) => {
      const api = (window as any).__ttTestApi;
      if (!api) throw new Error("__ttTestApi not available");
      return await api.getLocalRecord(table, id);
    },
    { table, id }
  );

  return record;
}

/**
 * Get IndexedDB storage size estimate
 *
 * @param page - Playwright page instance
 * @returns Storage estimate in bytes
 */
export async function getIndexedDBSize(page: Page): Promise<number> {
  log.info("📊 Getting IndexedDB size...");

  const sizeBytes = await page.evaluate(async () => {
    if (!navigator.storage || !navigator.storage.estimate) {
      throw new Error("Storage API not available");
    }

    const estimate = await navigator.storage.estimate();
    return estimate.usage ?? 0;
  });

  log.info(`📊 IndexedDB size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  return sizeBytes;
}

/**
 * Clear all local storage
 * WARNING: This will clear all app data including IndexedDB
 *
 * @param page - Playwright page instance
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  log.info("🗑️ Clearing local storage...");

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  log.info("✅ Local storage cleared");
}

/**
 * Clear IndexedDB database
 *
 * @param page - Playwright page instance
 * @param dbName - Database name (default: tunetrees-local)
 */
export async function clearIndexedDB(
  page: Page,
  dbName: string = "tunetrees-local"
): Promise<void> {
  log.info(`🗑️ Clearing IndexedDB: ${dbName}...`);

  await page.evaluate(async (db) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(db);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        console.warn(`IndexedDB ${db} delete blocked`);
        // Force close connections and retry
        setTimeout(() => {
          const retryRequest = indexedDB.deleteDatabase(db);
          retryRequest.onsuccess = () => resolve();
          retryRequest.onerror = () => reject(retryRequest.error);
        }, 1000);
      };
    });
  }, dbName);

  log.info("✅ IndexedDB cleared");
}

/**
 * Verify service worker is active
 *
 * @param page - Playwright page instance
 * @returns true if service worker is active
 */
export async function verifyServiceWorkerActive(page: Page): Promise<boolean> {
  log.info("🔍 Checking service worker status...");

  const isActive = await page.evaluate(async () => {
    if (!navigator.serviceWorker) {
      return false;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    return !!registration?.active;
  });

  if (isActive) {
    log.info("✅ Service worker is active");
  } else {
    log.warn("⚠️ Service worker is not active");
  }

  return isActive;
}

/**
 * Wait for service worker to be activated
 *
 * @param page - Playwright page instance
 * @param timeoutMs - Maximum time to wait
 */
export async function waitForServiceWorker(
  page: Page,
  timeoutMs: number = 10000
): Promise<void> {
  log.info("⏳ Waiting for service worker to activate...");

  await page.waitForFunction(
    async () => {
      if (!navigator.serviceWorker) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration?.active;
    },
    { timeout: timeoutMs }
  );

  log.info("✅ Service worker activated");
}

/**
 * Get service worker cache names
 *
 * @param page - Playwright page instance
 * @returns Array of cache names
 */
export async function getServiceWorkerCaches(page: Page): Promise<string[]> {
  log.info("🔍 Getting service worker caches...");

  const cacheNames = await page.evaluate(async () => {
    return await caches.keys();
  });

  log.info(`📦 Found ${cacheNames.length} caches: ${cacheNames.join(", ")}`);
  return cacheNames;
}

/**
 * Verify asset is cached in service worker
 *
 * @param page - Playwright page instance
 * @param url - Asset URL to check
 * @returns true if asset is cached
 */
export async function verifyAssetCached(
  page: Page,
  url: string
): Promise<boolean> {
  log.info(`🔍 Checking if asset is cached: ${url}`);

  const isCached = await page.evaluate(async (assetUrl) => {
    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const response = await cache.match(assetUrl);
      if (response) return true;
    }

    return false;
  }, url);

  if (isCached) {
    log.info(`✅ Asset is cached: ${url}`);
  } else {
    log.info(`❌ Asset not cached: ${url}`);
  }

  return isCached;
}

/**
 * Clear all service worker caches
 *
 * @param page - Playwright page instance
 */
export async function clearServiceWorkerCaches(page: Page): Promise<void> {
  log.info("🗑️ Clearing service worker caches...");

  await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  });

  log.info("✅ Service worker caches cleared");
}

/**
 * Get localStorage size estimate
 *
 * @param page - Playwright page instance
 * @returns Size in bytes
 */
export async function getLocalStorageSize(page: Page): Promise<number> {
  const size = await page.evaluate(() => {
    let totalSize = 0;
    for (const key in localStorage) {
      if (Object.hasOwn(localStorage, key)) {
        totalSize += localStorage[key].length + key.length;
      }
    }
    return totalSize * 2; // UTF-16 encoding
  });

  log.info(`📊 localStorage size: ${(size / 1024).toFixed(2)} KB`);
  return size;
}

/**
 * Verify specific localStorage key exists
 *
 * @param page - Playwright page instance
 * @param key - localStorage key
 * @returns true if key exists
 */
export async function verifyLocalStorageKey(
  page: Page,
  key: string
): Promise<boolean> {
  const exists = await page.evaluate((k) => {
    return localStorage.getItem(k) !== null;
  }, key);

  if (exists) {
    log.info(`✅ localStorage key exists: ${key}`);
  } else {
    log.info(`❌ localStorage key not found: ${key}`);
  }

  return exists;
}

/**
 * Get value from localStorage
 *
 * @param page - Playwright page instance
 * @param key - localStorage key
 * @returns Value or null if not found
 */
export async function getLocalStorageItem(
  page: Page,
  key: string
): Promise<string | null> {
  return await page.evaluate((k) => {
    return localStorage.getItem(k);
  }, key);
}
