import { createEffect, onCleanup } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { replayAudioDrafts } from "@/lib/byos/upload-queue";

/** Runs even when the references sidebar is closed. Files never enter sync. */
export function ByosUploadMaintenance() {
  const auth = useAuth();
  createEffect(() => {
    const userId = auth.user()?.id;
    const db = auth.localDb();
    if (!userId || !db) return;
    let current = true;
    const retry = () => {
      if (!navigator.onLine || !auth.session()) return;
      void replayAudioDrafts(
        db,
        {
          userId,
          getAppAccessToken: () =>
            auth.user()?.id === userId
              ? auth.session()?.access_token
              : undefined,
        },
        () => current && auth.user()?.id === userId
      ).catch(() => {
        /* Persisted drafts remain available for manual retry. */
      });
    };
    for (const event of [
      "online",
      "byos-settings-changed",
      "byos-retry-uploads",
    ])
      window.addEventListener(event, retry);
    const interval = setInterval(retry, 30_000);
    retry();
    onCleanup(() => {
      current = false;
      clearInterval(interval);
      for (const event of [
        "online",
        "byos-settings-changed",
        "byos-retry-uploads",
      ])
        window.removeEventListener(event, retry);
    });
  });
  return null;
}
