/**
 * PWA Update Prompt Component
 *
 * Displays a toast notification when a new version of the app is available.
 * Allows users to immediately update by reloading the page with the new service worker.
 *
 * Uses vite-plugin-pwa's useRegisterSW hook for detecting and applying updates.
 */

import { type Component, createEffect, onMount, createSignal } from "solid-js";
import { toast } from "solid-sonner";

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

      // Register SW and get update state
      const {
        needRefresh: [needRefresh],
        updateServiceWorker,
      } = useRegisterSW({
        onRegistered(registration: ServiceWorkerRegistration | undefined) {
          console.log("[PWA] Service Worker registered:", registration);
          // Check for updates every hour
          setInterval(
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

      // Show toast when update is available (only once)
      createEffect(() => {
        if (needRefresh() && !toastShown()) {
          console.log("[PWA] New version available, showing update prompt");
          setToastShown(true);

          // Show a toast with update action
          toast("New version available", {
            description: "Click Update to refresh and get the latest features.",
            duration: Number.POSITIVE_INFINITY, // Don't auto-dismiss
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
