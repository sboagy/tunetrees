import { useNavigate } from "@solidjs/router";
import { createEffect, createSignal } from "solid-js";
import { toast } from "solid-sonner";
import { useUserSettingsDialog } from "@/contexts/UserSettingsDialogContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { readOAuthReturn } from "@/lib/byos/oauth-return";
import { createByosProviderManager } from "@/lib/byos/provider-manager";
import { saveStorageConfig } from "@/lib/byos/provider-selection";

/** Completes provider OAuth and immediately removes its transient URL values. */
export default function ByosCallback() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { openUserSettings } = useUserSettingsDialog();
  const callbackUrl = new URL(location.href);
  // Clean the URL immediately, including when auth bootstrap fails.
  history.replaceState({}, document.title, "/byos/callback");
  const [message, setMessage] = createSignal(
    "Finishing storage-provider connection…"
  );

  let started = false;
  createEffect(() => {
    const userId = auth.user()?.id;
    const db = auth.localDb();
    if (started || auth.loading()) return;
    if (!userId) {
      setMessage(
        "Sign in to the same TuneTrees account to finish storage setup. Your draft remains saved on this device."
      );
      return;
    }
    if (!db || !auth.session()) return;
    started = true;
    const context = readOAuthReturn(
      sessionStorage.getItem("byos-oauth-return"),
      userId,
      callbackUrl.searchParams.get("provider")
    );
    sessionStorage.removeItem("byos-oauth-return");
    if (!context) {
      setMessage(
        "The storage-provider session has expired or belongs to another account. Return to TuneTrees and connect again."
      );
      return;
    }
    void (async () => {
      try {
        const manager = createByosProviderManager({
          userId,
          getAppAccessToken: () =>
            auth.user()?.id === userId
              ? auth.session()?.access_token
              : undefined,
        });
        await manager.completeAuthorization(context.providerId, callbackUrl);
        const folder = await manager.providers[context.providerId].ensureFolder(
          context.folderName,
          context.existingId
        );
        if (auth.user()?.id !== userId) return;
        await saveStorageConfig(db, userId, {
          version: 1,
          providerId: context.providerId,
          folderId: folder.id,
          folderName: folder.name,
        });
        toast.success("Storage connected.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Storage connection failed. Your reference draft has been preserved."
        );
      } finally {
        if (auth.user()?.id === userId) {
          sessionStorage.setItem("byos-restore-draft", userId);
          navigate(context.returnPath, { replace: true });
          openUserSettings("storage-provider");
        }
      }
    })();
  });

  return (
    <main class="mx-auto flex min-h-screen max-w-lg flex-col gap-4 items-center justify-center p-6 text-center">
      <p role="status">{message()}</p>
      <a href="/">Return to TuneTrees</a>
    </main>
  );
}
