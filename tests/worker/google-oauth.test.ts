const { authenticateMediaRequestMock, getCorsHeadersMock } = vi.hoisted(() => ({
  authenticateMediaRequestMock: vi.fn(),
  getCorsHeadersMock: vi.fn(() => ({
    "Access-Control-Allow-Origin": "https://app.example.com",
  })),
}));

vi.mock("../../worker/src/media", () => ({
  authenticateMediaRequest: authenticateMediaRequestMock,
  getCorsHeaders: getCorsHeadersMock,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type GoogleOAuthWorkerEnv,
  handleGoogleOAuthRequest,
} from "../../worker/src/google-oauth";

describe("Google OAuth token exchange route", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    authenticateMediaRequestMock.mockReset();
    getCorsHeadersMock.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
  });

  const environment = (): GoogleOAuthWorkerEnv => ({
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    SUPABASE_URL: "https://example.supabase.co",
  });

  it("exchanges an authorization code without persisting or exposing the client secret", async () => {
    authenticateMediaRequestMock.mockResolvedValue({ id: "user-1" });
    const tokenFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = new URLSearchParams(init?.body as URLSearchParams);
      expect(form.get("grant_type")).toBe("authorization_code");
      expect(form.get("client_id")).toBe("google-client-id");
      expect(form.get("code")).toBe("authorization-code");
      expect(form.get("code_verifier")).toBe("pkce-verifier");
      expect(form.get("redirect_uri")).toBe("https://app.example.com/oauth");
      expect(form.get("client_secret")).toBe("google-client-secret");

      return new Response(
        JSON.stringify({
          access_token: "access-token",
          expires_in: 3600,
          refresh_token: "refresh-token",
          scope: "https://www.googleapis.com/auth/drive.file",
          token_type: "Bearer",
          extra_provider_field: "not-returned",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: tokenFetch,
    });

    const response = await handleGoogleOAuthRequest(
      new Request("https://worker.example.com/api/byos/google/token", {
        method: "POST",
        headers: {
          Authorization: "Bearer app-session-token",
          "Content-Type": "application/json",
          Origin: "https://app.example.com",
        },
        body: JSON.stringify({
          grantType: "authorization_code",
          clientId: "google-client-id",
          code: "authorization-code",
          codeVerifier: "pkce-verifier",
          redirectUri: "https://app.example.com/oauth",
        }),
      }),
      environment()
    );

    expect(response?.status).toBe(200);
    const payload = await response?.json();
    expect(payload).toEqual({
      token: {
        accessToken: "access-token",
        expiresIn: 3600,
        refreshToken: "refresh-token",
        scope: "https://www.googleapis.com/auth/drive.file",
        tokenType: "Bearer",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("google-client-secret");
  });

  it("requires a signed-in TuneTrees user before exchanging a refresh token", async () => {
    authenticateMediaRequestMock.mockResolvedValue(null);
    const tokenFetch = vi.fn();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: tokenFetch,
    });

    const response = await handleGoogleOAuthRequest(
      new Request("https://worker.example.com/api/byos/google/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grantType: "refresh_token",
          refreshToken: "browser-local-refresh-token",
        }),
      }),
      environment()
    );

    expect(response?.status).toBe(401);
    expect(tokenFetch).not.toHaveBeenCalled();
  });

  it("forwards a refresh token only to Google and returns the new access token", async () => {
    authenticateMediaRequestMock.mockResolvedValue({ id: "user-1" });
    const tokenFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = new URLSearchParams(init?.body as URLSearchParams);
      expect(form.get("grant_type")).toBe("refresh_token");
      expect(form.get("client_id")).toBe("google-client-id");
      expect(form.get("refresh_token")).toBe("browser-local-refresh-token");
      return new Response(
        JSON.stringify({ access_token: "new-access-token", expires_in: 3599 }),
        { headers: { "Content-Type": "application/json" } }
      );
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: tokenFetch,
    });

    const response = await handleGoogleOAuthRequest(
      new Request("https://worker.example.com/api/byos/google/token", {
        method: "POST",
        headers: {
          Authorization: "Bearer app-session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grantType: "refresh_token",
          clientId: "google-client-id",
          refreshToken: "browser-local-refresh-token",
        }),
      }),
      environment()
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      token: { accessToken: "new-access-token", expiresIn: 3599 },
    });
  });
});
