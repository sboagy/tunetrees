import { afterEach, describe, expect, it, vi } from "vitest";
import * as mediaVault from "../../../src/lib/media/media-vault";
import {
  buildOfflineNoteMediaDraftUrl,
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
});
