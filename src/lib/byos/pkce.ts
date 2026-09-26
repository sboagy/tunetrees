import type { ByosProviderId } from "./types";

const STORAGE_PREFIX = "tunetrees:byos:pkce:";

export type PkceTransaction = {
  state: string;
  codeVerifier: string;
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function randomValue() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function storageKey(providerId: ByosProviderId) {
  return `${STORAGE_PREFIX}${providerId}`;
}

export async function createPkceTransaction(providerId: ByosProviderId) {
  const transaction: PkceTransaction = {
    state: randomValue(),
    codeVerifier: randomValue(),
  };
  sessionStorage.setItem(storageKey(providerId), JSON.stringify(transaction));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(transaction.codeVerifier)
  );
  return { ...transaction, codeChallenge: base64Url(new Uint8Array(digest)) };
}

export function consumePkceTransaction(
  providerId: ByosProviderId,
  receivedState: string | null
): PkceTransaction {
  const key = storageKey(providerId);
  const raw = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (!raw || !receivedState) {
    throw new Error("The storage-provider authorization session has expired.");
  }
  let transaction: PkceTransaction;
  try {
    transaction = JSON.parse(raw) as PkceTransaction;
  } catch {
    throw new Error("The storage-provider authorization session is invalid.");
  }
  if (
    typeof transaction.state !== "string" ||
    typeof transaction.codeVerifier !== "string" ||
    transaction.state !== receivedState
  ) {
    throw new Error("The storage-provider authorization state did not match.");
  }
  return transaction;
}
