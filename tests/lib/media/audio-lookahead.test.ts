import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { syncPinnedAudioVault } from "@/lib/media/audio-lookahead";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/media/media-vault", () => ({
  listMediaVaultKeysByKind: mocks.list,
  getMediaVaultBlob: mocks.read,
  putMediaVaultBlob: mocks.write,
  deleteMediaVaultBlob: mocks.remove,
}));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("fetch", fetchMock);
  mocks.list.mockResolvedValue([]);
  mocks.read.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("legacy lookahead / BYOS cache ownership", () => {
  const run = (urls: string[]) =>
    syncPinnedAudioVault({
      db: {
        all: () => urls.map((url) => ({ url })),
      } as unknown as SqliteDatabase,
      userId: "alice",
      accessToken: "session",
    });
  it("retains private provider caches outside the scheduled pin window", async () => {
    mocks.list.mockResolvedValue([
      "byos:dropbox:id:file",
      "byos:google-drive:file",
    ]);
    expect(await run([])).toEqual({ pinnedCount: 0, removedCount: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("never fetches a BYOS locator with the app's session token", async () => {
    await run(["byos:dropbox:id:file"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("still evicts stale legacy pins", async () => {
    mocks.list.mockResolvedValue([
      "https://worker.example/api/media/view?key=old",
    ]);
    expect(await run([])).toEqual({ pinnedCount: 0, removedCount: 1 });
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(
      "https://worker.example/api/media/view?key=old"
    );
  });
});
