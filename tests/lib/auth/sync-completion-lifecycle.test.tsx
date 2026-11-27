import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { BrowserSqliteMigrationBlockedError } from "oosync/runtime/browser-sqlite";
import { createSignal, type ParentProps, useContext } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AuthState,
  TTAuthContext,
  TTAuthProvider,
} from "../../../src/lib/auth/TTAuthProvider";
import { expectConsole } from "../../helpers/expected-console";

type TestUser = {
  id: string;
  email?: string;
  is_anonymous: boolean;
  app_metadata?: Record<string, unknown>;
  user_metadata: Record<string, string>;
};
type Completion = {
  success: boolean;
  errors: string[];
  affectedTables: string[];
};
type WorkerConfig = {
  onSyncComplete: (result: Completion) => Promise<void>;
  requestOverridesProvider: () => Promise<unknown>;
};
const mocks = vi.hoisted(() => ({
  auth: {
    user: (): TestUser | null => null,
    session: () => null,
    loading: () => false,
    isAnonymous: () => false,
    signOut: vi.fn(),
  },
  initialize: vi.fn(),
  close: vi.fn(),
  persist: vi.fn(),
  clear: vi.fn(),
  discardBlocked: vi.fn(),
  autoCleanup: vi.fn(),
  selectRows: vi.fn(),
  insert: vi.fn(),
  repair: vi.fn(),
  genreOverrides: vi.fn(),
  start: vi.fn(),
  snapshot: vi.fn(),
  selected: vi.fn(),
  required: vi.fn(),
  upsert: vi.fn(),
  purge: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  down: vi.fn(),
  up: vi.fn(),
}));
vi.mock("../../../src/lib/db/discard-blocked-database", () => ({
  discardBlockedDatabase: mocks.discardBlocked,
}));
vi.mock("@rhizome/core", () => ({
  AuthProvider: (props: ParentProps) => props.children,
  useAuth: () => mocks.auth,
}));
vi.mock("../../../src/lib/db/client-sqlite", () => ({
  initializeDb: mocks.initialize,
  closeDb: mocks.close,
  persistDb: mocks.persist,
  clearDb: mocks.clear,
  getSqliteInstance: async () => null,
  setupAutoPersist: () => mocks.autoCleanup,
}));
vi.mock("../../../src/lib/supabase/client", () => ({ supabase: { auth: {} } }));
vi.mock("../../../src/lib/sync", () => ({
  clearOldOutboxItems: async () => {},
  ensureSyncRuntimeConfigured: () => {},
  SyncInProgressError: class extends Error {},
}));
vi.mock("@oosync/sync", () => ({ startSyncWorker: mocks.start }));
vi.mock("../../../src/lib/diagnostics/sync-baseline", () => ({
  captureSyncBaselineSnapshot: mocks.snapshot,
  markSyncBaselineEvent: () => {},
  installSyncBaselineFetchDiagnostics: () => {},
}));
vi.mock("../../../src/lib/sync/genre-filter", () => ({
  repairPendingMediaAssetSyncState: mocks.repair,
  repairPendingSetlistSyncState: async () => ({}),
  buildGenreFilterOverrides: mocks.genreOverrides,
}));
vi.mock("../../../src/lib/db/queries/user-genre-selection", () => ({
  getUserGenreSelection: mocks.selected,
  getRequiredGenreIdsForUser: mocks.required,
  getUserRepertoireStats: async () => ({
    repertoireCount: 1,
    repertoireTuneCount: 1,
  }),
  getRepertoireGenreDefaultsForUser: async () => [],
  getRepertoireTuneGenreIdsForUser: async () => [],
  upsertUserGenreSelection: mocks.upsert,
  purgeLocalCatalogForGenres: mocks.purge,
}));
vi.mock("../../../src/lib/db/queries/genres", () => ({
  getAllGenres: async () => [],
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const user: TestUser = {
  id: "owner-a",
  is_anonymous: false,
  user_metadata: {},
};
const result: Completion = { success: true, errors: [], affectedTables: [] };
let setUser: (value: TestUser | null) => void;
let state: AuthState;
let workerConfig: WorkerConfig;
let service: {
  getLastSyncDownTimestamp: () => string | null;
  getLastSyncMode: () => string;
  destroy: typeof mocks.destroy;
  syncDown: typeof mocks.down;
  forceFullSyncDown: typeof mocks.down;
  syncUp: typeof mocks.up;
  syncing: boolean;
};
let db: object;
function mount() {
  function Probe() {
    const context = useContext(TTAuthContext);
    if (!context) throw new Error("Missing auth context");
    state = context;
    return null;
  }
  return render(() => (
    <TTAuthProvider>
      <Probe />
    </TTAuthProvider>
  ));
}
async function started() {
  await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  const [getUser, updateUser] = createSignal<TestUser | null>(user);
  mocks.auth.user = getUser;
  setUser = updateUser;
  db = {
    select: () => ({
      from: () => ({ where: () => ({ limit: mocks.selectRows }) }),
    }),
    insert: () => ({ values: mocks.insert }),
    all: () => [],
  };
  mocks.initialize.mockResolvedValue(db);
  mocks.selectRows.mockResolvedValue([]); // New profile keeps initial sync pending.
  mocks.insert.mockResolvedValue(undefined);
  mocks.down.mockResolvedValue(result);
  mocks.up.mockResolvedValue(result);
  mocks.repair.mockResolvedValue({});
  mocks.genreOverrides.mockReset().mockResolvedValue({});
  mocks.snapshot.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
  mocks.clear.mockResolvedValue(undefined);
  mocks.persist.mockResolvedValue(undefined);
  mocks.destroy.mockResolvedValue(undefined);
  mocks.selected.mockResolvedValue([]);
  mocks.required.mockResolvedValue([]);
  mocks.upsert.mockResolvedValue(undefined);
  mocks.purge.mockResolvedValue({ tuneIds: [] });
  service = {
    getLastSyncDownTimestamp: () => null,
    getLastSyncMode: () => "full",
    destroy: mocks.destroy,
    syncDown: mocks.down,
    forceFullSyncDown: mocks.down,
    syncUp: mocks.up,
    syncing: false,
  };
  mocks.start.mockImplementation((_db: unknown, config: WorkerConfig) => {
    workerConfig = config;
    return { service, stop: mocks.stop };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("provider sync completion lifetime", () => {
  it("drains sync before closing SQLite and revoking credentials", async () => {
    mount();
    await started();
    const gate = deferred<void>();
    mocks.destroy.mockReturnValueOnce(gate.promise);
    const pending = state.signOut();
    await waitFor(() => expect(mocks.destroy).toHaveBeenCalledOnce());
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.auth.signOut).not.toHaveBeenCalled();
    expect(state.localDb()).toBeNull();
    gate.resolve();
    await pending;
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.auth.signOut).toHaveBeenCalledOnce();
  });

  it("waits for sign-out cleanup before initializing a replacement account", async () => {
    mount();
    await started();
    const gate = deferred<void>();
    mocks.destroy.mockReturnValueOnce(gate.promise);
    setUser(null);
    await waitFor(() => expect(mocks.destroy).toHaveBeenCalledOnce());
    setUser({ ...user, id: "replacement" });
    await Promise.resolve();
    expect(mocks.initialize).toHaveBeenCalledOnce();
    expect(mocks.close).not.toHaveBeenCalled();
    gate.resolve();
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledTimes(2));
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.initialize).toHaveBeenLastCalledWith("replacement");
  });

  it("does not close SQLite when sync teardown fails", async () => {
    mount();
    await started();
    mocks.destroy.mockRejectedValueOnce(new Error("teardown failed"));
    await expect(state.signOut()).rejects.toThrow("teardown failed");
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.auth.signOut).toHaveBeenCalledOnce();
    await state.signOut();
    expect(mocks.destroy).toHaveBeenCalledTimes(2);
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("restores the authenticated database when credential revocation fails", async () => {
    mount();
    await started();
    mocks.auth.signOut.mockRejectedValueOnce(new Error("revocation failed"));
    await expect(state.signOut()).rejects.toThrow("revocation failed");
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.initialize).toHaveBeenCalledTimes(2);
    expect(state.localDb()).toBe(db);
  });

  it("retries a failed database close without losing the shutdown guarantee", async () => {
    mount();
    await started();
    mocks.close.mockRejectedValueOnce(new Error("close failed"));
    await expect(state.signOut()).rejects.toThrow("close failed");
    await state.signOut();
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });

  it("propagates a genre lookup failure and retries the initial filter on the next operation", async () => {
    expectConsole(
      "error",
      "[TTAuthProvider] Failed to build sync overrides:",
      expect.objectContaining({ message: "Genre lookup: HTTP 502" })
    );
    setUser({ ...user, email: "owner-a@example.test" });
    mocks.selectRows.mockResolvedValue([{ id: user.id }]);
    mount();
    await started();
    const failure = new Error("Genre lookup: HTTP 502");
    mocks.genreOverrides.mockRejectedValueOnce(failure);
    await expect(workerConfig.requestOverridesProvider()).rejects.toBe(failure);
    const overrides = { collectionsOverride: { selectedGenres: ["ITRAD"] } };
    mocks.genreOverrides.mockResolvedValueOnce(overrides);
    await expect(workerConfig.requestOverridesProvider()).resolves.toEqual(
      overrides
    );
    expect(mocks.genreOverrides).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isInitialSync: true,
        userId: user.id,
      })
    );
  });

  it("clears recovery after full upload/download followed by incremental download", async () => {
    setUser({ ...user, email: "owner-a@example.test" });
    mocks.selectRows.mockResolvedValue([{ id: user.id }]);
    mount();
    await started();
    localStorage.setItem("TT_UPGRADE_FULL_PULL_owner-a", "generation-a");
    await workerConfig.requestOverridesProvider();
    service.getLastSyncDownTimestamp = () => "2026-11-16T12:00:00Z";
    await workerConfig.requestOverridesProvider();
    await workerConfig.onSyncComplete(result);
    expect(localStorage.getItem("TT_UPGRADE_FULL_PULL_owner-a")).toBeNull();
  });

  it("does not clear a newer recovery generation after the first full pull", async () => {
    setUser({ ...user, email: "owner-a@example.test" });
    mocks.selectRows.mockResolvedValue([{ id: user.id }]);
    mount();
    await started();
    localStorage.setItem("TT_UPGRADE_FULL_PULL_owner-a", "generation-a");
    await workerConfig.requestOverridesProvider();
    service.getLastSyncDownTimestamp = () => "2026-11-16T12:00:00Z";
    localStorage.setItem("TT_UPGRADE_FULL_PULL_owner-a", "generation-b");
    await workerConfig.requestOverridesProvider();
    await workerConfig.onSyncComplete(result);
    expect(localStorage.getItem("TT_UPGRADE_FULL_PULL_owner-a")).toBe(
      "generation-b"
    );
  });

  it("does not reuse a failed operation's full-pull metadata on later completion", async () => {
    setUser({ ...user, email: "owner-a@example.test" });
    mocks.selectRows.mockResolvedValue([{ id: user.id }]);
    mount();
    await started();
    localStorage.setItem("TT_UPGRADE_FULL_PULL_owner-a", "generation-a");
    await workerConfig.requestOverridesProvider();
    service.getLastSyncDownTimestamp = () => "2026-11-16T12:00:00Z";
    await workerConfig.onSyncComplete({
      ...result,
      success: false,
      errors: ["failed"],
    });
    await workerConfig.requestOverridesProvider();
    await workerConfig.onSyncComplete(result);
    expect(localStorage.getItem("TT_UPGRADE_FULL_PULL_owner-a")).toBe(
      "generation-a"
    );
  });

  it("initializes an injected local test user without an auth session or worker", async () => {
    setUser(null);
    mount();
    await state.signInAnonymously("injected-test-user");
    expect(state.localDb()).toBe(db);
    expect(state.userIdInt()).toBe("injected-test-user");
    expect(state.initialSyncComplete()).toBe(true);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("does not publish an injected database after unmount", async () => {
    setUser(null);
    const gate = deferred<object>();
    mocks.initialize.mockReturnValueOnce(gate.promise);
    const view = mount();
    const pending = state.signInAnonymously("injected-test-user");
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledOnce());
    view.unmount();
    gate.resolve(db);
    await pending;
    expect(state.localDb()).toBeNull();
  });

  it("allows real sign-in to supersede a shared pending injected initialization", async () => {
    setUser(null);
    const gate = deferred<object>();
    // Match the runtime: all calls while initialization is pending share one DB.
    let runtimePending = true;
    mocks.initialize.mockImplementation(() =>
      runtimePending ? gate.promise : Promise.resolve(db)
    );
    mount();
    const pending = state.signInAnonymously("injected-test-user");
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledOnce());
    setUser(user);
    await Promise.resolve();
    expect(mocks.initialize).toHaveBeenCalledOnce();
    runtimePending = false;
    gate.resolve({ stale: true });
    await pending;
    await started();
    expect(mocks.initialize).toHaveBeenLastCalledWith(user.id);
    expect(state.localDb()).toBe(db);
  });

  it("abandons a waiting sign-in after sign-out during injected initialization", async () => {
    setUser(null);
    const gate = deferred<object>();
    mocks.initialize.mockReturnValueOnce(gate.promise);
    mount();
    const pending = state.signInAnonymously("injected-test-user");
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledOnce());
    setUser(user);
    setUser(null);
    await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
    gate.resolve({ stale: true });
    await pending;
    await Promise.resolve();
    expect(mocks.initialize).toHaveBeenCalledOnce();
    expect(state.localDb()).toBeNull();
  });

  it("does not clear a replacement user's database after reset teardown", async () => {
    expectConsole(
      "error",
      "❌ [ForceCleanLocalReset] Local reset failed:",
      expect.objectContaining({
        message: "Local reset did not run because the active session changed",
      })
    );
    mount();
    await started();
    const gate = deferred<void>();
    mocks.destroy.mockReturnValueOnce(gate.promise);
    const reset = state.forceCleanLocalReset();
    const rejected = expect(reset).rejects.toThrow("Local reset did not run");
    await waitFor(() => expect(mocks.destroy).toHaveBeenCalledOnce());
    setUser(null);
    expect(mocks.close).not.toHaveBeenCalled();
    const replacementDb = { ...db };
    mocks.initialize.mockResolvedValue(replacementDb);
    setUser({ ...user, id: "owner-b" });
    expect(mocks.initialize).toHaveBeenCalledOnce();
    gate.resolve();
    await waitFor(() => expect(state.localDb()).toBe(replacementDb));
    await rejected;
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(state.localDb()).toBe(replacementDb);
  });

  it("does not start a service after unmount during startup repairs", async () => {
    const gate = deferred<object>();
    mocks.repair.mockReturnValueOnce(gate.promise);
    const view = mount();
    await waitFor(() => expect(mocks.repair).toHaveBeenCalledOnce());
    view.unmount();
    gate.resolve({});
    await gate.promise;
    await Promise.resolve();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("does not start a service after sign-out during startup repairs", async () => {
    const gate = deferred<object>();
    mocks.repair.mockReturnValueOnce(gate.promise);
    mount();
    await waitFor(() => expect(mocks.repair).toHaveBeenCalledOnce());
    setUser(null);
    await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
    gate.resolve({});
    await gate.promise;
    await Promise.resolve();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("does not publish a database after unmount during initialization", async () => {
    const gate = deferred<object>();
    mocks.initialize.mockReturnValueOnce(gate.promise);
    const view = mount();
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledOnce());
    view.unmount();
    gate.resolve(db);
    await gate.promise;
    await Promise.resolve();
    await Promise.resolve();
    expect(state.localDb()).toBeNull();
  });

  it("does not publish the old startup after a reset starts a replacement", async () => {
    const gate = deferred<object>();
    mocks.repair.mockReturnValueOnce(gate.promise);
    mount();
    await waitFor(() => expect(mocks.repair).toHaveBeenCalledOnce());
    await state.forceCleanLocalReset();
    gate.resolve({});
    await gate.promise;
    await Promise.resolve();
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it("accepts the first completion queued while the service is created", async () => {
    const completed = deferred<void>();
    mocks.start.mockImplementation((_db: unknown, config: WorkerConfig) => {
      queueMicrotask(() => {
        void config.onSyncComplete(result).then(() => completed.resolve());
      });
      return { service, stop: mocks.stop };
    });
    mount();
    await completed.promise;
    expect(state.initialSyncComplete()).toBe(true);
  });

  it("does not restore a signed-out user's identity after profile lookup resumes", async () => {
    mount();
    await started();
    const gate = deferred<{ id: string }[]>();
    mocks.selectRows.mockReturnValueOnce(gate.promise);
    const completion = workerConfig.onSyncComplete(result);
    await waitFor(() => expect(mocks.selectRows).toHaveBeenCalledTimes(2));
    setUser(null);
    await waitFor(() => expect(state.localDb()).toBeNull());
    gate.resolve([{ id: user.id }]);
    await completion;
    expect(state.userIdInt()).toBeNull();
  });

  it("does not mark initial sync complete after sign-out during reconciliation", async () => {
    mount();
    await started();
    const gate = deferred<string[]>();
    mocks.selected.mockReturnValueOnce(gate.promise);
    const completion = workerConfig.onSyncComplete(result);
    await waitFor(() => expect(mocks.selected).toHaveBeenCalledOnce());
    setUser(null);
    await waitFor(() => expect(state.localDb()).toBeNull());
    gate.resolve([]);
    await completion;
    expect(state.initialSyncComplete()).toBe(false);
  });

  it("does not write catalog selection after ownership expires during reconciliation", async () => {
    mount();
    await started();
    const gate = deferred<string[]>();
    mocks.required.mockReturnValueOnce(gate.promise);
    const completion = workerConfig.onSyncComplete(result);
    await waitFor(() => expect(mocks.required).toHaveBeenCalledOnce());
    setUser(null);
    await waitFor(() => expect(state.localDb()).toBeNull());
    gate.resolve(["irish"]);
    await completion;
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("does not reconcile a deferred completion after unmount", async () => {
    const view = mount();
    await started();
    await workerConfig.onSyncComplete(result);
    mocks.selected.mockClear();
    vi.useFakeTimers();
    await workerConfig.onSyncComplete(result);
    view.unmount();
    await vi.runAllTimersAsync();
    expect(mocks.selected).not.toHaveBeenCalled();
  });

  it("does not persist after unmount during the post-sync snapshot", async () => {
    const view = mount();
    await started();
    const gate = deferred<void>();
    mocks.snapshot.mockImplementation((label: string) =>
      label === "after-initial-sync-complete" ? gate.promise : Promise.resolve()
    );
    const completion = workerConfig.onSyncComplete(result);
    await waitFor(() =>
      expect(mocks.snapshot).toHaveBeenCalledWith(
        "after-initial-sync-complete",
        db,
        user.id
      )
    );
    view.unmount();
    gate.resolve();
    await completion;
    expect(mocks.persist).not.toHaveBeenCalled();
  });
});

describe("anonymous goal downloads", () => {
  it("includes goal definitions and personal settings in the initial restricted pull", async () => {
    setUser({ ...user, is_anonymous: true });
    mount();
    await started();
    expect(await workerConfig.requestOverridesProvider()).toMatchObject({
      pullTables: expect.arrayContaining(["goal", "goal_user_settings"]),
    });
  });

  it("includes goal definitions and personal settings in the onboarding catalog pull", async () => {
    setUser({ ...user, is_anonymous: true });
    mount();
    await started();
    let catalogRequest: unknown;
    mocks.down.mockImplementationOnce(async () => {
      catalogRequest = await workerConfig.requestOverridesProvider();
      return result;
    });
    await state.triggerCatalogSync();
    expect(catalogRequest).toMatchObject({
      pullTables: expect.arrayContaining([
        "tune",
        "user_profile",
        "note",
        "reference",
        "goal",
        "goal_user_settings",
      ]),
    });
  });
});

describe("manual sync uploads", () => {
  beforeEach(() => setUser({ ...user, email: "owner-a@example.test" }));
  it("keeps anonymous actions local without publishing a sync completion", async () => {
    setUser({ ...user, is_anonymous: true });
    mount();
    await started();
    const version = state.remoteSyncDownCompletionVersion();
    await state.forceSyncUp();
    expect(mocks.up).not.toHaveBeenCalled();
    expect(state.remoteSyncDownCompletionVersion()).toBe(version);
    expect(state.localDb()).toBe(db);
  });

  it("uploads registered users' changes and publishes successful completion", async () => {
    mocks.up.mockResolvedValueOnce(result);
    mount();
    await started();
    const version = state.remoteSyncDownCompletionVersion();
    await state.forceSyncUp({ allowDeletes: true });
    expect(mocks.up).toHaveBeenCalledWith({ allowDeletes: true });
    expect(state.remoteSyncDownCompletionVersion()).toBe(version + 1);
  });

  it("rejects returned upload failures without publishing successful completion", async () => {
    expectConsole(
      "error",
      "❌ [ForceSyncUp] Sync up failed:",
      expect.objectContaining({ message: "Upload rejected" })
    );
    mocks.up.mockResolvedValueOnce({
      ...result,
      success: false,
      errors: ["Upload rejected"],
    });
    mount();
    await started();
    const version = state.remoteSyncDownCompletionVersion();
    await expect(state.forceSyncUp()).rejects.toThrow("Upload rejected");
    expect(state.remoteSyncDownCompletionVersion()).toBe(version);
  });

  it("rejects a failed result after retrying an in-progress upload", async () => {
    expectConsole(
      "error",
      "❌ [ForceSyncUp] Sync up failed:",
      expect.objectContaining({ message: "Retry rejected" })
    );
    mocks.up.mockRejectedValueOnce(
      Object.assign(new Error("Busy"), { name: "SyncInProgressError" })
    );
    mocks.up.mockResolvedValueOnce({
      ...result,
      success: false,
      errors: ["Retry rejected"],
    });
    mount();
    await started();
    await expect(state.forceSyncUp()).rejects.toThrow("Retry rejected");
    expect(mocks.up).toHaveBeenCalledTimes(2);
  });
});

it("skips uploads for restored anonymous metadata", async () => {
  setUser({
    ...user,
    email: "restored@example.test",
    app_metadata: { is_anonymous: true },
  });
  mount();
  await started();
  await state.forceSyncUp();
  expect(mocks.up).not.toHaveBeenCalled();
});

it("retries catalog download after a failed upload even when selection is already saved", async () => {
  // No profile at startup; sync makes it available to subsequent lookups.
  mocks.selectRows
    .mockResolvedValueOnce([])
    .mockResolvedValue([{ id: user.id }]);
  expectConsole(
    "error",
    "❌ [ForceSyncUp] Sync up failed:",
    expect.objectContaining({ message: "Upload rejected" })
  );
  expectConsole(
    "warn",
    "[TTAuthProvider] Failed to reconcile catalog genre selection:",
    expect.objectContaining({ message: "Upload rejected" })
  );
  setUser({ ...user, email: "owner-a@example.test" });
  mocks.selected.mockResolvedValue(["irish"]);
  mocks.required.mockResolvedValue(["irish"]);
  mount();
  await started();
  await workerConfig.onSyncComplete(result);
  mocks.required.mockResolvedValue(["irish", "scottish"]);
  mocks.up.mockResolvedValueOnce({
    ...result,
    success: false,
    errors: ["Upload rejected"],
  });
  await workerConfig.onSyncComplete(result);
  await waitFor(() => expect(mocks.up).toHaveBeenCalledOnce());
  expect(mocks.down).not.toHaveBeenCalled();
  mocks.selected.mockResolvedValue(["irish", "scottish"]);
  await workerConfig.onSyncComplete(result);
  await waitFor(() => expect(mocks.down).toHaveBeenCalledOnce());
  expect(mocks.up).toHaveBeenCalledTimes(2);
});

it("publishes transport results before asynchronous completion work resumes", async () => {
  mount();
  await started();
  const gate = deferred<{ id: string }[]>();
  mocks.selectRows.mockReturnValueOnce(gate.promise);
  const oldCompletion = workerConfig.onSyncComplete(result);
  await waitFor(() => expect(mocks.selectRows).toHaveBeenCalledTimes(2));
  await workerConfig.onSyncComplete({
    ...result,
    success: false,
    errors: ["New failure"],
  });
  gate.resolve([{ id: user.id }]);
  await oldCompletion;
  const marker = document.querySelector("[data-sync-result-version]");
  expect(marker?.getAttribute("data-sync-result-version")).toBe("2");
  expect(marker?.getAttribute("data-sync-success")).toBe("false");
});

it("rejects a returned download failure without publishing a UI refresh", async () => {
  expectConsole(
    "error",
    "❌ [ForceSyncDown] Sync down failed:",
    expect.objectContaining({ message: "Download rejected" })
  );
  mocks.down.mockResolvedValueOnce({
    ...result,
    success: false,
    errors: ["Download rejected"],
  });
  mount();
  await started();
  const version = state.remoteSyncDownCompletionVersion();
  await expect(state.forceSyncDown({ full: true })).rejects.toThrow(
    "Download rejected"
  );
  expect(state.remoteSyncDownCompletionVersion()).toBe(version);
});

it("does not turn startup skipSync reconciliation into a delayed full pull", async () => {
  // No profile at startup; sync makes it available to subsequent lookups.
  mocks.selectRows
    .mockResolvedValueOnce([])
    .mockResolvedValue([{ id: user.id }]);
  setUser({ ...user, email: "owner-a@example.test" });
  mocks.selected.mockResolvedValue(["irish"]);
  mocks.required.mockResolvedValue(["irish", "scottish"]);
  mount();
  await started();
  await workerConfig.onSyncComplete(result);
  expect(mocks.upsert).toHaveBeenCalledOnce();
  mocks.selected.mockResolvedValue(["irish", "scottish"]);
  const version = state.catalogListChanged();
  await workerConfig.onSyncComplete(result);
  await waitFor(() =>
    expect(state.catalogListChanged()).toBeGreaterThan(version)
  );
  expect(mocks.up).not.toHaveBeenCalled();
  expect(mocks.down).not.toHaveBeenCalled();
});

it("discards the blocked account snapshot before reloading without starting sync", async () => {
  setUser({ ...user, email: "recovery@example.com" });
  const blocked = new BrowserSqliteMigrationBlockedError("outbox");
  mocks.initialize.mockRejectedValueOnce(blocked);
  mocks.discardBlocked.mockResolvedValue(undefined);
  expectConsole(
    "error",
    "Failed to initialize local database:",
    expect.objectContaining({ message: blocked.message, reason: "outbox" })
  );
  const reload = vi.fn();
  vi.stubGlobal("location", { reload, host: "staging.tunetrees.com" });
  mount();
  await screen.findByTestId("database-upgrade-blocked");
  expect(mocks.start).not.toHaveBeenCalled();
  await state.forceCleanLocalReset();
  expect(mocks.discardBlocked).toHaveBeenCalledExactlyOnceWith(user.id);
  // Runtime ownership can still belong to a previously initialized account.
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(reload).toHaveBeenCalledOnce();
  expect(mocks.initialize).toHaveBeenCalledOnce();
  expect(mocks.auth.signOut).not.toHaveBeenCalled();
});
