import { createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { toast } from "solid-sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";
import { captureReferenceDraft, safeReturnPath } from "@/lib/byos/draft-store";
import { getLocalRefreshToken } from "@/lib/byos/local-secret-store";
import { createByosProviderManager } from "@/lib/byos/provider-manager";
import {
  getStorageConfig,
  saveStorageConfig,
} from "@/lib/byos/provider-selection";
import {
  DEFAULT_STORAGE_FOLDER,
  validateFolderName,
} from "@/lib/byos/storage-config";
import type { ByosProviderId } from "@/lib/byos/types";

export default function StorageProviderSettings() {
  const auth = useAuth();
  const [providerId, setProviderId] =
    createSignal<ByosProviderId>("google-drive");
  const [folderName, setFolderName] = createSignal(DEFAULT_STORAGE_FOLDER);
  const [busy, setBusy] = createSignal(false);
  const [status, setStatus] = createSignal("Not configured");
  const [config, { refetch }] = createResource(
    () => ({
      userId: auth.user()?.id,
      db: auth.localDb(),
      sync: auth.remoteSyncDownCompletionVersion(),
    }),
    async ({ userId, db }) => {
      if (!userId || !db) return null;
      const saved = getStorageConfig(db, userId);
      if (saved) {
        setProviderId(saved.providerId);
        setFolderName(saved.folderName);
        const token = await getLocalRefreshToken(userId, saved.providerId);
        setStatus(
          token
            ? "Storage configured on this device. Authorization refreshes automatically; reconnect if uploads fail."
            : "Storage configured. Connect this device to upload or download uncached audio."
        );
      }
      return saved;
    }
  );
  const refresh = () => {
    refetch();
  };
  globalThis.addEventListener("byos-settings-changed", refresh);
  onCleanup(() =>
    globalThis.removeEventListener("byos-settings-changed", refresh)
  );
  const label = () =>
    providerId() === "google-drive" ? "Google Drive" : "Dropbox";
  const manager = () =>
    createByosProviderManager({
      userId: auth.user()!.id,
      getAppAccessToken: () => auth.session()?.access_token,
    });

  const save = async (authorize: boolean) => {
    const userId = auth.user()?.id;
    const db = auth.localDb();
    if (!userId || !db) return;
    setBusy(true);
    try {
      const name = validateFolderName(folderName());
      const provider = manager().providers[providerId()];
      if (!provider.isConfigured())
        throw new Error(`${label()} is not configured for this environment.`);
      const previous = config();
      const existingId =
        previous?.providerId === providerId() && previous.folderName === name
          ? previous.folderId
          : undefined;
      if (authorize) {
        await captureReferenceDraft();
        sessionStorage.setItem("byos-restore-draft", userId);
        sessionStorage.setItem(
          "byos-oauth-return",
          JSON.stringify({
            userId,
            providerId: providerId(),
            folderName: name,
            existingId,
            returnPath: safeReturnPath(location.href),
            createdAt: Date.now(),
          })
        );
        await manager().beginAuthorization(providerId());
      } else {
        const folder = await provider.ensureFolder(name, existingId);
        if (auth.user()?.id !== userId) return;
        await saveStorageConfig(db, userId, {
          version: 1,
          providerId: providerId(),
          folderId: folder.id,
          folderName: folder.name,
        });
        setStatus(`Connected to ${label()}. Folder: ${folder.name}`);
        toast.success("Storage settings saved.");
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Storage setup failed."
      );
      toast.error(status());
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      class="space-y-4 text-foreground"
      data-testid="byos-provider-connection"
    >
      <h3 class="text-lg font-semibold">Storage provider</h3>
      <p class="text-sm text-muted-foreground">
        Choose where new audio files are stored. Connect once on each device.
      </p>
      <fieldset disabled={busy()} class="space-y-2">
        <legend class="text-sm font-medium">Provider</legend>
        <For
          each={[
            { id: "google-drive" as const, label: "Google Drive" },
            { id: "dropbox" as const, label: "Dropbox" },
          ]}
        >
          {(provider) => (
            <label
              for={`byos-provider-${provider.id}`}
              class="flex min-h-11 items-center gap-2"
            >
              <input
                id={`byos-provider-${provider.id}`}
                type="radio"
                name="storage-provider"
                value={provider.id}
                checked={providerId() === provider.id}
                onChange={() => {
                  setProviderId(provider.id);
                  setStatus("Connect this provider or save its destination.");
                }}
                data-testid={`byos-provider-${provider.id}`}
              />
              {provider.label}
            </label>
          )}
        </For>
        <label for="byos-folder-name" class="block text-sm font-medium">
          <span>Folder name</span>
          <input
            id="byos-folder-name"
            data-testid="byos-folder-name"
            class="mt-2 block w-full rounded border border-input bg-background p-2 text-base font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={folderName()}
            onInput={(e) => setFolderName(e.currentTarget.value)}
          />
        </label>
        <p class="text-sm text-muted-foreground">
          Changing the destination affects future uploads. Existing audio stays
          where it is.
        </p>
        <Show when={providerId() === "dropbox"}>
          <p class="text-sm text-muted-foreground">
            This folder is inside the TuneTrees Dropbox app folder.
          </p>
        </Show>
      </fieldset>
      <output class="block" data-testid="byos-connection-status">
        {busy() ? "Configuring storage…" : status()}
      </output>
      <div class="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          class="text-foreground"
          disabled={busy() || !auth.localDb()}
          onClick={() => save(true)}
          data-testid="byos-provider-connect"
        >
          {config()?.providerId === providerId() ? "Reconnect" : "Connect"}{" "}
          {label()}
        </Button>
        <Button
          disabled={busy() || !auth.localDb()}
          onClick={() => save(false)}
          data-testid="byos-storage-save"
        >
          Save storage settings
        </Button>
      </div>
    </section>
  );
}
