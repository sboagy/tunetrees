import type { Page } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForSyncComplete } from "../e2e/helpers/local-db-lifecycle";

vi.mock("../e2e/test-config", () => ({ BASE_URL: "http://localhost:5173" }));

// Execute the helper's DOM inspection in jsdom; no browser or server is started.
function makePage(waitForTimeout = vi.fn().mockResolvedValue(undefined)) {
  const page = {
    url: () => window.location.href,
    evaluate: async (readStatus: () => unknown) => readStatus(),
    waitForTimeout,
  };
  return page as unknown as Page;
}

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
});

describe("E2E initial sync authentication diagnostics", () => {
  it("reports missing authentication immediately after auth resolves on login", async () => {
    window.history.replaceState({}, "", "/login");
    document.body.innerHTML = '<div data-auth-initialized="true"></div>';
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(waitForSyncComplete(makePage(wait))).rejects.toThrow(
      "Authentication missing while waiting for initial sync"
    );
    expect(wait).not.toHaveBeenCalled();
  });

  it("allows a pending auth session to restore and complete sync", async () => {
    window.history.replaceState({}, "", "/login");
    document.body.innerHTML = '<div data-auth-initialized="false"></div>';
    const wait = vi.fn().mockImplementation(async () => {
      window.history.replaceState({}, "", "/");
      document.body.innerHTML =
        '<div data-auth-initialized="true" data-sync-version="1" data-sync-success="true" data-initial-sync-complete="true"></div>';
    });

    await expect(waitForSyncComplete(makePage(wait))).resolves.toBeUndefined();
  });
});
