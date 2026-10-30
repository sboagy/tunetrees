import { describe, expect, it } from "vitest";
import { readOAuthReturn } from "@/lib/byos/oauth-return";
import {
  parseStorageConfig,
  validateFolderName,
} from "@/lib/byos/storage-config";

describe("BYOS storage setup", () => {
  it("does not treat an old provider selection as completed setup", () =>
    expect(parseStorageConfig(null)).toBeNull());
  it("rejects malformed setup", () =>
    expect(
      parseStorageConfig('{"version":1,"providerId":"google-drive"}')
    ).toBeNull());
  it("keeps only non-secret setup fields", () =>
    expect(
      parseStorageConfig(
        JSON.stringify({
          version: 1,
          providerId: "google-drive",
          folderId: "folder",
          folderName: "Music",
          token: "must-not-sync",
        })
      )
    ).toEqual({
      version: 1,
      providerId: "google-drive",
      folderId: "folder",
      folderName: "Music",
    }));
  it.each(["", "../other", "a/b", "a\\b", ".", "..", "a\n", "a".repeat(101)])(
    "rejects invalid folder name %j",
    (name) => expect(() => validateFolderName(name)).toThrow()
  );
  it("trims a valid folder name", () =>
    expect(validateFolderName(" My Music ")).toBe("My Music"));
});

describe("OAuth return ownership and route validation", () => {
  const context = () => ({
    userId: "alice",
    providerId: "google-drive",
    folderName: "Music",
    returnPath: "/?tab=catalog",
    createdAt: Date.now(),
  });
  it("restores the original internal path", () =>
    expect(
      readOAuthReturn(JSON.stringify(context()), "alice", "google-drive")
        ?.returnPath
    ).toBe("/?tab=catalog"));
  it("rejects another user's pending setup", () =>
    expect(
      readOAuthReturn(JSON.stringify(context()), "bob", "google-drive")
    ).toBeNull());
  it("rejects a different provider", () =>
    expect(
      readOAuthReturn(JSON.stringify(context()), "alice", "dropbox")
    ).toBeNull());
  it("rejects an expired setup", () =>
    expect(
      readOAuthReturn(
        JSON.stringify({ ...context(), createdAt: Date.now() - 31 * 60_000 }),
        "alice",
        "google-drive"
      )
    ).toBeNull());
  it("prevents an external return redirect", () =>
    expect(
      readOAuthReturn(
        JSON.stringify({ ...context(), returnPath: "https://evil.example/" }),
        "alice",
        "google-drive"
      )?.returnPath
    ).toBe("/"));
});
