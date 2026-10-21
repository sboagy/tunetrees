import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleGoogleOAuthRequest } from "../../worker/src/google-oauth";

vi.mock("../../worker/src/media", () => ({
  authenticateMediaRequest: vi.fn(async () => ({ id: "alice" })),
  getCorsHeaders: () => ({}),
}));

const env = {
  GOOGLE_CLIENT_SECRET: "worker-secret",
  SUPABASE_URL: "https://example.supabase.co",
};
const refresh = {
  grantType: "refresh_token",
  clientId: "public-client",
  refreshToken: "private-refresh",
};
function exchange(body: string) {
  return handleGoogleOAuthRequest(
    new Request("https://worker.example/api/byos/google/token", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    }),
    env
  );
}
let request: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  request = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stateless Google exchange security boundaries", () => {
  it.each([
    "not-json",
    "null",
    "[]",
    JSON.stringify({ ...refresh, clientId: " " }),
    JSON.stringify({ ...refresh, refreshToken: 123 }),
    JSON.stringify({ ...refresh, grantType: "password" }),
    JSON.stringify({
      grantType: "authorization_code",
      clientId: "client",
      code: "code",
      redirectUri: "https://app.example",
    }),
  ])("rejects invalid exchange input without contacting Google: %s", async (body) => {
    expect((await exchange(body))?.status).toBe(400);
    expect(request).not.toHaveBeenCalled();
  });

  it("does not echo or log provider errors containing credentials", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    request.mockResolvedValueOnce(
      new Response("private-refresh worker-secret", { status: 400 })
    );
    const response = await exchange(JSON.stringify(refresh));
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({
      error: "Google token exchange was rejected",
    });
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    // No secondary request to Supabase, storage, or a diagnostic collector.
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(
      "https://oauth2.googleapis.com/token"
    );
  });

  it("sanitizes network failures", async () => {
    request.mockRejectedValueOnce(new Error("private-refresh worker-secret"));
    const response = await exchange(JSON.stringify(refresh));
    expect(response?.status).toBe(502);
    expect(await response?.json()).toEqual({
      error: "Google token exchange is unavailable",
    });
  });

  it.each([
    "not-json",
    "null",
    '{"access_token":123}',
    "{}",
  ])("rejects malformed provider token responses: %s", async (body) => {
    request.mockResolvedValueOnce(new Response(body));
    const response = await exchange(JSON.stringify(refresh));
    expect(response?.status).toBe(502);
    expect(await response?.json()).toEqual({
      error: "Google token exchange returned an invalid response",
    });
  });
});
