import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_STATE_DB_VERSION_STORAGE_KEY,
  AUTH_STATE_SNAPSHOT_VERSION_STORAGE_KEY,
  CURRENT_AUTH_STATE_DB_VERSION,
  CURRENT_AUTH_STATE_SNAPSHOT_VERSION,
  isAuthFileFresh,
  isAuthFileSessionValid,
  mapAuthStateToOrigin,
} from "../e2e/helpers/auth-state";

const DEV_ORIGIN = "http://localhost:5173";
const PREVIEW_ORIGIN = "http://localhost:4173";
const EMAIL = "alice.test@example.test";
const NOW = Date.UTC(2026, 10, 4);

function makeState(origin = DEV_ORIGIN, email = EMAIL) {
  return {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: "tunetrees-auth",
            value: JSON.stringify({
              access_token: "test-token",
              user: { email },
              expires_at: NOW / 1000 + 3600,
            }),
          },
          {
            name: AUTH_STATE_DB_VERSION_STORAGE_KEY,
            value: String(CURRENT_AUTH_STATE_DB_VERSION),
          },
          {
            name: AUTH_STATE_SNAPSHOT_VERSION_STORAGE_KEY,
            value: String(CURRENT_AUTH_STATE_SNAPSHOT_VERSION),
          },
        ],
        indexedDB: [{ name: "tunetrees-storage", version: 1, stores: [] }],
      },
    ],
  };
}

describe("E2E auth snapshot validation", () => {
  let directory: string;
  let authFile: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "tunetrees-auth-test-"));
    authFile = join(directory, "alice.json");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("accepts a fresh snapshot for the expected origin and user", () => {
    writeFileSync(authFile, JSON.stringify(makeState()));
    expect(isAuthFileFresh(authFile, `${DEV_ORIGIN}/`, EMAIL, NOW)).toBe(true);
  });

  it("rejects a locally fresh JWT whose server session was deleted", async () => {
    writeFileSync(authFile, JSON.stringify(makeState()));
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW)).toBe(true);
    expect(
      await isAuthFileSessionValid(
        authFile,
        DEV_ORIGIN,
        EMAIL,
        "http://localhost:54321",
        "test-key",
        async () =>
          new Response(JSON.stringify({ code: "session_not_found" }), {
            status: 403,
          })
      )
    ).toBe(false);
  });

  it("reuses a session verified by the server for the expected user", async () => {
    writeFileSync(authFile, JSON.stringify(makeState()));
    expect(
      await isAuthFileSessionValid(
        authFile,
        DEV_ORIGIN,
        EMAIL,
        "http://localhost:54321",
        "test-key",
        async () => new Response(JSON.stringify({ email: EMAIL }))
      )
    ).toBe(true);
  });

  it("does not treat an auth server outage as a revoked session", async () => {
    writeFileSync(authFile, JSON.stringify(makeState()));
    await expect(
      isAuthFileSessionValid(
        authFile,
        DEV_ORIGIN,
        EMAIL,
        "http://localhost:54321",
        "test-key",
        async () => new Response("Unavailable", { status: 503 })
      )
    ).rejects.toThrow("HTTP 503");
  });

  it("rejects a fresh preview snapshot for dev tests", () => {
    writeFileSync(authFile, JSON.stringify(makeState(PREVIEW_ORIGIN)));
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW)).toBe(false);
  });

  it("rejects a snapshot belonging to another user", () => {
    writeFileSync(
      authFile,
      JSON.stringify(makeState(DEV_ORIGIN, "bob@example.test"))
    );
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW)).toBe(false);
  });

  it("does not borrow IndexedDB data from a different origin", () => {
    const state = makeState();
    state.origins[0].indexedDB = [];
    state.origins.push(makeState(PREVIEW_ORIGIN).origins[0]);
    writeFileSync(authFile, JSON.stringify(state));
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW)).toBe(false);
  });

  it("rejects an expired session", () => {
    writeFileSync(authFile, JSON.stringify(makeState()));
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW + 3600_000)).toBe(
      false
    );
  });

  it("rejects a session at the five-minute safety boundary", () => {
    writeFileSync(authFile, JSON.stringify(makeState()));
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW + 3300_000)).toBe(
      false
    );
  });

  it("rejects an incompatible snapshot version", () => {
    const state = makeState();
    state.origins[0].localStorage[2].value = "-1";
    writeFileSync(authFile, JSON.stringify(state));
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW)).toBe(false);
  });

  it("rejects an incompatible database version", () => {
    const state = makeState();
    state.origins[0].localStorage[1].value = "-1";
    writeFileSync(authFile, JSON.stringify(state));
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW)).toBe(false);
  });

  it("rejects a missing snapshot", () => {
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW)).toBe(false);
  });

  it("rejects malformed snapshot JSON", () => {
    writeFileSync(authFile, "{");
    expect(isAuthFileFresh(authFile, DEV_ORIGIN, EMAIL, NOW)).toBe(false);
  });
});

describe("E2E preview auth state", () => {
  it("maps both localStorage and IndexedDB to the preview origin", () => {
    expect(
      mapAuthStateToOrigin(makeState(), DEV_ORIGIN, PREVIEW_ORIGIN)
    ).toEqual(makeState(PREVIEW_ORIGIN));
  });

  it("preserves the canonical snapshot when preparing preview state", () => {
    const state = makeState();
    mapAuthStateToOrigin(state, DEV_ORIGIN, PREVIEW_ORIGIN);
    expect(state).toEqual(makeState());
  });

  it("preserves unrelated origins", () => {
    const state = makeState("https://example.test");
    expect(mapAuthStateToOrigin(state, DEV_ORIGIN, PREVIEW_ORIGIN)).toEqual(
      state
    );
  });
});
