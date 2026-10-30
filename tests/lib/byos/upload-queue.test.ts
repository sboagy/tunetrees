import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioDraft } from "@/lib/byos/draft-store";
import { replayAudioDrafts } from "@/lib/byos/upload-queue";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";

const mocks = vi.hoisted(() => ({
  drafts: new Map<string, AudioDraft>(),
  upload: vi.fn(),
  reserve: vi.fn(),
  persist: vi.fn(),
}));
vi.mock("@/lib/db/client-sqlite", () => ({ persistDb: mocks.persist }));
vi.mock("@/lib/byos/providers", () => ({
  createByosProviders: () => ({
    "google-drive": { upload: mocks.upload, reserveUploadId: mocks.reserve },
  }),
}));
vi.mock("@/lib/byos/draft-store", () => ({
  listAudioDrafts: async (userId: string) =>
    [...mocks.drafts.values()].filter((d) => d.userId === userId),
  getAudioDraft: async (userId: string, id: string) =>
    mocks.drafts.get(`${userId}:${id}`),
  updateAudioDraft: async (draft: AudioDraft) => {
    const key = `${draft.userId}:${draft.id}`;
    if (!mocks.drafts.has(key)) return false;
    mocks.drafts.set(key, draft);
    return true;
  },
  deleteAudioDraft: async (userId: string, id: string) =>
    mocks.drafts.delete(`${userId}:${id}`),
}));

let sqlite: InstanceType<typeof Database>;
let db: SqliteDatabase;
const options = { userId: "alice", getAppAccessToken: () => "token" };
function queue(id = "draft-1", userId = "alice") {
  const draft: AudioDraft = {
    id,
    userId,
    tuneId: "tune-1",
    destination: {
      version: 1,
      providerId: "google-drive",
      folderId: "original-folder",
      folderName: "Music",
    },
    fields: {
      url: "",
      title: "Practice",
      comment: "",
      refType: "audio",
      sourceMode: "upload",
      uploadFile: new File(["a"], "a.mp3", { type: "audio/mpeg" }),
      public: false,
      favorite: false,
    },
  };
  mocks.drafts.set(`${userId}:${id}`, draft);
  return draft;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.drafts.clear();
  mocks.persist.mockResolvedValue(undefined);
  mocks.reserve.mockResolvedValue("remote-id");
  mocks.upload.mockResolvedValue({
    fileId: "remote-id",
    fileName: "a.mp3",
    contentType: "audio/mpeg",
    size: 1,
  });
  vi.stubGlobal("navigator", {
    onLine: true,
    locks: {
      request: async (
        _name: string,
        _options: object,
        callback: (lock: object) => Promise<void>
      ) => callback({}),
    },
  });
  sqlite = new Database(":memory:");
  sqlite.exec(`CREATE TABLE reference (id TEXT PRIMARY KEY, url TEXT, ref_type TEXT, tune_ref TEXT, user_ref TEXT, comment TEXT, title TEXT, public INTEGER, favorite INTEGER, deleted INTEGER, display_order INTEGER DEFAULT 0, sync_version INTEGER, last_modified_at TEXT, device_id TEXT);
    CREATE TABLE media_asset (id TEXT PRIMARY KEY, reference_ref TEXT UNIQUE, user_ref TEXT, storage_path TEXT UNIQUE, original_filename TEXT, content_type TEXT, file_size_bytes INTEGER, duration_seconds REAL, regions_json TEXT, deleted INTEGER, storage_kind TEXT, byos_provider TEXT, provider_file_id TEXT, public_url TEXT, locator_version INTEGER DEFAULT 1, sync_version INTEGER, last_modified_at TEXT, device_id TEXT);`);
  db = drizzle(sqlite) as unknown as SqliteDatabase;
});
afterEach(() => {
  sqlite.close();
  vi.unstubAllGlobals();
});

