/**
 * Offline Indicator Component
 *
 * Displays online/offline status and pending sync count.
 * Shows banner notifications based on connection state.
 *
 * States:
 * - Online + Synced: No indicator (clean UI)
 * - Online + Pending: Blue banner with sync count
 * - Offline + No Pending: Yellow banner
 * - Offline + Pending: Orange banner with pending count
 */

import {
  type Component,
  createEffect,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { getOutboxStats } from "@/lib/sync";

export const OfflineIndicator: Component = () => {
  const { localDb, isAnonymous } = useAuth();
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);
  const [pendingCount, setPendingCount] = createSignal(0);
  const [isDismissed, setIsDismissed] = createSignal(false);

  // Monitor online/offline status
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => {
    setIsOnline(false);
    setIsDismissed(false); // Show banner when going offline
  };

  createEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    onCleanup(() => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    });
  });

  // Poll for pending sync count (skip for anonymous users - they don't sync)
  createEffect(() => {
    const db = localDb();
    // In Playwright E2E runs, avoid polling SQLite WASM in the UI.
    // This has caused browser OOMs under heavy parallelism.
    const isE2E =
      typeof window !== "undefined" && !!(window as any).__ttTestApi;

    if (!db || isAnonymous() || isE2E) {
      setPendingCount(0); // Reset count for anonymous users
      return;
    }

    const updateSyncCount = async () => {
      try {
        const stats = await getOutboxStats(db);
        setPendingCount(stats.pending + stats.inProgress);
      } catch (error) {
        console.error("Failed to get sync outbox stats:", error);
      }
    };

    // Update immediately
    updateSyncCount();

    // Poll every 5 seconds
    const interval = setInterval(updateSyncCount, 5000);

    onCleanup(() => clearInterval(interval));
  });

  // Determine banner state (anonymous users: only show offline, not syncing)
  const shouldShowBanner = () => {
    if (isDismissed()) return false;

    const online = isOnline();
    const pending = pendingCount();

    // Anonymous users: only show if offline
    if (isAnonymous()) return !online;

    // Show if offline OR if online with pending changes
    return !online || pending > 0;
  };

  const bannerVariant = () => {
    const online = isOnline();
    const pending = pendingCount();

    if (!online && pending > 0) {
      return "offline-pending"; // Orange
    }
    if (!online && pending === 0) {
      return "offline"; // Yellow
    }
    if (online && pending > 0) {
      return "syncing"; // Blue
    }
    return "none";
  };

  const bannerMessage = () => {
    const variant = bannerVariant();
    const pending = pendingCount();

    switch (variant) {
      case "offline-pending":
        return `Offline. ${pending} change${pending === 1 ? "" : "s"} waiting to sync.`;
      case "offline":
        return "You're offline. Changes will sync when reconnected.";
      case "syncing":
        return `Syncing ${pending} change${pending === 1 ? "" : "s"}...`;
      default:
        return "";
    }
  };

  const bannerStyles = () => {
    const variant = bannerVariant();

    switch (variant) {
      case "offline-pending":
        return "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200";
      case "offline":
        return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200";
      case "syncing":
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200";
      default:
        return "";
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <Show when={shouldShowBanner()}>
      {/* Toast-style notification in top-right corner */}
      <div
        class={`fixed top-20 right-4 z-40 rounded-lg shadow-lg border transition-all duration-300 ${bannerStyles()} max-w-md`}
        role="alert"
        aria-live="polite"
      >
        <div class="px-4 py-3 flex items-center gap-3">
          {/* Status Icon */}
          <Show when={bannerVariant() === "syncing"}>
            <svg
              class="animate-spin h-5 w-5 flex-shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <title>Syncing</title>
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </Show>

          <Show when={!isOnline()}>
            <svg
              class="h-5 w-5 flex-shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <title>Offline</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
          </Show>

          {/* Message */}
          <span class="font-medium text-sm flex-1">{bannerMessage()}</span>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={handleDismiss}
            class="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Dismiss notification"
          >
            <svg
              class="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <title>Close</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </Show>
  );
};
