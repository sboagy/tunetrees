import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { createSignal, type ParentProps, useContext } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AuthState,
  TTAuthContext,
  TTAuthProvider,
} from "../../../src/lib/auth/TTAuthProvider";

type TestUser = {
  id: string;
  is_anonymous: boolean;
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
  autoCleanup: vi.fn(),
  selectRows: vi.fn(),
  insert: vi.fn(),
  repair: vi.fn(),
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
  buildGenreFilterOverrides: async () => ({}),
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
  mocks.repair.mockResolvedValue({});
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
});

describe("provider sync completion lifetime", () => {
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
