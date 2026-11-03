import type { MediaAsset } from "@/lib/db/queries/media-assets";
import { getMediaVaultBlob, putMediaVaultBlob } from "@/lib/media/media-vault";
import { type ByosProviderOptions, createByosProviders } from "./providers";
import type { ByosProviderId } from "./types";

function isByosProviderId(value: string | null): value is ByosProviderId {
  return value === "google-drive" || value === "dropbox";
}

/**
 * Ensures an authenticated BYOS file is locally cached before opening the
 * unchanged Wavesurfer pipeline. The returned synthetic locator is a media
 * vault key, never a provider URL or token.
 */
export async function resolveByosAudioForPlayback(
  asset: MediaAsset,
  options: ByosProviderOptions
) {
  if (
    asset.storageKind !== "byos" ||
    !isByosProviderId(asset.byosProvider) ||
    !asset.providerFileId
  ) {
    throw new Error("This audio item has an invalid BYOS locator.");
  }

  const cachedBlob = await getMediaVaultBlob(asset.storagePath);
  if (cachedBlob) {
    return asset.storagePath;
  }

  const providers = createByosProviders(options);
  const blob = await providers[asset.byosProvider].resolveBlob(
    asset.providerFileId
  );
  await putMediaVaultBlob(asset.storagePath, blob);
  return asset.storagePath;
}
