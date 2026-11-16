import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "../../../src/lib/db/client-sqlite";
import { purgeLocalCatalogForGenres } from "../../../src/lib/db/queries/user-genre-selection";

const mocks = vi.hoisted(() => ({
  raw: vi.fn(),
  remove: vi.fn(),
  suppress: vi.fn(),
  restore: vi.fn(),
}));
vi.mock("../../../src/lib/db/client-sqlite", () => ({
  getSqliteInstance: mocks.raw,
}));
vi.mock("../../../src/lib/db/install-triggers", () => ({
  areSyncTriggersSuppressed: () => false,
  suppressSyncTriggers: mocks.suppress,
  enableSyncTriggers: mocks.restore,
}));
const db = {
  all: () => [{ id: "tune" }],
  delete: () => ({ where: () => ({ run: mocks.remove }) }),
} as unknown as SqliteDatabase;

beforeEach(() => {
  vi.resetAllMocks();
});
describe("catalog purge ownership", () => {
  it("does not delete after ownership changes while obtaining the raw database", async () => {
    let current = true;
    let release!: (db: object) => void;
    mocks.raw.mockReturnValue(
      new Promise<object>((resolve) => {
        release = resolve;
      })
    );
    const pending = purgeLocalCatalogForGenres(
      db,
      "owner",
      ["irish"],
      () => current
    );
    current = false;
    release({});
    await pending;
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not yield partway through an authorized deletion batch", async () => {
    let current = true;
    mocks.raw.mockResolvedValue({});
    mocks.remove.mockImplementationOnce(() => {
      queueMicrotask(() => {
        current = false;
      });
    });
    await purgeLocalCatalogForGenres(db, "owner", ["irish"], () => current);
    expect(mocks.remove).toHaveBeenCalledTimes(9);
  });
});
