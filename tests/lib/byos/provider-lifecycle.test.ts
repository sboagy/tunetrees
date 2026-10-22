import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteLocalRefreshToken,
  getLocalRefreshToken,
  putLocalRefreshToken,
} from "@/lib/byos/local-secret-store";
import { createByosProviders } from "@/lib/byos/providers";

vi.mock("@/lib/byos/local-secret-store", () => ({
  getLocalRefreshToken: vi.fn(),
  putLocalRefreshToken: vi.fn(),
  deleteLocalRefreshToken: vi.fn(),
}));

const options = { userId: "alice", getAppAccessToken: () => "app-session" };
const cases = [
  {
    id: "google-drive" as const,
    token: {
      token: {
        accessToken: "access-only",
        expiresIn: 60,
        refreshToken: "rotated",
      },
    },
    host: "www.googleapis.com",
  },
  {
    id: "dropbox" as const,
    token: {
      access_token: "access-only",
      expires_in: 60,
      refresh_token: "rotated",
    },
    host: "content.dropboxapi.com",
  },
];
let request: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  vi.mocked(getLocalRefreshToken).mockResolvedValue("local-refresh");
  request = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each(cases)("$id private token lifecycle", ({ id, token, host }) => {
  function allowDownload() {
    request.mockResolvedValueOnce(Response.json(token));
    request.mockResolvedValueOnce(new Response("audio"));
  }

  it("refreshes once, keeps access in memory, and downloads directly without URL credentials", async () => {
    allowDownload();
    request.mockResolvedValueOnce(new Response("audio"));
    const provider = createByosProviders(options)[id];
    await provider.resolveBlob("file-id");
    await provider.resolveBlob("file-id");
    expect(getLocalRefreshToken).toHaveBeenCalledExactlyOnceWith("alice", id);
    expect(putLocalRefreshToken).toHaveBeenCalledExactlyOnceWith(
      "alice",
      id,
      "rotated"
    );
    expect(request).toHaveBeenCalledTimes(3);
    const [url, init] = request.mock.calls[1];
    expect(new URL(String(url)).hostname).toBe(host);
    expect(String(url)).not.toMatch(/access-only|local-refresh|app-session/);
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer access-only"
    );
  });

  it("silently refreshes an expired access token", async () => {
    allowDownload();
    const provider = createByosProviders(options)[id];
    await provider.resolveBlob("file-id");
    vi.advanceTimersByTime(61_000);
    allowDownload();
    await provider.resolveBlob("file-id");
    expect(getLocalRefreshToken).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("uses local refresh storage after recreating the provider, not a persisted access token", async () => {
    allowDownload();
    await createByosProviders(options)[id].resolveBlob("file-id");
    allowDownload();
    await createByosProviders(options)[id].resolveBlob("file-id");
    expect(getLocalRefreshToken).toHaveBeenCalledTimes(2);
    expect(putLocalRefreshToken).not.toHaveBeenCalledWith(
      "alice",
      id,
      "access-only"
    );
  });

  it("requires independent authorization for another user/device", async () => {
    vi.mocked(getLocalRefreshToken).mockResolvedValue(null);
    await expect(
      createByosProviders({ ...options, userId: "bob" })[id].resolveBlob(
        "file-id"
      )
    ).rejects.toThrow("Connect this storage provider");
    expect(getLocalRefreshToken).toHaveBeenCalledWith("bob", id);
    expect(request).not.toHaveBeenCalled();
  });

  it("disconnects local credentials and discards a still-valid memory token", async () => {
    allowDownload();
    const provider = createByosProviders(options)[id];
    await provider.resolveBlob("file-id");
    await provider.disconnect();
    vi.mocked(getLocalRefreshToken).mockResolvedValue(null);
    await expect(provider.resolveBlob("file-id")).rejects.toThrow(
      "Connect this storage provider"
    );
    expect(deleteLocalRefreshToken).toHaveBeenCalledExactlyOnceWith(
      "alice",
      id
    );
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not download or persist tokens after revoked refresh consent", async () => {
    request.mockResolvedValueOnce(
      Response.json({ error: "local-refresh" }, { status: 401 })
    );
    await expect(
      createByosProviders(options)[id].resolveBlob("file-id")
    ).rejects.toThrow("authorization failed. Please try again or reconnect");
    expect(request).toHaveBeenCalledTimes(1);
    expect(putLocalRefreshToken).not.toHaveBeenCalled();
  });

  it.each([
    403, 404, 429, 503,
  ])("reports download failure %i without exposing the provider response", async (status) => {
    request.mockResolvedValueOnce(Response.json(token));
    request.mockResolvedValueOnce(
      new Response("sensitive-provider-diagnostic", { status })
    );
    await expect(
      createByosProviders(options)[id].resolveBlob("file-id")
    ).rejects.toThrow(
      "audio download failed. Please try again or reconnect your provider."
    );
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("can retry after a transient download failure", async () => {
    request.mockResolvedValueOnce(Response.json(token));
    request.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const provider = createByosProviders(options)[id];
    await expect(provider.resolveBlob("file-id")).rejects.toThrow(
      "download failed"
    );
    request.mockResolvedValueOnce(new Response("recovered"));
    expect(await (await provider.resolveBlob("file-id")).text()).toBe(
      "recovered"
    );
    expect(getLocalRefreshToken).toHaveBeenCalledTimes(1);
  });
});
