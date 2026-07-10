import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPendingSignUpConfirmationEmail,
  SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY,
} from "../../../src/lib/auth/signup-confirmation-pending";

function stubPendingStorage(value: string) {
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) =>
      key === SIGNUP_CONFIRMATION_PENDING_EMAIL_KEY ? value : null,
  });
  vi.stubGlobal("localStorage", { getItem: () => null });
}

describe("getPendingSignUpConfirmationEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the current structured pending entry", () => {
    stubPendingStorage(JSON.stringify({ email: "current@example.com", ts: 0 }));

    expect(getPendingSignUpConfirmationEmail()).toBe("current@example.com");
  });

  it("reads a quoted legacy email entry", () => {
    stubPendingStorage('"quoted@example.com"');

    expect(getPendingSignUpConfirmationEmail()).toBe("quoted@example.com");
  });

  it("reads an unquoted legacy email entry", () => {
    stubPendingStorage("bare@example.com");

    expect(getPendingSignUpConfirmationEmail()).toBe("bare@example.com");
  });
});
