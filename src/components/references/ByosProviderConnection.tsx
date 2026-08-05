import {
  type Component,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";
import { createByosProviderManager } from "@/lib/byos/provider-manager";
import {
  getSelectedByosProvider,
  setSelectedByosProvider,
} from "@/lib/byos/provider-selection";
import type { ByosProviderId } from "@/lib/byos/types";
import { getDb } from "@/lib/db/client-sqlite";

const PROVIDERS: Array<{ id: ByosProviderId; label: string }> = [
  { id: "google-drive", label: "Google Drive" },
  { id: "dropbox", label: "Dropbox" },
];

/** Provider selection is synced; authorization is intentionally device-local. */
export const ByosProviderConnection: Component = () => {
  const { session, user } = useAuth();
  const [selectedProvider, setSelectedProvider] =
    createSignal<ByosProviderId | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isConnecting, setIsConnecting] = createSignal(false);

  const [storedProvider, { refetch }] = createResource(
    () => user()?.id,
    async (userId) => {
      if (!userId) return null;
      const provider = await getSelectedByosProvider(getDb(), userId);
      setSelectedProvider(provider);
      return provider;
    }
  );

  const currentProvider = () => selectedProvider() ?? storedProvider() ?? null;
  const manager = () => {
    const currentUser = user();
    if (!currentUser) return null;
    return createByosProviderManager({
      userId: currentUser.id,
      getAppAccessToken: () => session()?.access_token,
    });
  };

  const chooseProvider = async (providerId: ByosProviderId) => {
    const currentUser = user();
    if (!currentUser) return;
    setIsSaving(true);
    try {
      await setSelectedByosProvider(getDb(), currentUser.id, providerId);
      setSelectedProvider(providerId);
      await refetch();
    } catch {
      toast.error("Could not save your storage-provider selection.");
    } finally {
      setIsSaving(false);
    }
  };

  const connect = async () => {
    const providerId = currentProvider();
    const currentManager = manager();
    if (!providerId || !currentManager) {
      toast.error("Choose a storage provider before connecting.");
      return;
    }
    if (!currentManager.providers[providerId].isConfigured()) {
      toast.error(
        `${currentManager.providers[providerId].label} is not configured yet.`
      );
      return;
    }
    setIsConnecting(true);
    try {
      await currentManager.beginAuthorization(providerId);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not begin storage-provider authorization."
      );
      setIsConnecting(false);
    }
  };

  return (
    <section
      class="rounded-md border p-3"
      data-testid="byos-provider-connection"
    >
      <p class="text-sm font-medium">Storage provider</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Audio files upload directly to your provider. Authorization stays on
        this device.
      </p>
      <div class="mt-2 flex flex-wrap gap-2">
        <For each={PROVIDERS}>
          {(provider) => (
            <Button
              type="button"
              size="sm"
              variant={
                currentProvider() === provider.id ? "default" : "outline"
              }
              disabled={isSaving()}
              onClick={() => void chooseProvider(provider.id)}
              data-testid={`byos-provider-${provider.id}`}
            >
              {provider.label}
            </Button>
          )}
        </For>
      </div>
      <Show when={currentProvider()}>
        <Button
          type="button"
          size="sm"
          class="mt-2"
          disabled={isConnecting()}
          onClick={() => void connect()}
          data-testid="byos-provider-connect"
        >
          {isConnecting() ? "Connecting…" : "Connect this device"}
        </Button>
      </Show>
    </section>
  );
};
