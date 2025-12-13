/**
 * PWA Update Hook
 *
 * Provides access to PWA update state and functions.
 * Can be used by multiple components (UpdatePrompt, AboutDialog, etc.)
 *
 * @module lib/hooks/usePWAUpdate
 */

import { createSignal, onMount, onCleanup, type Accessor } from "solid-js";

// Global state for PWA update
let globalNeedRefresh: Accessor<boolean> = () => false;
let globalUpdateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null =
  null;
let globalCheckForUpdate: (() => void) | null = null;

export interface PWAUpdateState {
  needRefresh: Accessor<boolean>;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  checkForUpdate: () => void;
}

/**
 * Hook to access PWA update state and functions
 * Only works in production builds
 */
export function usePWAUpdate(): PWAUpdateState {
  const [needRefresh, setNeedRefresh] = createSignal(false);

  onMount(async () => {
    // Only in production
    if (import.meta.env.DEV) {
      return;
    }

    try {
      const { useRegisterSW } = await import("virtual:pwa-register/solid");

      let updateCheckInterval: number | undefined;
      let registration: ServiceWorkerRegistration | undefined;

      const {
        needRefresh: [needRefreshSignal, setNeedRefreshSignal],
        updateServiceWorker,
      } = useRegisterSW({
        onRegistered(reg: ServiceWorkerRegistration | undefined) {
          console.log("[PWA] Service Worker registered:", reg);
          registration = reg;

          // Check for updates every hour
          updateCheckInterval = window.setInterval(
            () => {
              registration?.update();
            },
            60 * 60 * 1000
          );
        },
        onRegisterError(error: unknown) {
          console.error("[PWA] Service Worker registration failed:", error);
        },
      });

      // Update local state when needRefresh changes
      setNeedRefresh(needRefreshSignal);

      // Store global references
      globalNeedRefresh = needRefreshSignal;
      globalUpdateServiceWorker = updateServiceWorker;
      globalCheckForUpdate = () => {
        console.log("[PWA] Manual update check requested");
        registration?.update();
      };

      // Cleanup interval on component unmount
      onCleanup(() => {
        if (updateCheckInterval !== undefined) {
          clearInterval(updateCheckInterval);
        }
      });
    } catch (error) {
      console.error("[PWA] Failed to load PWA update module:", error);
    }
  });

  return {
    needRefresh: import.meta.env.DEV ? () => false : globalNeedRefresh,
    updateServiceWorker:
      globalUpdateServiceWorker ||
      (async () => {
        console.warn("[PWA] updateServiceWorker not initialized");
      }),
    checkForUpdate:
      globalCheckForUpdate ||
      (() => {
        console.warn("[PWA] checkForUpdate not initialized");
      }),
  };
}
