export const SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY =
  "tunetrees:signup-confirmation-pending-email";

function readStorage(storage: Storage | undefined): string | null {
  try {
    return storage?.getItem(SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | undefined, email: string | null) {
  try {
    if (email) {
      storage?.setItem(SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY, email);
    } else {
      storage?.removeItem(SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY);
    }
  } catch {
    // Best-effort guard for auth/navigation races.
  }
}

export function getPendingSignUpConfirmationEmail(): string | null {
  return (
    readStorage(globalThis.sessionStorage) ??
    readStorage(globalThis.localStorage)
  );
}

export function hasPendingSignUpConfirmation(): boolean {
  return Boolean(getPendingSignUpConfirmationEmail());
}

export function setPendingSignUpConfirmationEmail(email: string | null) {
  writeStorage(globalThis.sessionStorage, email);
  writeStorage(globalThis.localStorage, email);
}
