import { type ByosProviderOptions, createByosProviders } from "./providers";
import type { ByosConnectionStatus, ByosProviderId } from "./types";

export const BYOS_CALLBACK_PATH = "/byos/callback";

export function buildByosRedirectUri(providerId: ByosProviderId) {
  const url = new URL(BYOS_CALLBACK_PATH, globalThis.location.origin);
  url.searchParams.set("provider", providerId);
  return url.toString();
}

/**
 * Coordinates provider adapters without making tokens part of application
 * state. The owner supplies the authenticated TuneTrees session only when the
 * Google Worker proxy needs to authenticate a token exchange.
 */
export function createByosProviderManager(options: ByosProviderOptions) {
  const providers = createByosProviders(options);

  return {
    providers,
    beginAuthorization(providerId: ByosProviderId) {
      return providers[providerId].beginAuthorization(
        buildByosRedirectUri(providerId)
      );
    },
    completeAuthorization(
      providerId: ByosProviderId,
      callbackUrl = new URL(globalThis.location.href)
    ): Promise<ByosConnectionStatus> {
      return providers[providerId].completeAuthorization(
        callbackUrl,
        buildByosRedirectUri(providerId)
      );
    },
  };
}
