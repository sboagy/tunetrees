import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveByosAudioForPlayback } from "@/lib/byos/audio";
import type { MediaAsset } from "@/lib/db/queries/media-assets";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  download: vi.fn(),
  providers: vi.fn(),
}));
vi.mock("@/lib/media/media-vault", () => ({
  getMediaVaultBlob: mocks.read,
  putMediaVaultBlob: mocks.write,
}));
vi.mock("@/lib/byos/providers", () => ({
  createByosProviders: mocks.providers,
}));
const options = { userId: "alice", getAppAccessToken: () => "session" };
const asset: MediaAsset = {
  id: "asset",
  referenceRef: "reference",
  userRef: "alice",
  storagePath: "byos:dropbox:id:audio",
  originalFilename: "audio.wav",
  contentType: "audio/wav",
  fileSizeBytes: 5,
  durationSeconds: null,
  regionsJson: null,
  deleted: 0,
  storageKind: "byos",
  byosProvider: "dropbox",
  providerFileId: "id:audio",
  publicUrl: null,
  locatorVersion: 1,
  syncVersion: 1,
  lastModifiedAt: "2026-01-01",
  deviceId: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(null);
  mocks.write.mockResolvedValue(undefined);
  mocks.providers.mockReturnValue({ dropbox: { resolveBlob: mocks.download } });
});

describe("private audio cache and unavailable behavior", () => {
  it("opens cached audio without credentials or a provider request", async () => {
    mocks.read.mockResolvedValue(new Blob(["audio"]));
    expect(await resolveByosAudioForPlayback(asset, options)).toBe(
      asset.storagePath
    );
    expect(mocks.providers).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("caches authenticated bytes under an opaque locator, not a token URL", async () => {
    const blob = new Blob(["audio"]);
    mocks.download.mockResolvedValue(blob);
    expect(await resolveByosAudioForPlayback(asset, options)).toBe(
      asset.storagePath
    );
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith("id:audio");
    expect(mocks.write).toHaveBeenCalledExactlyOnceWith(
      asset.storagePath,
      blob
    );
  });

  it.each([
    "offline",
    "Connect this storage provider",
    "File unavailable",
  ])("does not cache failed downloads or automatically authorize: %s", async (message) => {
    mocks.download.mockRejectedValue(new Error(message));
    await expect(resolveByosAudioForPlayback(asset, options)).rejects.toThrow(
      message
    );
    expect(mocks.download).toHaveBeenCalledTimes(1);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it.each([
    { storageKind: "r2" },
    { byosProvider: "unknown" },
    { providerFileId: null },
  ])("does not route invalid or legacy locators through a BYOS provider: %j", async (override) => {
    await expect(
      resolveByosAudioForPlayback({ ...asset, ...override }, options)
    ).rejects.toThrow("invalid BYOS locator");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.providers).not.toHaveBeenCalled();
  });
});
