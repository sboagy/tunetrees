import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumePkceTransaction, createPkceTransaction } from "@/lib/byos/pkce";

class MemorySessionStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("BYOS PKCE transaction", () => {
  const sessionStorage = new MemorySessionStorage();

  beforeEach(() => {
    vi.stubGlobal("sessionStorage", sessionStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a PKCE transaction and consumes it once when state matches", async () => {
    const transaction = await createPkceTransaction("google-drive");

    expect(transaction.codeChallenge).not.toBe(transaction.codeVerifier);
    expect(consumePkceTransaction("google-drive", transaction.state)).toEqual({
      state: transaction.state,
      codeVerifier: transaction.codeVerifier,
    });
    expect(() =>
      consumePkceTransaction("google-drive", transaction.state)
    ).toThrow("authorization session has expired");
  });

  it("rejects a callback with a mismatched OAuth state", async () => {
    await createPkceTransaction("dropbox");

    expect(() => consumePkceTransaction("dropbox", "wrong-state")).toThrow(
      "authorization state did not match"
    );
  });

  it("does not accept a Google state for a Dropbox transaction", async () => {
    const google = await createPkceTransaction("google-drive");
    await createPkceTransaction("dropbox");
    expect(() => consumePkceTransaction("dropbox", google.state)).toThrow(
      "state did not match"
    );
  });

  it("invalidates a transaction after a failed state check", async () => {
    const transaction = await createPkceTransaction("dropbox");
    expect(() => consumePkceTransaction("dropbox", "attacker-state")).toThrow(
      "state did not match"
    );
    expect(() => consumePkceTransaction("dropbox", transaction.state)).toThrow(
      "session has expired"
    );
  });

  it("rejects a missing callback state", async () => {
    await createPkceTransaction("google-drive");
    expect(() => consumePkceTransaction("google-drive", null)).toThrow(
      "session has expired"
    );
  });

  it("rejects corrupt local transaction JSON", () => {
    sessionStorage.setItem("tunetrees:byos:pkce:google-drive", "invalid-json");
    expect(() => consumePkceTransaction("google-drive", "state")).toThrow(
      "session is invalid"
    );
  });
});
