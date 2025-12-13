/**
 * PWA Update Prompt Component
 *
 * Displays a toast notification when a new version of the app is available.
 * Allows users to immediately update by reloading the page with the new service worker.
 *
 * Uses vite-plugin-pwa's useRegisterSW hook for detecting and applying updates.
 */

import {
  type Component,
  createEffect,
  onMount,
  createSignal,
  onCleanup,
} from "solid-js";
import { toast } from "solid-sonner";

// Duration for persistent toast (doesn't auto-dismiss)
const PERSISTENT_TOAST_DURATION = Number.POSITIVE_INFINITY;

export const UpdatePrompt: Component = () => {
  // In dev mode, don't render anything
  if (import.meta.env.DEV) {
    return null;
  }

  const [toastShown, setToastShown] = createSignal(false);

  onMount(async () => {
    try {
      // Dynamic import only in production
      const { useRegisterSW } = await import("virtual:pwa-register/solid");

      // Store interval ID for cleanup
      let updateCheckInterval: number | undefined;

      // Register SW and get update state
      const {
        needRefresh: [needRefresh],
        updateServiceWorker,
      } = useRegisterSW({
        onRegistered(registration: ServiceWorkerRegistration | undefined) {
          console.log("[PWA] Service Worker registered:", registration);
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

      // Cleanup interval on component unmount
      onCleanup(() => {
        if (updateCheckInterval !== undefined) {
          clearInterval(updateCheckInterval);
        }
      });

      // Show toast when update is available (only once)
      createEffect(() => {
        if (needRefresh() && !toastShown()) {
          console.log("[PWA] New version available, showing update prompt");
          setToastShown(true);

          // Show a toast with update action
          toast("New version available", {
            description: "Click Update to refresh and get the latest features.",
            duration: PERSISTENT_TOAST_DURATION,
            action: {
              label: "Update",
              onClick: async () => {
                console.log("[PWA] User clicked Update, reloading...");
                await updateServiceWorker(true);
              },
            },
            cancel: {
              label: "Dismiss",
              onClick: () => {
                console.log("[PWA] User dismissed update prompt");
              },
            },
          });
        }
      });
    } catch (error) {
      console.error("[PWA] Failed to load update prompt module:", error);
    }
  });

  // This component doesn't render anything - it only shows toasts
  return null;
};
