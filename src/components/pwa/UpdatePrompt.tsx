/**
 * PWA Update Prompt Component
 *
 * Displays a toast notification when a new version of the app is available.
 * Allows users to immediately update by reloading the page with the new service worker.
 *
 * Uses the usePWAUpdate hook to detect and apply updates.
 */

import { type Component, createEffect, createSignal } from "solid-js";
import { toast } from "solid-sonner";
import { usePWAUpdate } from "@/lib/hooks/usePWAUpdate";

// Duration for persistent toast (doesn't auto-dismiss)
const PERSISTENT_TOAST_DURATION = Number.POSITIVE_INFINITY;

export const UpdatePrompt: Component = () => {
  // In dev mode, don't render anything
  if (import.meta.env.DEV) {
    return null;
  }

  const [toastShown, setToastShown] = createSignal(false);
  const { needRefresh, updateServiceWorker } = usePWAUpdate();

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

  // This component doesn't render anything - it only shows toasts
  return null;
};
