/**
 * PWA Update Hook
 *
 * Provides access to PWA update state and functions.
 * Can be used by multiple components (UpdatePrompt, AboutDialog, etc.)
 *
 * Note: This hook initializes service worker registration on first use.
 * Multiple calls to this hook will return the same global state.
 *
 * @module lib/hooks/usePWAUpdate
 */

import {
  type Accessor,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

// Global state for PWA update (singleton pattern)
let globalNeedRefresh: Accessor<boolean> = () => false;
let globalUpdateServiceWorker:
  | ((reloadPage?: boolean) => Promise<void>)
  | null = null;
let globalCheckForUpdate: (() => void) | null = null;
let isInitialized = false;

export interface PWAUpdateState {
  needRefresh: Accessor<boolean>;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  checkForUpdate: () => void;
}

/**
 * Hook to access PWA update state and functions
 * Only works in production builds
 * First call initializes the service worker, subsequent calls return the same state
 */
export function usePWAUpdate(): PWAUpdateState {
  const [needRefresh, setNeedRefresh] = createSignal(false);

  onMount(async () => {
    // Only in production
    if (import.meta.env.DEV) {
      return;
    }

    // Only initialize once (singleton pattern)
    if (isInitialized) {
      // Sync with global state
      createEffect(() => {
        setNeedRefresh(globalNeedRefresh());
      });
      return;
    }

    try {
      const { useRegisterSW } = await import("virtual:pwa-register/solid");

      let updateCheckInterval: number | undefined;
      let registration: ServiceWorkerRegistration | undefined;
      let handleVisibilityChange: (() => void) | undefined;

      const checkForUpdateNow = () => {
        if (!registration) return;

        // Force an update check at startup and when the tab becomes visible
        // so deployed fixes reach stale controlled clients faster than the
        // default browser/service-worker polling cadence.
        void registration.update().catch((error) => {
          console.warn("[PWA] Service Worker update check failed:", error);
        });
      };

      const {
        needRefresh: [needRefreshSignal],
        updateServiceWorker,
      } = useRegisterSW({
        onRegistered(reg: ServiceWorkerRegistration | undefined) {
          console.log("[PWA] Service Worker registered:", reg);
          registration = reg;

          checkForUpdateNow();

          handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
              checkForUpdateNow();
            }
          };
          document.addEventListener("visibilitychange", handleVisibilityChange);

          // Check for updates every hour
          updateCheckInterval = window.setInterval(
            () => {
              checkForUpdateNow();
            },
            60 * 60 * 1000
          );
        },
        onRegisterError(error: unknown) {
          console.error("[PWA] Service Worker registration failed:", error);
        },
      });

      // Reactively sync local state with needRefreshSignal
      createEffect(() => {
        setNeedRefresh(needRefreshSignal());
      });

      // Store global references
      globalNeedRefresh = needRefreshSignal;
      globalUpdateServiceWorker = updateServiceWorker;
      globalCheckForUpdate = () => {
        console.log("[PWA] Manual update check requested");
        registration?.update();
      };

      isInitialized = true;

      // Cleanup interval on component unmount
      onCleanup(() => {
        if (updateCheckInterval !== undefined) {
          clearInterval(updateCheckInterval);
        }
        if (handleVisibilityChange) {
          document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange
          );
        }
      });
    } catch (error) {
      console.error("[PWA] Failed to load PWA update module:", error);
    }
  });

  return {
    needRefresh: import.meta.env.DEV ? () => false : needRefresh,
    updateServiceWorker: async (reloadPage?: boolean) => {
      if (!globalUpdateServiceWorker) {
        console.warn("[PWA] updateServiceWorker not initialized");
        return;
      }

      await globalUpdateServiceWorker(reloadPage);
    },
    checkForUpdate: () => {
      if (!globalCheckForUpdate) {
        console.warn("[PWA] checkForUpdate not initialized");
        return;
      }

      globalCheckForUpdate();
    },
  };
}
