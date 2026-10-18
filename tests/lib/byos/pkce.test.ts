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
});
