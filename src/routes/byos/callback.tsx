import { useNavigate } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { createByosProviderManager } from "@/lib/byos/provider-manager";
import { BYOS_PROVIDER_IDS, type ByosProviderId } from "@/lib/byos/types";

function isByosProviderId(value: string | null): value is ByosProviderId {
  return !!value && (BYOS_PROVIDER_IDS as readonly string[]).includes(value);
}

/** Completes provider OAuth and immediately removes its transient URL values. */
export default function ByosCallback() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const [message, setMessage] = createSignal(
    "Finishing storage-provider connection…"
  );

  onMount(async () => {
    const callbackUrl = new URL(globalThis.location.href);
    const providerId = callbackUrl.searchParams.get("provider");
    const currentUser = user();

    if (!currentUser || !isByosProviderId(providerId)) {
      setMessage("The storage-provider connection could not be completed.");
      return;
    }

    try {
      const manager = createByosProviderManager({
        userId: currentUser.id,
        getAppAccessToken: () => session()?.access_token,
      });
      await manager.completeAuthorization(providerId, callbackUrl);
      globalThis.history.replaceState({}, document.title, "/");
      navigate("/", { replace: true });
    } catch (error) {
      globalThis.history.replaceState({}, document.title, "/");
      setMessage(
        error instanceof Error
          ? error.message
          : "The storage-provider connection could not be completed."
      );
    }
  });

  return (
    <main class="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6 text-center">
      <p role="status">{message()}</p>
    </main>
  );
}
