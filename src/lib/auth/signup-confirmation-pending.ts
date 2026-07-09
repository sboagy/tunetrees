export const SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY =
  "tunetrees:signup-confirmation-pending-email";

/** TTL for pending signup confirmation state (10 minutes). */
const PENDING_TTL_MS = 10 * 60 * 1000;

interface PendingEntry {
  email: string;
  ts: number;
}

function readStorage(storage: Storage | undefined): PendingEntry | null {
  try {
    const raw = storage?.getItem(SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Defensive: also accept legacy plain-string entries (no expiry)
    if (typeof parsed === "string") return { email: parsed, ts: 0 };
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "email" in (parsed as Record<string, unknown>) &&
      "ts" in (parsed as Record<string, unknown>)
    ) {
      const entry = parsed as { email: string; ts: number };
      if (typeof entry.email === "string" && typeof entry.ts === "number") {
        return entry;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | undefined, email: string | null) {
  try {
    if (email) {
      const entry: PendingEntry = { email, ts: Date.now() };
      storage?.setItem(
        SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY,
        JSON.stringify(entry)
      );
    } else {
      storage?.removeItem(SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY);
    }
  } catch {
    // Best-effort guard for auth/navigation races.
  }
}

function clearStaleEntry(entry: PendingEntry, storage: Storage | undefined) {
  // Legacy entries with ts=0 are grandfathered (no expiry)
  if (entry.ts !== 0 && Date.now() - entry.ts > PENDING_TTL_MS) {
    try {
      storage?.removeItem(SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY);
    } catch {
      // Best-effort
    }
    return true;
  }
  return false;
}

export function getPendingSignUpConfirmationEmail(): string | null {
  let entry =
    readStorage(globalThis.sessionStorage) ??
    readStorage(globalThis.localStorage);

  if (!entry) return null;

  // Clear stale from sessionStorage first
  if (clearStaleEntry(entry, globalThis.sessionStorage)) {
    entry = readStorage(globalThis.localStorage);
    if (!entry) return null;
  }

  // Clear stale from localStorage too
  if (clearStaleEntry(entry, globalThis.localStorage)) {
    return null;
  }

  return entry.email;
}

export function hasPendingSignUpConfirmation(): boolean {
  return Boolean(getPendingSignUpConfirmationEmail());
}

export function setPendingSignUpConfirmationEmail(email: string | null) {
  writeStorage(globalThis.sessionStorage, email);
  writeStorage(globalThis.localStorage, email);
}
