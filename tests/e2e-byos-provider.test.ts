import type { Page, Route } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import { configureMockGoogleDriveByos } from "../e2e/helpers/byos-provider";

vi.mock("../e2e/page-objects/TuneTreesPage", () => ({
  TuneTreesPage: vi.fn(),
}));

async function captureHandlers() {
  const handlers = new Map<string, (route: Route) => Promise<void>>();
  const page = {
    evaluate: vi.fn().mockResolvedValue(undefined),
    route: async (
      pattern: string,
      handler: (route: Route) => Promise<void>
    ) => {
      handlers.set(pattern, handler);
    },
  };
  await configureMockGoogleDriveByos(page as unknown as Page, "test-user");
  return handlers;
}

function makeRoute(url: string, metadata: { id: string } = { id: "unused" }) {
  const fulfill = vi.fn().mockResolvedValue(undefined);
  const route = {
    request: () => ({ url: () => url, postDataJSON: () => metadata }),
    fulfill,
  };
  return { route: route as unknown as Route, fulfill };
}

describe("Google Drive E2E upload isolation", () => {
  it("reserves different file IDs across uploads and test contexts", async () => {
    const firstHandlers = await captureHandlers();
    const secondHandlers = await captureHandlers();
    const first = makeRoute(
      "https://www.googleapis.com/drive/v3/files/generateIds"
    );
    const next = makeRoute(
      "https://www.googleapis.com/drive/v3/files/generateIds"
    );
    const other = makeRoute(
      "https://www.googleapis.com/drive/v3/files/generateIds"
    );
    const pattern = "https://www.googleapis.com/drive/v3/files/**";

    await firstHandlers.get(pattern)!(first.route);
    await firstHandlers.get(pattern)!(next.route);
    await secondHandlers.get(pattern)!(other.route);

    const ids = [first, next, other].map(
      ({ fulfill }) => fulfill.mock.calls[0][0].json.ids[0]
    );
    expect(new Set(ids).size).toBe(3);
  });

  it("returns the reserved ID when the resumable upload completes", async () => {
    const handlers = await captureHandlers();
    const start = makeRoute(
      "https://www.googleapis.com/upload/drive/v3/files",
      {
        id: "reserved-file-id",
      }
    );
    await handlers.get("https://www.googleapis.com/upload/drive/v3/files?**")!(
      start.route
    );
    const finish = makeRoute(start.fulfill.mock.calls[0][0].headers.Location);
    await handlers.get("https://e2e-google-upload.invalid/session/*")!(
      finish.route
    );

    expect(JSON.parse(finish.fulfill.mock.calls[0][0].body).id).toBe(
      "reserved-file-id"
    );
  });
});