describe("durable BYOS upload queue", () => {
  it.each(["unsupported", "oversized"])(
    "rejects %s files before upload or synced metadata creation",
    async (kind) => {
      const draft = queue();
      const files = {
        unsupported: new File(["audio"], "recording.ogg", {
          type: "audio/ogg",
        }),
        oversized: new File(["audio"], "recording.mp3", { type: "audio/mpeg" }),
      };
      Object.defineProperty(files.oversized, "size", {
        value: 50 * 1024 * 1024 + 1,
      });
      draft.fields.uploadFile = files[kind as keyof typeof files];
      await replayAudioDrafts(db, options, () => true);
      expect(mocks.reserve).not.toHaveBeenCalled();
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(
        sqlite.prepare("SELECT count(*) AS count FROM reference").get()
      ).toEqual({ count: 0 });
      expect(
        sqlite.prepare("SELECT count(*) AS count FROM media_asset").get()
      ).toEqual({ count: 0 });
      expect(mocks.drafts.size).toBe(1);
    }
  );

  it("writes only locator metadata, never draft bytes or extra credential fields", async () => {
    const draft = queue();
    draft.fields.uploadFile = new File(["PRIVATE_BINARY_SENTINEL"], "a.mp3", {
      type: "audio/mpeg",
    });
    mocks.upload.mockResolvedValueOnce({
      fileId: "remote-id",
      fileName: "a.mp3",
      contentType: "audio/mpeg",
      size: 23,
      accessToken: "PRIVATE_ACCESS_SENTINEL",
      refreshToken: "PRIVATE_REFRESH_SENTINEL",
    });
    await replayAudioDrafts(db, options, () => true);
    const records = JSON.stringify({
      references: sqlite.prepare("SELECT * FROM reference").all(),
      assets: sqlite.prepare("SELECT * FROM media_asset").all(),
    });
    expect(records).toContain("byos:google-drive:remote-id");
    expect(records).not.toMatch(/PRIVATE_(BINARY|ACCESS|REFRESH)_SENTINEL/);
  });

  it("creates one reference and asset after upload, then removes the draft", async () => {
    queue();
    await replayAudioDrafts(db, options, () => true);
    expect(sqlite.prepare("SELECT url, title FROM reference").all()).toEqual([
      { url: "byos:google-drive:remote-id", title: "Practice" },
    ]);
    expect(
      sqlite.prepare("SELECT count(*) AS count FROM media_asset").get()
    ).toEqual({ count: 1 });
    expect(mocks.drafts.size).toBe(0);
  });
  it("keeps an offline draft without contacting the provider", async () => {
    queue();
    Object.defineProperty(navigator, "onLine", { value: false });
    await replayAudioDrafts(db, options, () => true);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.drafts.size).toBe(1);
  });
  it("never uploads an unsaved OAuth snapshot", async () => {
    queue("oauth");
    await replayAudioDrafts(db, options, () => true);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("does not read or upload another user's drafts", async () => {
    queue("draft", "bob");
    await replayAudioDrafts(db, options, () => true);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("keeps the original destination pinned during replay", async () => {
    queue();
    await replayAudioDrafts(db, options, () => true);
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        folderId: "original-folder",
        uploadId: "remote-id",
      })
    );
  });
  it("retains failures for retry and creates no remote metadata", async () => {
    queue();
    mocks.upload.mockRejectedValueOnce(new Error("revoked"));
    await replayAudioDrafts(db, options, () => true);
    expect(mocks.drafts.get("alice:draft-1")?.error).toContain(
      "Upload waiting"
    );
    expect(
      sqlite.prepare("SELECT count(*) AS count FROM reference").get()
    ).toEqual({ count: 0 });
  });
  it("retries persistence without a duplicate upload or reference", async () => {
    queue();
    mocks.persist.mockRejectedValueOnce(new Error("disk full"));
    await replayAudioDrafts(db, options, () => true);
    await replayAudioDrafts(db, options, () => true);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(
      sqlite.prepare("SELECT count(*) AS count FROM reference").get()
    ).toEqual({ count: 1 });
    expect(mocks.drafts.size).toBe(0);
  });
  it("stops before upload when the active account changes", async () => {
    queue();
    let current = true;
    mocks.reserve.mockImplementationOnce(async () => {
      current = false;
      return "remote-id";
    });
    await replayAudioDrafts(db, options, () => current);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("does not resurrect a draft cancelled in another tab during preparation", async () => {
    queue();
    mocks.reserve.mockImplementationOnce(async () => {
      mocks.drafts.clear();
      return "remote-id";
    });
    await replayAudioDrafts(db, options, () => true);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.drafts.size).toBe(0);
  });
});
