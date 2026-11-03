import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createByosProviders } from "@/lib/byos/providers";

vi.mock("@/lib/byos/local-secret-store", () => ({
  getLocalRefreshToken: vi.fn(async () => "local-refresh"),
  putLocalRefreshToken: vi.fn(),
  deleteLocalRefreshToken: vi.fn(),
}));
const options = { userId: "alice", getAppAccessToken: () => "app-token" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
let request: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  request = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());

describe("Google folder and upload contract", () => {
  beforeEach(() =>
    request.mockResolvedValueOnce(
      json({ token: { accessToken: "google-token" } })
    )
  );
  it("creates a named folder when none is app-accessible", async () => {
    request
      .mockResolvedValueOnce(json({ files: [] }))
      .mockResolvedValueOnce(json({ id: "folder-1", name: "Music" }));
    expect(
      await createByosProviders(options)["google-drive"].ensureFolder("Music")
    ).toEqual({ id: "folder-1", name: "Music" });
    expect(JSON.parse(String(request.mock.calls[2][1]?.body))).toEqual({
      name: "Music",
      mimeType: "application/vnd.google-apps.folder",
    });
  });
  it("reuses an existing folder by stable ID after a rename", async () => {
    request.mockResolvedValueOnce(
      json({
        id: "folder-1",
        name: "Renamed",
        mimeType: "application/vnd.google-apps.folder",
      })
    );
    expect(
      await createByosProviders(options)["google-drive"].ensureFolder(
        "Music",
        "folder-1"
      )
    ).toEqual({ id: "folder-1", name: "Renamed" });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("rejects ambiguous names without creating another folder", async () => {
    request.mockResolvedValueOnce(json({ files: [{ id: "a" }, { id: "b" }] }));
    await expect(
      createByosProviders(options)["google-drive"].ensureFolder("Music")
    ).rejects.toThrow("Multiple storage folders");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("does not fall back to root when the saved folder is deleted", async () => {
    request.mockResolvedValueOnce(
      json({
        id: "folder-1",
        mimeType: "application/vnd.google-apps.folder",
        trashed: true,
      })
    );
    await expect(
      createByosProviders(options)["google-drive"].upload(
        new File(["a"], "a.mp3"),
        { folderId: "folder-1", uploadId: "upload-1" }
      )
    ).rejects.toThrow("unavailable");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("sets the parent and stable upload ID on a direct upload", async () => {
    request
      .mockResolvedValueOnce(
        json({
          id: "folder-1",
          name: "Music",
          mimeType: "application/vnd.google-apps.folder",
        })
      )
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { Location: "https://www.googleapis.com/upload/session" },
        })
      )
      .mockResolvedValueOnce(json({ id: "upload-1", size: "1" }));
    const file = new File(["a"], "a.mp3", { type: "audio/mpeg" });
    await createByosProviders(options)["google-drive"].upload(file, {
      folderId: "folder-1",
      uploadId: "upload-1",
    });
    expect(JSON.parse(String(request.mock.calls[3][1]?.body))).toMatchObject({
      id: "upload-1",
      parents: ["folder-1"],
    });
    expect(request.mock.calls[4][1]?.body).toBe(file);
  });
  it("reuses a completed upload after its response was lost", async () => {
    request
      .mockResolvedValueOnce(
        json({ id: "folder-1", mimeType: "application/vnd.google-apps.folder" })
      )
      .mockResolvedValueOnce(json({ id: "upload-1", size: "1" }));
    const result = await createByosProviders(options)["google-drive"].upload(
      new File(["a"], "a.mp3"),
      { folderId: "folder-1", uploadId: "upload-1" }
    );
    expect(result.fileId).toBe("upload-1");
    expect(request).toHaveBeenCalledTimes(3);
  });
});

describe("Dropbox folder and upload contract", () => {
  beforeEach(() =>
    request.mockResolvedValueOnce(json({ access_token: "dropbox-token" }))
  );
  it("creates a subfolder in the app's namespace", async () => {
    request
      .mockResolvedValueOnce(json({ error_summary: "path/not_found/..." }, 409))
      .mockResolvedValueOnce(
        json({ metadata: { id: "id:folder", name: "Music" } })
      );
    expect(
      await createByosProviders(options).dropbox.ensureFolder("Music")
    ).toEqual({ id: "id:folder", name: "Music" });
    expect(JSON.parse(String(request.mock.calls[2][1]?.body))).toEqual({
      path: "/Music",
      autorename: false,
    });
  });
  it("does not create a replacement when an existing folder is inaccessible", async () => {
    request.mockResolvedValueOnce(
      json({ error_summary: "path/not_found/..." }, 409)
    );
    await expect(
      createByosProviders(options).dropbox.ensureFolder("Music", "id:folder")
    ).rejects.toThrow("unavailable");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("uploads below the stable folder ID with an idempotent destination", async () => {
    request
      .mockResolvedValueOnce(
        json({ id: "id:folder", name: "Renamed", ".tag": "folder" })
      )
      .mockResolvedValueOnce(json({ id: "id:file", size: 1 }));
    await createByosProviders(options).dropbox.upload(
      new File(["a"], "a.mp3"),
      { folderId: "id:folder", uploadId: "unique" }
    );
    const headers = request.mock.calls[2][1]?.headers as Record<string, string>;
    expect(JSON.parse(headers["Dropbox-API-Arg"])).toMatchObject({
      path: "id:folder/unique-a.mp3",
      mode: "overwrite",
      autorename: false,
    });
  });
});
