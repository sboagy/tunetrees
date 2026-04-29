import { afterEach, describe, expect, it, vi } from "vitest";
import * as clientSqlite from "../../../src/lib/db/client-sqlite";
import * as mediaDraftOutbox from "../../../src/lib/db/queries/media-draft-outbox";
import * as mediaVault from "../../../src/lib/media/media-vault";
import {
  buildOfflineNoteMediaDraftUrl,
  processPendingNoteMediaDrafts,
  persistOfflineNoteMediaDraftUrlsInHtml,
  resolveOfflineNoteMediaDraftUrlsInHtml,
} from "../../../src/lib/media/offline-note-media";

describe("offline note media draft helpers", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it("replaces known blob URLs with stable draft references before note HTML is saved", () => {
    const html = '<p><img src="blob:offline-note-image"></p>';

    expect(
      persistOfflineNoteMediaDraftUrlsInHtml(
        html,
        new Map([
          ["blob:offline-note-image", buildOfflineNoteMediaDraftUrl("draft-1")],
        ])
      )
    ).toBe('<p><img src="tunetrees-note-media-draft://draft-1"></p>');
  });

  it("rehydrates stored draft references into fresh blob URLs for display", async () => {
    const createObjectUrlMock = vi.fn(() => "blob:rehydrated-offline-note");
    const revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    vi.spyOn(mediaVault, "getMediaDraft").mockResolvedValue({
      id: "draft-1",
      blobUrl: "blob:legacy-offline-note",
      blob: new Blob(["image-bytes"], { type: "image/png" }),
      fileName: "offline.png",
      contentType: "image/png",
      createdAt: new Date().toISOString(),
    });

    const resolved = await resolveOfflineNoteMediaDraftUrlsInHtml(
      '<p><img src="tunetrees-note-media-draft://draft-1"></p>'
    );

    expect(resolved.html).toBe(
      '<p><img src="blob:rehydrated-offline-note"></p>'
    );
    expect(
      resolved.displayUrlByDraftUrl.get(
        buildOfflineNoteMediaDraftUrl("draft-1")
      )
    ).toBe("blob:rehydrated-offline-note");

    resolved.revoke();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith(
      "blob:rehydrated-offline-note"
    );
  });

  it("revokes partially created blob URLs if draft resolution fails mid-stream", async () => {
    const createObjectUrlMock = vi
      .fn()
      .mockReturnValueOnce("blob:rehydrated-draft-1");
    const revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    vi.spyOn(mediaVault, "getMediaDraft")
      .mockResolvedValueOnce({
        id: "draft-1",
        blobUrl: "blob:legacy-offline-note-1",
        blob: new Blob(["image-bytes-1"], { type: "image/png" }),
        fileName: "offline-1.png",
        contentType: "image/png",
        createdAt: new Date().toISOString(),
      })
      .mockRejectedValueOnce(new Error("IndexedDB blocked"));

    await expect(
      resolveOfflineNoteMediaDraftUrlsInHtml(
        '<p><img src="tunetrees-note-media-draft://draft-1"></p><p><img src="tunetrees-note-media-draft://draft-2"></p>'
      )
    ).rejects.toThrow("IndexedDB blocked");

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:rehydrated-draft-1");
  });

  it("persists note rewrites after replacing offline draft URLs with uploaded URLs", async () => {
    const persistDbSpy = vi
      .spyOn(clientSqlite, "persistDb")
      .mockResolvedValue(undefined);
    vi.spyOn(mediaDraftOutbox, "listMediaDraftUploads").mockResolvedValue([
      {
        id: "draft-1",
        userRef: "user-1",
        blobUrl: "tunetrees-note-media-draft://draft-1",
        fileName: "offline.png",
        contentType: "image/png",
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.spyOn(mediaDraftOutbox, "deleteMediaDraftUpload").mockResolvedValue(
      undefined
    );
    vi.spyOn(mediaVault, "getMediaDraft").mockResolvedValue({
      id: "draft-1",
      blobUrl: "blob:legacy-offline-note",
      blob: new Blob(["image-bytes"], { type: "image/png" }),
      fileName: "offline.png",
      contentType: "image/png",
      createdAt: new Date().toISOString(),
    });
    vi.spyOn(mediaVault, "deleteMediaDraft").mockResolvedValue(undefined);

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              files: ["https://cdn.example.com/media/offline.png"],
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
    );
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    const db = {
      all: vi.fn(async () => [
        {
          id: "note-1",
          noteText:
            '<p><img src="tunetrees-note-media-draft://draft-1"></p><p><img src="blob:legacy-offline-note"></p>',
        },
      ]),
      run: vi.fn(async () => undefined),
    };

    await processPendingNoteMediaDrafts({
      db: db as never,
      userId: "user-1",
      accessToken: "test-token",
    });

    expect(db.run).toHaveBeenCalledTimes(1);
    expect(persistDbSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
  });
});
