/**
 * TuneTrees Auth Provider
 *
 * Wraps @rhizome/core's AuthProvider with TuneTrees-specific auth state,
 * SQLite initialization, sync worker lifecycle, and catalog reconciliation.
 *
 * Architecture:
 * - Outer: `TTAuthProvider` renders rhizome's `AuthProvider` (owns Supabase auth lifecycle)
 *   with `overrideSignInAnonymously` for TT's session-restoration flow.
 * - Inner: `TTInner` (rendered inside rhizome's AuthProvider) reads rhizome's user/session/
 *   loading/isAnonymous signals and provides the full TT `AuthState` via `TTAuthContext`.
 *
 * @module auth/TTAuthProvider
 */

import {
  AuthProvider as RhizomeAuthProvider,
  useAuth as useRhizomeAuth,
} from "@rhizome/core";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { TABLE_REGISTRY } from "@sync-schema/table-meta";
import { sql } from "drizzle-orm";
import {
  BrowserSqliteMigrationBlockedError,
  type BrowserSqliteMigrationBlockReason,
} from "oosync/runtime/browser-sqlite";
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  type ParentComponent,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { DatabaseUpgradeBlocked } from "@/components/auth/DatabaseUpgradeBlocked";
import {
  clearDb as clearSqliteDb,
  closeDb as closeSqliteDb,
  getSqliteInstance,
  initializeDb as initializeSqliteDb,
  persistDb,
  type SqliteDatabase,
  setupAutoPersist,
} from "../db/client-sqlite";
import {
  enableSyncTriggers,
  suppressSyncTriggers,
} from "../db/install-triggers";
import {
  finishUpgradeFullPull,
  getUpgradeFullPullGeneration,
  withUpgradeIdentity,
} from "../db/upgrade-policy";
import {
  captureSyncBaselineSnapshot,
  installSyncBaselineFetchDiagnostics,
  markSyncBaselineEvent,
} from "../diagnostics/sync-baseline";
import { log } from "../logger";
import { supabase } from "../supabase/client";
import {
  clearOldOutboxItems,
  ensureSyncRuntimeConfigured,
  SyncInProgressError,
  type SyncService,
} from "../sync";
import { ownsActiveSync } from "../sync/completion-owner";

// ---------------------------------------------------------------------------
// Legacy anonymous user storage keys (kept for migration from old local-only approach)
// ---------------------------------------------------------------------------
const LEGACY_ANONYMOUS_USER_KEY = "tunetrees:anonymous:user";
const LEGACY_ANONYMOUS_USER_ID_KEY = "tunetrees:anonymous:userId";

// Key to persist anonymous session for "Use on this Device Only" feature.
// Allows anonymous users to return to their session after signing out, so their
// local practice data (keyed by the same user UUID) is still accessible.
const ANONYMOUS_SESSION_KEY = "tunetrees:anonymous:session";

// ---------------------------------------------------------------------------
// AuthState interface - the full TT-specific auth context shape
// (also exported from AuthContext.tsx for consumer convenience)
// ---------------------------------------------------------------------------

export interface AuthState {
  /** Current authenticated user (reactive) */
  user: Accessor<User | null>;
  /** Current authenticated user's UUID from user_profile.id (reactive) */
  userIdInt: Accessor<string | null>;
  /** Current session (reactive) */
  session: Accessor<Session | null>;
  /** Loading state during initialization */
  loading: Accessor<boolean>;
  /** Local SQLite database instance (null if not initialized) */
  localDb: Accessor<SqliteDatabase | null>;
  /** Remote sync down completion version - increments when syncDown completes (triggers UI updates) */
  remoteSyncDownCompletionVersion: Accessor<number>;
  /** Initial sync completed (true after first successful sync down) */
  initialSyncComplete: Accessor<boolean>;
  /** Anonymous mode - user is using app without account */
  isAnonymous: Accessor<boolean>;
  /** Increment remote sync down completion version to trigger UI refresh */
  incrementRemoteSyncDownCompletion: () => void;
  /** Practice list staged VIEW changed - increments after local writes affecting practice data */
  practiceListStagedChanged: Accessor<number>;
  /** Increment practice list staged change counter */
  incrementPracticeListStagedChanged: () => void;
  /** Catalog list VIEW changed - increments after local writes affecting catalog */
  catalogListChanged: Accessor<number>;
  /** Increment catalog list change counter */
  incrementCatalogListChanged: () => void;
  /** Repertoire list VIEW changed - increments after local writes affecting repertoire */
  repertoireListChanged: Accessor<number>;
  /** Increment repertoire list change counter */
  incrementRepertoireListChanged: () => void;
  /** Suppress the next sync-complete view refresh for a category (used for local-write sync echoes) */
  suppressNextViewRefresh: (
    category: ViewRefreshCategory,
    count?: number
  ) => void;
  /** Sign in with email and password */
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  /** Sign up with email and password */
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }>;
  /** Sign in with OAuth provider */
  signInWithOAuth: (
    provider: "google" | "github"
  ) => Promise<{ error: AuthError | null }>;
  /**
   * Sign in anonymously (local-only, no account).
   * Restores a previously saved anonymous session if one exists.
   * Pass injectedUserId for E2E test injection only.
   */
  signInAnonymously: (
    injectedUserId?: string
  ) => Promise<{ error: Error | null }>;
  /** Convert anonymous user to registered account */
  convertAnonymousToRegistered: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error: AuthError | Error | null }>;
  /** Sign out and clear local data */
  signOut: () => Promise<void>;
  /** Force sync down from Supabase (manual sync). Pass { full: true } to force a full (non-incremental) sync. */
  forceSyncDown: (opts?: { full?: boolean }) => Promise<void>;
  /** Force sync up to Supabase (push local changes immediately) */
  forceSyncUp: (opts?: { allowDeletes?: boolean }) => Promise<void>;
  /** Clear the local SQLite mirror while keeping the auth session, then rebuild from sync. */
  forceCleanLocalReset: () => Promise<void>;
  /** Catalog sync pending (true if initial sync excluded catalog tables until after onboarding) */
  catalogSyncPending: Accessor<boolean>;
  /** Trigger catalog sync after onboarding completion (pulls catalog tables with genre filter) */
  triggerCatalogSync: () => Promise<void>;
  /** Last successful syncDown ISO timestamp (null if none yet) */
  lastSyncTimestamp: Accessor<string | null>;
  /** Mode of last syncDown ('full' | 'incremental' | null if none yet) */
  lastSyncMode: Accessor<SyncPullMode>;
  /** Scoped practice sync (repertoire_tune, practice_record, daily_practice_queue, table_transient_data) */
  syncPracticeScope: () => Promise<void>;
}

type SyncPullMode = "full" | "incremental" | null;

type ViewRefreshCategory = "repertoire" | "practice" | "catalog";

function resolveCatalogGenreSelection(params: {
  selected: string[];
  required: string[];
  repertoireCount: number;
  repertoireTuneCount: number;
  repertoireDefaults: string[];
  tuneGenres: string[];
}): string[] {
  if (params.selected.length > 0) {
    return Array.from(new Set([...params.selected, ...params.required]));
  }
  if (params.repertoireCount === 0) return [];
  if (params.repertoireTuneCount > 0) {
    return Array.from(
      new Set([...params.tuneGenres, ...params.repertoireDefaults])
    );
  }
  return Array.from(new Set(params.repertoireDefaults));
}

type AuthSessionDiagnostic = {
  label: string;
  hasSession: boolean;
  userId: string | null;
  error: unknown;
  nowIso: string;
  expiresAtEpochSec: number | null;
  msUntilExpiry: number | null;
  accessTokenLength: number;
};

type AuthSessionDiagnosticError = {
  label?: string;
  error: string;
};

type AuthSessionDiagnosticResult =
  | AuthSessionDiagnostic
  | AuthSessionDiagnosticError;

type TuneTreesTestWindow = Window & {
  __forceSyncUpForTest?: () => Promise<void>;
  __forceSyncDownForTest?: () => Promise<void>;
  __forceCleanLocalResetForTest?: () => Promise<void>;
  __authSessionDiagForTest?: (
    label?: string
  ) => Promise<AuthSessionDiagnosticResult>;
  __lastAuthDiagHasSession?: boolean;
};

type AuthTestHooks = {
  forceSyncUpForTest: () => Promise<void>;
  forceSyncDownForTest: () => Promise<void>;
  forceCleanLocalResetForTest: () => Promise<void>;
  diagLog: (...args: unknown[]) => void;
};

type SavedAnonymousSession = {
  refreshToken?: string;
  userId?: string;
};

// ---------------------------------------------------------------------------
// Context - used by useAuth() in AuthContext.tsx
// ---------------------------------------------------------------------------
export const TTAuthContext = createContext<AuthState>();

async function createAuthSessionDiagnostic(
  label?: string
): Promise<AuthSessionDiagnosticResult> {
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session ?? null;
    const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : null;
    const nowMs = Date.now();
    return {
      label: label ?? "",
      hasSession: !!session,
      userId: session?.user?.id ?? null,
      error,
      nowIso: new Date(nowMs).toISOString(),
      expiresAtEpochSec: session?.expires_at ?? null,
      msUntilExpiry: expiresAtMs === null ? null : expiresAtMs - nowMs,
      accessTokenLength: session?.access_token?.length ?? 0,
    };
  } catch (error) {
    console.warn("AUTH DIAG ERROR", error);
    return { label, error: String(error) };
  }
}

function installAuthTestHooks(
  targetWindow: TuneTreesTestWindow,
  hooks: AuthTestHooks
) {
  targetWindow.__forceSyncUpForTest ??= async () => {
    try {
      await hooks.forceSyncUpForTest();
    } catch (error) {
      console.warn("__forceSyncUpForTest failed", error);
      throw error;
    }
  };
  targetWindow.__forceSyncDownForTest ??= async () => {
    try {
      await hooks.forceSyncDownForTest();
    } catch (error) {
      console.warn("__forceSyncDownForTest failed", error);
      throw error;
    }
  };
  targetWindow.__forceCleanLocalResetForTest ??= async () => {
    try {
      await hooks.forceCleanLocalResetForTest();
    } catch (error) {
      console.warn("__forceCleanLocalResetForTest failed", error);
    }
  };
  targetWindow.__authSessionDiagForTest ??= async (label?: string) => {
    const diagnostic = await createAuthSessionDiagnostic(label);
    if ("hasSession" in diagnostic) {
      hooks.diagLog("AUTH DIAG", diagnostic);
      targetWindow.__lastAuthDiagHasSession = diagnostic.hasSession;
    }
    return diagnostic;
  };
}

function parseSavedAnonymousSession(
  savedSession: string
): SavedAnonymousSession | null {
  const parsed: unknown = JSON.parse(savedSession);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const session = parsed as Record<string, unknown>;
  return {
    refreshToken:
      typeof session.refresh_token === "string"
        ? session.refresh_token
        : undefined,
    userId: typeof session.user_id === "string" ? session.user_id : undefined,
  };
}

// ---------------------------------------------------------------------------
// Helper: check if a Supabase user is anonymous
// ---------------------------------------------------------------------------
function isUserAnonymous(user: User | null): boolean {
  if (!user) return false;
  if (user.app_metadata?.is_anonymous === true) return true;
  const hasNoEmail = !user.email;
  const hasNoIdentities = !user.identities || user.identities.length === 0;
  const hasOnlyAnonymousIdentity =
    user.identities?.length === 1 &&
    user.identities[0]?.provider === "anonymous";
  return hasNoEmail && (hasNoIdentities || hasOnlyAnonymousIdentity);
}

function formatSyncErrorToast(message: string): {
  title: string;
  description: string;
} {
  const attemptMatch = /Sync upload failed \(attempt (\d+)\)/i.exec(message);

  let title = "Sync error";
  if (attemptMatch?.[1]) {
    title = `Sync upload failed (attempt ${attemptMatch[1]})`;
  } else if (/Background sync error/i.test(message)) {
    title = "Background sync error";
  }

  if (
    /constraint=tune_set_kind_check/i.test(message) ||
    /CHECK constraint failed: set_kind/i.test(message)
  ) {
    return {
      title,
      description:
        "Your setlist is saved locally, but the sync server still has the older tune_set kind constraint. Apply the latest Supabase migration or reset the local Supabase DB, then retry sync.",
    };
  }

  if (/Sync failed: 500/i.test(message)) {
    return {
      title,
      description:
        "Your changes are still saved locally, but the sync server rejected this upload. Check the console or worker logs for the detailed backend error.",
    };
  }

  if (/Background sync error/i.test(message)) {
    return {
      title,
      description: "Your local changes may not be uploaded yet.",
    };
  }

  return {
    title,
    description: message,
  };
}

function getDisplayNameFromAuthUser(authUser: User): string | null {
  const metadataName = authUser.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim().length > 0) {
    return metadataName;
  }
  return authUser.email?.split("@")[0] ?? null;
}

const PROFILE_DEPENDENT_PENDING_TABLES = [
  "daily_practice_queue",
  "goal",
  "group_member",
  "media_asset",
  "note",
  "practice_record",
  "prefs_scheduling_options",
  "prefs_spaced_repetition",
  "reference",
  "repertoire",
  "repertoire_tune",
  "setlist",
  "table_state",
  "table_transient_data",
  "tag",
  "tune",
  "tune_override",
  "tune_set",
  "user_genre_selection",
  "user_group",
] as const;

async function repairMissingUserProfileOutboxItem(
  db: SqliteDatabase,
  userId: string
): Promise<void> {
  const pendingProfileRows = db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM sync_push_queue
    WHERE table_name = 'user_profile'
      AND row_id = ${userId}
      AND status IN ('pending', 'failed', 'in_progress')
  `);
  if (Number(pendingProfileRows[0]?.count ?? 0) > 0) return;

  const dependentTableList = PROFILE_DEPENDENT_PENDING_TABLES.map(
    (tableName) => `'${tableName}'`
  ).join(", ");
  const pendingDependentRows = db.all<{ count: number }>(
    sql.raw(`
    SELECT COUNT(*) AS count
    FROM sync_push_queue
    WHERE table_name IN (${dependentTableList})
      AND status IN ('pending', 'failed', 'in_progress')
  `)
  );
  if (Number(pendingDependentRows[0]?.count ?? 0) === 0) return;

  db.run(sql`
    INSERT INTO sync_push_queue (id, table_name, row_id, operation, changed_at)
    VALUES (
      lower(hex(randomblob(16))),
      'user_profile',
      ${userId},
      'UPDATE',
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    )
  `);
  markSyncBaselineEvent("local-db:user-profile-outbox-repaired", {
    userId,
  });
}

// ---------------------------------------------------------------------------
const TTInner: ParentComponent = (props) => {
  // Read user/session/loading/isAnonymous reactively from rhizome's AuthProvider.
  // TTAuthContext forwards these plus TT-specific state to consumers.
  const rhizome = useRhizomeAuth();

  const [upgradeBlocked, setUpgradeBlocked] =
    createSignal<BrowserSqliteMigrationBlockReason | null>(null);

  // TT-specific signals
  const [userIdInt, setUserIdInt] = createSignal<string | null>(null);
  const [localDb, setLocalDb] = createSignal<SqliteDatabase | null>(null);
  const [remoteSyncDownCompletionVersion, setRemoteSyncDownCompletionVersion] =
    createSignal(0);
  const [syncResultVersion, setSyncResultVersion] = createSignal(0);
  const [initialSyncComplete, setInitialSyncComplete] = createSignal(false);
  const [catalogSyncPending, setCatalogSyncPending] = createSignal(false);
  const [anonymousCatalogSyncRequested, setAnonymousCatalogSyncRequested] =
    createSignal(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = createSignal<string | null>(
    null
  );
  const [lastSyncMode, setLastSyncMode] = createSignal<SyncPullMode>(null);
  const [lastSyncSuccess, setLastSyncSuccess] = createSignal<boolean | null>(
    null
  );
  const [lastSyncErrorCount, setLastSyncErrorCount] = createSignal(0);
  const [lastSyncErrorSummary, setLastSyncErrorSummary] = createSignal<
    string | null
  >(null);

  // View-specific change signals for optimistic updates
  const [practiceListStagedChanged, setPracticeListStagedChanged] =
    createSignal(0);
  const [catalogListChanged, setCatalogListChanged] = createSignal(0);
  const [repertoireListChanged, setRepertoireListChanged] = createSignal(0);
  const suppressedViewRefreshCounts: Partial<
    Record<ViewRefreshCategory, number>
  > = {};

  // Sync worker cleanup and service instance
  let stopSyncWorker: (() => void) | null = null;
  let syncServiceInstance: SyncService | null = null;
  let autoPersistCleanup: (() => void) | null = null;
  let isInitializing = false;
  let disposed = false;
  let lifecycleVersion = 0;
  let injectedTestInitialization: Promise<void> | null = null;
  let signOutCleanup: Promise<void> | null = null;
  let syncShutdown: Promise<void> | null = null;
  const retiringSyncServices = new Set<SyncService>();
  let needsSignOutCleanup = false;
  const captureLifetime = (userId: string) => {
    const version = lifecycleVersion;
    return () =>
      !disposed &&
      version === lifecycleVersion &&
      rhizome.user()?.id === userId;
  };
  const invalidateSync = () => {
    lifecycleVersion += 1;
    isInitializing = false;
    stopSyncWorker?.();
    stopSyncWorker = null;
    syncServiceInstance = null;
  };
  const drainSync = () => {
    const service = syncServiceInstance;
    invalidateSync();
    if (service) retiringSyncServices.add(service);
    // Keep detached services until teardown succeeds, including across an
    // overlapping reset/sign-out or a retry after subscription cleanup fails.
    syncShutdown ??= (async () => {
      for (const retiring of retiringSyncServices) {
        await retiring.destroy();
        retiringSyncServices.delete(retiring);
      }
    })().finally(() => {
      syncShutdown = null;
    });
    return syncShutdown;
  };
  onCleanup(() => {
    disposed = true;
    invalidateSync();
    autoPersistCleanup?.();
    autoPersistCleanup = null;
  });

  // Catalog reconciliation tracking
  let catalogSelectionReconciledKey: string | null = null;
  const pendingCatalogRefresh = new Set<string>();
  const catalogReconciliations = new Set<string>();
  let reconcileRunCount = 0;
  const RECONCILE_CHECK_INTERVAL = 10;

  let offlineMediaMaintenancePromise: Promise<void> | null = null;

  const SYNC_DIAGNOSTICS = import.meta.env.VITE_SYNC_DIAGNOSTICS === "true";
  let syncDiagnosticsRan = false;
  installSyncBaselineFetchDiagnostics();
  markSyncBaselineEvent("auth-provider:mounted");

  const diagLog = (...args: unknown[]): void => {
    if (SYNC_DIAGNOSTICS) console.log(...args);
  };

  const runOfflineMediaMaintenance = async (
    isCurrent: () => boolean = () => true
  ) => {
    if (!isCurrent()) return;
    const db = localDb();
    const currentUser = rhizome.user();
    const accessToken = rhizome.session()?.access_token;

    if (
      !db ||
      !currentUser?.id ||
      !accessToken ||
      (typeof navigator !== "undefined" && !navigator.onLine)
    ) {
      return;
    }

    if (offlineMediaMaintenancePromise) {
      markSyncBaselineEvent("offline-media:join-existing");
      return await offlineMediaMaintenancePromise;
    }

    offlineMediaMaintenancePromise = (async () => {
      try {
        markSyncBaselineEvent("offline-media:start", {
          userId: currentUser.id,
        });
        const [{ processPendingNoteMediaDrafts }, { syncPinnedAudioVault }] =
          await Promise.all([
            import("@/lib/media/offline-note-media"),
            import("@/lib/media/audio-lookahead"),
          ]);

        if (!isCurrent()) return;
        await processPendingNoteMediaDrafts({
          db,
          userId: currentUser.id,
          accessToken,
        });
        if (!isCurrent()) return;
        await syncPinnedAudioVault({
          db,
          userId: currentUser.id,
          accessToken,
        });
        markSyncBaselineEvent("offline-media:success", {
          userId: currentUser.id,
        });
      } catch (error) {
        markSyncBaselineEvent("offline-media:error", {
          error: error instanceof Error ? error.message : String(error),
        });
        console.warn(
          "[TTAuthProvider] Offline media maintenance failed:",
          error
        );
      } finally {
        offlineMediaMaintenancePromise = null;
      }
    })();

    await offlineMediaMaintenancePromise;
  };

  const persistDbAfterSync = async (isCurrent: () => boolean) => {
    try {
      const { persistDb } = await import("@/lib/db/client-sqlite");
      if (!isCurrent()) return;
      await persistDb();
    } catch (e) {
      console.warn("⚠️ [TTAuthProvider] Failed to persist after sync:", e);
    }
  };

  // ---------------------------------------------------------------------------
  // Suppress / consume view refresh tokens
  // ---------------------------------------------------------------------------
  const suppressNextViewRefresh = (
    category: "repertoire" | "practice" | "catalog",
    count = 1
  ) => {
    if (count <= 0) return;
    suppressedViewRefreshCounts[category] =
      (suppressedViewRefreshCounts[category] ?? 0) + count;
    diagLog(
      `[TTAuthProvider] Suppressing next ${count} sync refresh(es) for category=${category}`
    );
  };

  const consumeSuppressedViewRefresh = (
    category: ViewRefreshCategory
  ): boolean => {
    const remaining = suppressedViewRefreshCounts[category] ?? 0;
    if (remaining <= 0) return false;
    if (remaining <= 1) {
      delete suppressedViewRefreshCounts[category];
    } else {
      suppressedViewRefreshCounts[category] = remaining - 1;
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Sync diagnostics
  // ---------------------------------------------------------------------------
  async function runSyncDiagnostics(db: SqliteDatabase): Promise<void> {
    try {
      const now = new Date().toISOString();
      const totals = db.all<{ table: string; count: number }>(sql`
        SELECT 'user_profile' AS table, COUNT(*) AS count FROM user_profile
        UNION ALL SELECT 'repertoire', COUNT(*) FROM repertoire
        UNION ALL SELECT 'repertoire_tune', COUNT(*) FROM repertoire_tune
        UNION ALL SELECT 'tune', COUNT(*) FROM tune
        UNION ALL SELECT 'practice_record', COUNT(*) FROM practice_record
        UNION ALL SELECT 'daily_practice_queue', COUNT(*) FROM daily_practice_queue
      `);
      const repertoireSummary = db.all<{
        repertoire_id: string;
        name: string | null;
        user_ref: string;
        deleted: number;
        tune_count: number;
        active_queue: number;
        staged_rows: number;
      }>(sql`
        SELECT
          p.repertoire_id,
          p.name,
          p.user_ref,
          p.deleted,
          (SELECT COUNT(*) FROM repertoire_tune pt WHERE pt.repertoire_ref = p.repertoire_id AND pt.deleted = 0) AS tune_count,
          (SELECT COUNT(*) FROM daily_practice_queue dpq WHERE dpq.repertoire_ref = p.repertoire_id AND dpq.active = 1) AS active_queue,
          (SELECT COUNT(*) FROM practice_list_staged pls WHERE pls.repertoire_id = p.repertoire_id AND pls.repertoire_deleted = 0 AND pls.deleted = 0) AS staged_rows
        FROM repertoire p ORDER BY tune_count DESC LIMIT 10
      `);
      const allForeignKeyViolations = db.all<{
        table: string;
        rowid: number | string | null;
        parent: string;
        fkid: number | string | null;
      }>("PRAGMA foreign_key_check");
      const foreignKeyViolations = allForeignKeyViolations.slice(0, 25);
      console.warn("🔎 [SYNC_DIAG] Snapshot", {
        at: now,
        totals,
        topRepertoires: repertoireSummary,
        foreignKeyViolationCount: allForeignKeyViolations.length,
        foreignKeyViolations,
      });
    } catch (e) {
      console.warn("⚠️ [SYNC_DIAG] Failed to collect diagnostics", e);
    }
  }

  // ---------------------------------------------------------------------------
  // Get user internal ID from local SQLite (auth UUID = user_profile.id PK)
  // ---------------------------------------------------------------------------
  async function getUserInternalIdFromLocalDb(
    db: SqliteDatabase,
    authUserId: string
  ): Promise<string | null> {
    try {
      const { userProfile } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      const result = await db
        .select({ id: userProfile.id })
        .from(userProfile)
        .where(eq(userProfile.id, authUserId))
        .limit(1);
      if (result && result.length > 0) return result[0].id;
      return null;
    } catch (error) {
      log.error("Failed to get user internal ID from local DB:", error);
      return null;
    }
  }

  async function ensureLocalUserProfileAnchor(
    db: SqliteDatabase,
    authUser: User
  ): Promise<{ id: string; created: boolean }> {
    const existingId = await getUserInternalIdFromLocalDb(db, authUser.id);
    if (existingId) {
      await repairMissingUserProfileOutboxItem(db, existingId);
      return { id: existingId, created: false };
    }

    const { userProfile } = await import("@/lib/db/schema");
    const now = new Date().toISOString();
    await db.insert(userProfile).values({
      id: authUser.id,
      name: getDisplayNameFromAuthUser(authUser),
      email: authUser.email ?? null,
      srAlgType: "fsrs",
      deleted: 0,
      syncVersion: 1,
      lastModifiedAt: now,
      deviceId: "local",
    });

    markSyncBaselineEvent("local-db:user-profile-anchor-created", {
      userId: authUser.id,
    });
    console.log(
      "✅ Created local user_profile anchor for authenticated user:",
      authUser.id
    );

    return { id: authUser.id, created: true };
  }

  // ---------------------------------------------------------------------------
  // Catalog genre reconciliation
  // ---------------------------------------------------------------------------
  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const aSorted = [...a].sort((x, y) => x.localeCompare(y));
    const bSorted = [...b].sort((x, y) => x.localeCompare(y));
    return aSorted.every((id, index) => id === bSorted[index]);
  };

  const reconcileCatalogSelection = async (params: {
    db: SqliteDatabase;
    userId: string;
    isAnonymousUser: boolean;
    skipSync?: boolean;
    isCurrent: () => boolean;
  }) => {
    const { isCurrent } = params;
    if (!isCurrent() || catalogReconciliations.has(params.userId)) return;
    catalogReconciliations.add(params.userId);
    try {
      const [genreSelection, genreQueries] = await Promise.all([
        import("@/lib/db/queries/user-genre-selection"),
        import("@/lib/db/queries/genres"),
      ]);
      if (!isCurrent()) return;

      const selected = await genreSelection.getUserGenreSelection(
        params.db,
        params.userId
      );
      if (!isCurrent()) return;
      const required = await genreSelection.getRequiredGenreIdsForUser(
        params.db,
        params.userId
      );
      if (!isCurrent()) return;
      const { repertoireCount, repertoireTuneCount } =
        await genreSelection.getUserRepertoireStats(params.db, params.userId);
      if (!isCurrent()) return;
      const repertoireDefaults =
        await genreSelection.getRepertoireGenreDefaultsForUser(
          params.db,
          params.userId
        );
      if (!isCurrent()) return;
      const tuneGenres = await genreSelection.getRepertoireTuneGenreIdsForUser(
        params.db,
        params.userId
      );
      if (!isCurrent()) return;

      const selectedKey = [...selected]
        .sort((a, b) => a.localeCompare(b))
        .join(",");
      const requiredKey = [...required]
        .sort((a, b) => a.localeCompare(b))
        .join(",");
      const repertoireDefaultsKey = [...repertoireDefaults]
        .sort((a, b) => a.localeCompare(b))
        .join(",");
      const tuneGenresKey = [...tuneGenres]
        .sort((a, b) => a.localeCompare(b))
        .join(",");
      const reconcileKey = [
        params.userId,
        `selected:${selectedKey}`,
        `required:${requiredKey}`,
        `defaults:${repertoireDefaultsKey}`,
        `tunes:${tuneGenresKey}`,
        `repertoireCount:${repertoireCount}`,
        `repertoireTuneCount:${repertoireTuneCount}`,
      ].join("|");

      const shouldReconcile =
        pendingCatalogRefresh.has(params.userId) ||
        catalogSelectionReconciledKey !== reconcileKey ||
        reconcileRunCount % RECONCILE_CHECK_INTERVAL === 0;

      reconcileRunCount++;

      if (!shouldReconcile) return;

      catalogSelectionReconciledKey = reconcileKey;

      const effectiveSelected = resolveCatalogGenreSelection({
        selected,
        required,
        repertoireCount,
        repertoireTuneCount,
        repertoireDefaults,
        tuneGenres,
      });

      if (effectiveSelected.length === 0) return;

      const selectionChanged = !arraysEqual(selected, effectiveSelected);
      if (selectionChanged) {
        // Startup reconciliation explicitly skips sync; it must not schedule a
        // delayed full pull that races the user's first interactions.
        if (!params.skipSync) pendingCatalogRefresh.add(params.userId);
        await genreSelection.upsertUserGenreSelection(
          params.db,
          params.userId,
          effectiveSelected
        );
        if (!isCurrent()) return;
      }

      const allGenres = await genreQueries.getAllGenres(params.db);
      if (!isCurrent()) return;
      const unselected = allGenres
        .map((g) => g.id)
        .filter((id) => !effectiveSelected.includes(id));

      const purgeResult = await genreSelection.purgeLocalCatalogForGenres(
        params.db,
        params.userId,
        unselected,
        isCurrent
      );
      if (!isCurrent()) return;

      if (!params.skipSync && purgeResult.tuneIds.length > 0)
        pendingCatalogRefresh.add(params.userId);

      if (!params.skipSync && pendingCatalogRefresh.has(params.userId)) {
        if (!params.isAnonymousUser) {
          await forceSyncUp({ allowDeletes: true }, isCurrent);
          if (!isCurrent()) return;
        }
        await forceSyncDown({ full: true }, isCurrent);
        if (!isCurrent()) return;
        pendingCatalogRefresh.delete(params.userId);
      }

      incrementCatalogListChanged();
    } catch (error) {
      console.warn(
        "[TTAuthProvider] Failed to reconcile catalog genre selection:",
        error
      );
    } finally {
      catalogReconciliations.delete(params.userId);
    }
  };

  // ---------------------------------------------------------------------------
  // Start sync worker
  // ---------------------------------------------------------------------------
  async function startSyncWorkerForUser(
    db: SqliteDatabase,
    authUserId: string,
    isAnonymousUser: boolean
  ): Promise<void> {
    const ownsLifetime = captureLifetime(authUserId);
    const isCurrentStartup = () => ownsLifetime() && localDb() === db;
    if (!isCurrentStartup()) return;
    markSyncBaselineEvent("sync-worker:start", {
      userId: authUserId,
      isAnonymousUser,
    });
    await captureSyncBaselineSnapshot("before-sync-worker", db, authUserId);
    if (!isCurrentStartup()) return;

    let firstSyncCompletionHandled = false;
    const signalAffectedChangeCategories = (affectedTables?: string[]) => {
      try {
        if (!affectedTables || affectedTables.length === 0) {
          return;
        }

        const categories = new Set<string>();
        for (const table of affectedTables) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const meta = (TABLE_REGISTRY as any)[table];
          if (meta?.changeCategory) {
            categories.add(meta.changeCategory);
          }
        }

        if (categories.has("repertoire")) {
          if (!consumeSuppressedViewRefresh("repertoire")) {
            incrementRepertoireListChanged();
          }
        }
        if (categories.has("practice")) {
          if (!consumeSuppressedViewRefresh("practice")) {
            incrementPracticeListStagedChanged();
          }
        }
        if (categories.has("catalog")) {
          if (!consumeSuppressedViewRefresh("catalog")) {
            incrementCatalogListChanged();
          }
        }
      } catch (e) {
        log.error("[TTAuthProvider] Error in granular signaling:", e);
      }
    };

    let userSyncService: SyncService | null = null;
    let syncStopped = false;
    const isCurrentSync = () =>
      isCurrentStartup() &&
      !syncStopped &&
      ownsActiveSync(
        { userId: authUserId, database: db, service: userSyncService },
        {
          userId: rhizome.user()?.id ?? null,
          database: localDb(),
          service: syncServiceInstance,
        }
      );
    let completionPullMode: SyncPullMode = null;
    let completionPullGeneration: string | null = null;
    const requestOverridesProvider = async () => {
      // One service operation can upload/download and then download again.
      // Retain the first full pull and its generation until onSyncComplete;
      // the second engine call may already see the advanced cursor.
      if (completionPullMode !== "full") {
        completionPullGeneration = getUpgradeFullPullGeneration(authUserId);
        completionPullMode = userSyncService?.getLastSyncDownTimestamp()
          ? "incremental"
          : "full";
      }
      try {
        const { buildGenreFilterOverrides } = await import(
          "@/lib/sync/genre-filter"
        );
        const isInitialSync =
          !syncServiceInstance?.getLastSyncDownTimestamp?.();
        const localInternalId = await getUserInternalIdFromLocalDb(
          db,
          authUserId
        );
        const internalId =
          localInternalId ?? (isInitialSync ? authUserId : null);
        if (!internalId) {
          markSyncBaselineEvent("request-overrides:user-profile-missing", {
            userId: authUserId,
          });
          console.warn(
            "[TTAuthProvider] Failed to resolve internal user id for genre filtering"
          );
          return null;
        }
        if (!localInternalId && isInitialSync) {
          markSyncBaselineEvent("request-overrides:auth-user-id-fallback", {
            userId: authUserId,
          });
        }

        markSyncBaselineEvent("request-overrides:resolved", {
          userId: authUserId,
          isInitialSync,
          isAnonymousUser,
        });

        if (isAnonymousUser && isInitialSync && catalogSyncPending()) {
          const pullTablesOverride = {
            pullTables: [
              "genre",
              "genre_tune_type",
              "tune_type",
              "instrument",
              "user_profile",
              // Queue allocation needs definitions even for device-only users.
              "goal",
              "goal_user_settings",
              "user_genre_selection",
              "repertoire",
            ],
          };
          return pullTablesOverride;
        }

        if (isAnonymousUser && anonymousCatalogSyncRequested()) {
          const catalogTablesOverride = {
            pullTables: [
              // Public notes/references require their authors as FK parents.
              // The initial metadata pull precedes the selected catalog genres.
              "user_profile",
              "goal",
              "goal_user_settings",
              "tune",
              "reference",
              "media_asset",
              "note",
              "repertoire_tune",
              "practice_record",
              "tune_override",
              "daily_practice_queue",
              "tab_group_main_state",
              "table_state",
              "table_transient_data",
              "tag",
              "prefs_scheduling_options",
              "prefs_spaced_repetition",
            ],
          };
          const genreOverrides = await buildGenreFilterOverrides({
            db,
            supabase,
            userId: internalId,
            // Anonymous onboarding writes genre selections locally before the
            // first catalog pull. Use that local selection even when the sync
            // service has not recorded an initial down timestamp yet.
            isInitialSync: false,
          });
          return { ...catalogTablesOverride, ...genreOverrides };
        }

        return await buildGenreFilterOverrides({
          db,
          supabase,
          userId: internalId,
          isInitialSync,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isNetworkError =
          errorMsg.includes("Failed to fetch") ||
          errorMsg.includes("ERR_INTERNET_DISCONNECTED") ||
          errorMsg.includes("NetworkError") ||
          errorMsg.includes(
            "Timed out while waiting for an open slot in the pool"
          ) ||
          errorMsg.includes("Sync failed: 503");
        if (!isNetworkError) {
          console.error(
            "[TTAuthProvider] Failed to build sync overrides:",
            error
          );
        }
        // A missing filter is not a successful unfiltered sync. Propagate the
        // failure so SyncService retries without advancing its initial cursor.
        throw error;
      }
    };

    try {
      markSyncBaselineEvent("startup-repair:start", {
        userId: authUserId,
      });
      const {
        repairPendingMediaAssetSyncState,
        repairPendingSetlistSyncState,
      } = await import("@/lib/sync/genre-filter");
      if (!isCurrentStartup()) return;
      const repairResult = await repairPendingMediaAssetSyncState();
      if (!isCurrentStartup()) return;
      const setlistRepairResult = await repairPendingSetlistSyncState();
      if (!isCurrentStartup()) return;
      markSyncBaselineEvent("startup-repair:success", {
        media: repairResult,
        setlists: setlistRepairResult,
      });
      if (
        repairResult.requeuedReferenceCount > 0 ||
        repairResult.prunedMediaAssetCount > 0 ||
        repairResult.clearedMediaAssetOutboxCount > 0
      ) {
        console.warn(
          "[TTAuthProvider] Repaired pending media_asset sync state before startup sync",
          repairResult
        );
      }
      if (
        setlistRepairResult.requeuedSetlistCount > 0 ||
        setlistRepairResult.requeuedTuneSetCount > 0 ||
        setlistRepairResult.requeuedGroupCount > 0
      ) {
        console.warn(
          "[TTAuthProvider] Repaired pending setlist sync state before startup sync",
          setlistRepairResult
        );
      }
    } catch (error) {
      markSyncBaselineEvent("startup-repair:error", {
        error: error instanceof Error ? error.message : String(error),
      });
      console.warn(
        "[TTAuthProvider] Failed to repair pending sync state before startup sync",
        error
      );
    }

    if (!isCurrentStartup()) return;
    const syncModule = await import("@oosync/sync");
    if (!isCurrentStartup()) return;
    markSyncBaselineEvent("sync-module:loaded", {
      userId: authUserId,
    });
    const startWorker = (syncModule as any).startSyncWorker as (
      db: SqliteDatabase,
      config: unknown
    ) => { service: SyncService; stop: () => void };

    const recordSyncStatus = (result: {
      success?: boolean;
      errors?: unknown[];
      timestamp?: string;
    }) => {
      setLastSyncSuccess(result?.success ?? null);
      const errorCount = result?.errors?.length ?? 0;
      setLastSyncErrorCount(errorCount);
      if (errorCount > 0) {
        const first = result?.errors?.[0];
        let summary: string;
        try {
          summary =
            typeof first === "string" ? first : (JSON.stringify(first) ?? "");
        } catch {
          summary = String(first);
        }
        setLastSyncErrorSummary(summary);
      } else {
        setLastSyncErrorSummary(null);
      }

      if (syncServiceInstance) {
        const ts = syncServiceInstance.getLastSyncDownTimestamp();
        if (ts) setLastSyncTimestamp(ts);
        const mode = syncServiceInstance.getLastSyncMode();
        if (mode) setLastSyncMode(mode);
      } else if (result?.timestamp) {
        setLastSyncTimestamp(result.timestamp);
      }
    };

    stopSyncWorker?.();
    const syncWorker = startWorker(db, {
      supabase,
      userId: authUserId,
      realtimeEnabled:
        !isAnonymousUser && import.meta.env.VITE_REALTIME_ENABLED === "true",
      syncIntervalMs: isAnonymousUser ? 30000 : 5000,
      notifyError: (message: string, _options?: { duration?: number }) => {
        const toastContent = formatSyncErrorToast(message);
        toast.error(toastContent.title, {
          description: toastContent.description,
          duration: Infinity,
          closeButton: true,
          id: "sync-error",
        });
      },
      pullOnly: isAnonymousUser,
      requestOverridesProvider,
      onSyncComplete: async (result: {
        success?: boolean;
        errors?: unknown[];
        timestamp?: string;
        affectedTables?: string[];
      }) => {
        // Teardown does not cancel in-flight oosync requests. Ignore their
        // callbacks once the user, DB, service, or lifetime has changed.
        if (!isCurrentSync()) return;
        markSyncBaselineEvent("sync-complete:callback:start", {
          success: result?.success ?? null,
          errorCount: result?.errors?.length ?? 0,
          affectedTables: result?.affectedTables ?? [],
          timestamp: result?.timestamp ?? null,
        });
        // Publish transport completion before any asynchronous reconciliation. UI refresh
        // callbacks can finish out of order and must not impersonate a newer sync result.
        recordSyncStatus(result);
        setSyncResultVersion((previous) => previous + 1);
        const completedPullMode = completionPullMode;
        const completedPullGeneration = completionPullGeneration;
        completionPullMode = null;
        completionPullGeneration = null;
        if (
          result.success &&
          !result.errors?.length &&
          completedPullMode === "full" &&
          userSyncService?.getLastSyncDownTimestamp() &&
          !catalogSyncPending()
        ) {
          try {
            await finishUpgradeFullPull(
              authUserId,
              persistDb,
              completedPullGeneration,
              isCurrentSync
            );
          } catch (error) {
            log.warn(
              "Keeping upgrade recovery marker after persistence failure",
              error
            );
          }
        }
        if (!isCurrentSync()) return;
        const isFirstSyncCompletion = !firstSyncCompletionHandled;
        if (isFirstSyncCompletion) firstSyncCompletionHandled = true;

        if (!initialSyncComplete()) {
          const internalId = await getUserInternalIdFromLocalDb(db, authUserId);
          if (!isCurrentSync()) return;
          if (internalId) {
            setUserIdInt(internalId);
            markSyncBaselineEvent("initial-sync:user-profile-found", {
              userId: authUserId,
              internalId,
            });
          } else if (isAnonymousUser) {
            setUserIdInt(authUserId);
            markSyncBaselineEvent("initial-sync:anonymous-user-id", {
              userId: authUserId,
            });
            // e2e/tests/anonymous-003-account-conversion.spec.ts depends on this log
            console.log(
              `✅ [TTAuthProvider] Anonymous user - using auth ID as internal ID`
            );
          } else {
            markSyncBaselineEvent("initial-sync:user-profile-missing", {
              userId: authUserId,
            });
            log.warn(
              "User profile not found in local DB after initial sync - this may cause issues"
            );
          }

          markSyncBaselineEvent("catalog-reconcile:first-sync:start", {
            userId: authUserId,
          });
          await reconcileCatalogSelection({
            db,
            userId: authUserId,
            isAnonymousUser,
            skipSync: true,
            isCurrent: isCurrentSync,
          });
          if (!isCurrentSync()) return;
          markSyncBaselineEvent("catalog-reconcile:first-sync:done", {
            userId: authUserId,
          });

          setInitialSyncComplete(true);
          markSyncBaselineEvent("initial-sync:complete-signal-set", {
            userId: authUserId,
          });
          await captureSyncBaselineSnapshot(
            "after-initial-sync-complete",
            db,
            authUserId
          );
          if (!isCurrentSync()) return;
          void persistDbAfterSync(isCurrentSync);
        }

        setRemoteSyncDownCompletionVersion((prev) => prev + 1);
        markSyncBaselineEvent("sync-version:incremented", {
          version: remoteSyncDownCompletionVersion(),
          userId: authUserId,
        });

        if (!isFirstSyncCompletion && result.success) {
          setTimeout(() => {
            if (!isCurrentSync()) return;
            void reconcileCatalogSelection({
              db,
              userId: authUserId,
              isAnonymousUser,
              isCurrent: isCurrentSync,
            });
          }, 0);
        }

        if (isFirstSyncCompletion) {
          triggerAllViewSignals();
          markSyncBaselineEvent("view-signals:trigger-all", {
            userId: authUserId,
          });
        }

        if (
          SYNC_DIAGNOSTICS &&
          !syncDiagnosticsRan &&
          result?.success === true
        ) {
          syncDiagnosticsRan = true;
          await runSyncDiagnostics(db);
          if (!isCurrentSync()) return;
        }

        signalAffectedChangeCategories(result.affectedTables);

        await runOfflineMediaMaintenance(isCurrentSync);
        if (!isCurrentSync()) return;
        await captureSyncBaselineSnapshot(
          "after-sync-complete-callback",
          db,
          authUserId
        );
        markSyncBaselineEvent("sync-complete:callback:done", {
          success: result?.success ?? null,
          userId: authUserId,
        });
      },
    });
    markSyncBaselineEvent("sync-worker:started", {
      userId: authUserId,
      isAnonymousUser,
    });

    const stop = () => {
      syncStopped = true;
      syncWorker.stop();
    };

    // E2E-only: expose sync control surface for Playwright
    if ((globalThis.window as any)?.__ttTestApi) {
      (globalThis.window as any).__ttSyncControl = {
        stop: async () => {
          stop();
          try {
            await syncWorker.service.destroy();
          } catch (e) {
            console.warn("[E2E] Failed to destroy SyncService:", e);
          }
        },
        isSyncing: () => syncWorker.service.syncing,
        waitForIdle: async (timeoutMs: number = 2000) => {
          const start = performance.now();
          while (
            syncWorker.service.syncing &&
            performance.now() - start < timeoutMs
          ) {
            await new Promise((r) => setTimeout(r, 50));
          }
          return !syncWorker.service.syncing;
        },
      };
    }

    userSyncService = syncWorker.service;
    // Publish synchronously with creation, before any completion can resume.
    stopSyncWorker = stop;
    syncServiceInstance = syncWorker.service;
  }

  // ---------------------------------------------------------------------------
  // DB init helpers
  // ---------------------------------------------------------------------------
  function isE2eDbClearInProgress(): boolean {
    return (globalThis.window as any)?.__ttE2eIsClearing === true;
  }

  function isDbInitAbortError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      msg.includes("Database initialization aborted") ||
      msg.includes("clearDb() was called during initialization")
    );
  }

  function isTransientDbInitError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      isDbInitAbortError(error) ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("ERR_INTERNET_DISCONNECTED") ||
      msg.includes("The network connection was lost") ||
      msg.includes("Load failed") ||
      msg.includes("callback is no longer runnable")
    );
  }

  async function initializeSqliteDbWithRetry(
    userId: string,
    context: "anonymous" | "authenticated",
    isCurrent: () => boolean
  ): Promise<SqliteDatabase | null> {
    const maxAttempts = 4;
    let attempt = 0;
    const contextLabel =
      context === "anonymous" ? "Anonymous DB init" : "DB init";
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!isCurrent()) return null;
      attempt += 1;
      try {
        setUpgradeBlocked(null);
        return await withUpgradeIdentity(
          userId,
          context === "authenticated",
          () => initializeSqliteDb(userId)
        );
      } catch (error) {
        if (!isCurrent()) return null;
        if (error instanceof BrowserSqliteMigrationBlockedError) {
          setUpgradeBlocked(error.reason);
          throw error;
        }
        if (isE2eDbClearInProgress()) {
          console.warn(
            `[TTAuthProvider] ${contextLabel} aborted during E2E clear; not retrying`
          );
          return null;
        }
        if (!isTransientDbInitError(error) || attempt >= maxAttempts) {
          throw error;
        }
        const delayMs = 75 * attempt;
        console.warn(
          `[TTAuthProvider] ${contextLabel} transient failure (attempt ${attempt}/${maxAttempts}); retrying in ${delayMs}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async function initializeAnonymousDatabase(
    anonymousUserId: string,
    testLifetime?: () => boolean
  ) {
    const isCurrent = testLifetime ?? captureLifetime(anonymousUserId);
    if (!isCurrent() || isE2eDbClearInProgress()) return;
    if (isInitializing) return;

    const existingDb = localDb();
    const currentUserId = userIdInt();
    if (existingDb && currentUserId === anonymousUserId) return;

    if (currentUserId && currentUserId !== anonymousUserId) {
      setInitialSyncComplete(false);
      setCatalogSyncPending(true);
      setUserIdInt(null);
    }

    isInitializing = true;
    try {
      log.info(
        "Initializing local database for anonymous user",
        anonymousUserId
      );
      const db = await initializeSqliteDbWithRetry(
        anonymousUserId,
        "anonymous",
        isCurrent
      );
      if (!db || !isCurrent()) return;

      setLocalDb(db);
      if (autoPersistCleanup) {
        autoPersistCleanup();
        autoPersistCleanup = null;
      }
      autoPersistCleanup = setupAutoPersist();

      const now = new Date().toISOString();

      try {
        const { userProfile } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");
        const existingLocal = await db
          .select({ id: userProfile.id })
          .from(userProfile)
          .where(eq(userProfile.id, anonymousUserId))
          .limit(1);

        if (!isCurrent()) return;
        if (!existingLocal || existingLocal.length === 0) {
          const rawDb = await getSqliteInstance();
          if (!isCurrent()) return;
          try {
            if (rawDb) suppressSyncTriggers(rawDb);
          } catch (e) {
            console.warn(
              "[TTAuthProvider] Failed to suppress sync triggers for anonymous local profile insert:",
              e
            );
          }
          try {
            await db.insert(userProfile).values({
              id: anonymousUserId,
              name: "Anonymous User",
              email: null,
              srAlgType: "fsrs",
              deleted: 0,
              syncVersion: 1,
              lastModifiedAt: now,
              deviceId: "local",
            });
          } finally {
            try {
              if (rawDb) enableSyncTriggers(rawDb);
            } catch (e) {
              console.warn(
                "[TTAuthProvider] Failed to re-enable sync triggers after anonymous local profile insert:",
                e
              );
            }
          }
          // e2e/tests/anonymous-003-account-conversion.spec.ts depends on this log
          console.log(
            "✅ Created local user_profile for anonymous user:",
            anonymousUserId
          );
        }
      } catch (localError) {
        log.error(
          "Failed to create local user_profile for anonymous user:",
          localError
        );
        throw localError;
      }

      if (!isCurrent()) return;
      setCatalogSyncPending(true);

      // Offline-first: local SQLite is immediately usable
      setUserIdInt(anonymousUserId);

      // An injected local identity has no authenticated session for sync.
      if (testLifetime) {
        setInitialSyncComplete(true);
        return;
      }
      const isSyncDisabled = import.meta.env.VITE_DISABLE_SYNC === "true";
      if (isSyncDisabled) {
        log.warn("⚠️ Sync disabled via VITE_DISABLE_SYNC environment variable");
        setInitialSyncComplete(true);
      } else {
        await startSyncWorkerForUser(db, anonymousUserId, true);
      }
    } catch (error) {
      if (isTransientDbInitError(error)) {
        log.warn("Anonymous local DB init transient failure:", error);
      } else {
        log.error("Failed to initialize anonymous local database:", error);
      }
    } finally {
      if (isCurrent()) isInitializing = false;
    }
  }

  async function initializeLocalDatabase(user: User) {
    const isCurrent = captureLifetime(user.id);
    if (!isCurrent() || isE2eDbClearInProgress()) return;

    const userId = user.id;
    const currentUserId = userIdInt();
    if (isInitializing) return;
    if (localDb() && currentUserId && currentUserId === userId) return;

    isInitializing = true;
    try {
      markSyncBaselineEvent("local-db:init:start", { userId });
      log.info("Initializing local database for user", userId);

      setInitialSyncComplete(false);
      setUserIdInt(null);

      const db = await initializeSqliteDbWithRetry(
        userId,
        "authenticated",
        isCurrent
      );
      if (!db || !isCurrent()) return;
      markSyncBaselineEvent("local-db:init:ready", { userId });
      await captureSyncBaselineSnapshot("after-local-db-init", db, userId);
      if (!isCurrent()) return;

      const userProfileAnchor = await ensureLocalUserProfileAnchor(db, user);
      if (!isCurrent()) return;
      setUserIdInt(userProfileAnchor.id);
      if (!userProfileAnchor.created) {
        setInitialSyncComplete(true);
      }
      markSyncBaselineEvent("local-db:user-profile-ready", {
        userId,
        internalId: userProfileAnchor.id,
        created: userProfileAnchor.created,
      });

      await clearOldOutboxItems(db);
      if (!isCurrent()) return;
      markSyncBaselineEvent("local-db:old-outbox-cleared", { userId });

      setLocalDb(db);
      markSyncBaselineEvent("local-db:signal-set", { userId });

      ensureSyncRuntimeConfigured();
      if (autoPersistCleanup) {
        autoPersistCleanup();
        autoPersistCleanup = null;
      }
      autoPersistCleanup = setupAutoPersist();

      const isSyncDisabled = import.meta.env.VITE_DISABLE_SYNC === "true";
      if (isSyncDisabled) {
        log.warn("⚠️ Sync disabled via VITE_DISABLE_SYNC environment variable");
        setInitialSyncComplete(true);
        markSyncBaselineEvent("sync:disabled", { userId });
      } else {
        await startSyncWorkerForUser(db, userId, false);
        log.info("Sync worker started for authenticated user");
      }
    } catch (error) {
      if (isTransientDbInitError(error)) {
        log.warn("DB init transient failure:", error);
      } else {
        log.error("Failed to initialize local database:", error);
      }
      markSyncBaselineEvent("local-db:init:error", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (isCurrent()) isInitializing = false;
      markSyncBaselineEvent("local-db:init:finally", { userId });
    }
  }

  function cleanupOnSignOut(): Promise<void> {
    if (signOutCleanup) return signOutCleanup;
    needsSignOutCleanup = true;
    setUpgradeBlocked(null);
    catalogSelectionReconciledKey = null;
    reconcileRunCount = 0;

    const drained = drainSync();
    autoPersistCleanup?.();
    autoPersistCleanup = null;
    // Stop exposing this database while shutdown drains its outstanding work.
    setLocalDb(null);
    setUserIdInt(null);
    setInitialSyncComplete(false);

    signOutCleanup = (async () => {
      // A timer stop alone cannot protect SQLite: a request may already be
      // applying remote rows or persisting. Do not close if draining fails.
      await drained;
      await closeSqliteDb();
      needsSignOutCleanup = false;
    })().finally(() => {
      signOutCleanup = null;
    });
    return signOutCleanup;
  }

  // ---------------------------------------------------------------------------
  // React to auth state changes via rhizome's reactive user signal.
  // This replaces the TT-owned supabase.auth.onAuthStateChange listener.
  // ---------------------------------------------------------------------------
  createEffect(
    on(rhizome.user, async (currentUser, prevUser) => {
      // User signed in (null → User)
      if (currentUser && !prevUser) {
        if (needsSignOutCleanup) {
          const isCurrent = captureLifetime(currentUser.id);
          try {
            await cleanupOnSignOut();
          } catch (error) {
            console.error(
              "[TTAuthProvider] Previous database shutdown failed:",
              error
            );
            return;
          }
          if (!isCurrent()) return;
        }
        const pendingInjection = injectedTestInitialization;
        if (pendingInjection) {
          invalidateSync();
          const isCurrent = captureLifetime(currentUser.id);
          // The runtime shares its pending initialization across users. Let it
          // settle before asking it to persist/close and switch databases.
          await pendingInjection.catch(() => {
            // A failed test initialization must not prevent real sign-in.
          });
          if (!isCurrent()) return;
        }
        markSyncBaselineEvent("auth:user-signed-in", {
          userId: currentUser.id,
          anonymous: isUserAnonymous(currentUser),
        });
        const isAnon = isUserAnonymous(currentUser);
        if (isAnon) {
          void initializeAnonymousDatabase(currentUser.id);
        } else {
          void initializeLocalDatabase(currentUser);
        }
      }
      // User signed out (User → null)
      else if (!currentUser && prevUser) {
        markSyncBaselineEvent("auth:user-signed-out", {
          previousUserId: prevUser.id,
        });
        // For anonymous users: the signOut path preserves their session in localStorage;
        // only clean up in-process state (DB close, sync stop).
        try {
          await cleanupOnSignOut();
        } catch (error) {
          console.error("[TTAuthProvider] Database shutdown failed:", error);
        }
      }
    })
  );

  createEffect(() => {
    localDb();
    rhizome.user();
    rhizome.session();
    void runOfflineMediaMaintenance();
  });

  onMount(() => {
    const handleOnline = () => {
      void runOfflineMediaMaintenance();
    };

    if (globalThis.window === undefined) {
      return;
    }

    globalThis.addEventListener("online", handleOnline);
    onCleanup(() => {
      globalThis.removeEventListener("online", handleOnline);
    });
  });

  // ---------------------------------------------------------------------------
  // Auth method wrappers - adapt rhizome's throw-on-error to TT's {error} return
  // ---------------------------------------------------------------------------

  const signIn = async (email: string, password: string) => {
    markSyncBaselineEvent("auth:password-sign-in:start", {
      emailDomain: email.includes("@") ? email.split("@").at(-1) : null,
    });
    const result = await supabase.auth.signInWithPassword({ email, password });
    markSyncBaselineEvent("auth:password-sign-in:done", {
      success: !result.error,
      error: result.error?.message ?? null,
    });
    return { error: result.error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${globalThis.location.origin}/auth/callback`,
      },
    });

    // needsEmailConfirmation: signup succeeded but no session → confirmation required
    return { error, needsEmailConfirmation: !error && !data.session };
  };

  const signInWithOAuth = async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${globalThis.location.origin}/auth/callback` },
    });
    return { error };
  };

  /**
   * Sign in anonymously.
   * If injectedUserId is provided (E2E tests only), bypass Supabase auth and
   * initialize the local DB directly for that user.
   * Otherwise, the session-restoration flow lives in overrideSignInAnonymously
   * (passed to RhizomeAuthProvider) so rhizome's LoginPage can use it.
   */
  const signInAnonymously = async (injectedUserId?: string) => {
    if (injectedUserId) {
      const currentUser = rhizome.user();
      if (currentUser?.id === injectedUserId) {
        await initializeAnonymousDatabase(injectedUserId);
        return { error: null };
      }
      if (currentUser) {
        return {
          error: new Error(
            "Local test injection cannot replace an authenticated user"
          ),
        };
      }
      const version = lifecycleVersion;
      const ownsTestLifetime = () =>
        !disposed && version === lifecycleVersion && rhizome.user() === null;
      const pending =
        injectedTestInitialization ??
        initializeAnonymousDatabase(injectedUserId, ownsTestLifetime);
      injectedTestInitialization = pending;
      try {
        await pending;
      } finally {
        if (injectedTestInitialization === pending)
          injectedTestInitialization = null;
      }
      return { error: null };
    }
    // Session restoration + new anon sign-in is handled via overrideSignInAnonymously
    // which is wired into RhizomeAuthProvider below. Calling rhizome's signInAnonymously
    // proxies through that override.
    try {
      await rhizome.signInAnonymously();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const convertAnonymousToRegistered = async (
    email: string,
    password: string,
    name: string
  ) => {
    const anonymousUserId = rhizome.user()?.id;

    try {
      const { data: updateData, error: updateError } =
        await supabase.auth.updateUser({ email, password, data: { name } });

      if (updateError) return { error: updateError };

      // e2e/tests/anonymous-003-account-conversion.spec.ts depends on this log
      console.log("✅ Email/password linked to anonymous account");
      console.log("👤 User ID preserved:", updateData.user?.id);

      try {
        const db = localDb();
        if (db && anonymousUserId) {
          const { userProfile } = await import("@/lib/db/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(userProfile)
            .set({
              email,
              name,
              lastModifiedAt: new Date().toISOString(),
              syncVersion: 2,
            })
            .where(eq(userProfile.id, anonymousUserId));
        }
      } catch (profileError) {
        log.warn(
          "Error updating local user_profile during conversion:",
          profileError
        );
      }

      localStorage.removeItem(LEGACY_ANONYMOUS_USER_KEY);
      localStorage.removeItem(LEGACY_ANONYMOUS_USER_ID_KEY);

      const db = localDb();
      const currentUser = rhizome.user();
      if (db && currentUser && !stopSyncWorker) {
        await startSyncWorkerForUser(db, currentUser.id, false);
      }

      return { error: null };
    } catch (error) {
      console.error("❌ Conversion failed:", error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    catalogSelectionReconciledKey = null;
    reconcileRunCount = 0;

    const isAnon = rhizome.isAnonymous();

    if (isAnon) {
      // For anonymous users: preserve Supabase session so they can restore it later
      const currentSession = rhizome.session();
      if (currentSession?.refresh_token) {
        localStorage.setItem(
          ANONYMOUS_SESSION_KEY,
          JSON.stringify({
            refresh_token: currentSession.refresh_token,
            user_id: currentSession.user?.id,
          })
        );
      }
    }

    // Drain while credentials are still valid. Revocation during an upload
    // could otherwise turn an ordinary sign-out into a failed sync.
    let cleanupError: unknown;
    let cleanupFailed = false;
    try {
      await cleanupOnSignOut();
    } catch (error) {
      cleanupError = error;
      cleanupFailed = true;
    }

    localStorage.removeItem(LEGACY_ANONYMOUS_USER_KEY);
    localStorage.removeItem(LEGACY_ANONYMOUS_USER_ID_KEY);

    try {
      if (isAnon) {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      } else {
        await rhizome.signOut();
      }
    } catch (error) {
      // Rhizome retains the user when revocation fails. Restore its database
      // only after successful cleanup; never replace an undrained connection.
      const remainingUser = rhizome.user();
      if (!needsSignOutCleanup && remainingUser) {
        if (isUserAnonymous(remainingUser)) {
          await initializeAnonymousDatabase(remainingUser.id);
        } else {
          await initializeLocalDatabase(remainingUser);
        }
      }
      throw error;
    }
    if (cleanupFailed) throw cleanupError;

    setLocalDb(null);
    setUserIdInt(null);
    setInitialSyncComplete(false);
  };

  // ---------------------------------------------------------------------------
  // Sync helpers
  // ---------------------------------------------------------------------------
  const waitForSyncIdle = async (timeoutMs = 15_000) => {
    const startedAt = Date.now();
    while (syncServiceInstance?.syncing) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("Timed out waiting for in-progress sync to finish");
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  const waitForSyncService = async (timeoutMs = 15_000) => {
    const startedAt = Date.now();
    while (!syncServiceInstance) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("Timed out waiting for sync service initialization");
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  const forceSyncDown = async (
    opts?: { full?: boolean },
    isCurrent: () => boolean = () => true
  ) => {
    if (!isCurrent()) return;
    const service = syncServiceInstance;
    if (!service) {
      console.warn("⚠️ [ForceSyncDown] Sync service not available");
      return;
    }
    try {
      let result: Awaited<ReturnType<SyncService["syncDown"]>>;
      try {
        result = await (opts?.full
          ? service.forceFullSyncDown()
          : service.syncDown());
      } catch (error) {
        if (
          error instanceof SyncInProgressError ||
          (error instanceof Error && error.name === "SyncInProgressError")
        ) {
          await waitForSyncIdle();
          if (!isCurrent() || syncServiceInstance !== service) return;
          result = await (opts?.full
            ? service.forceFullSyncDown()
            : service.syncDown());
        } else {
          throw error;
        }
      }
      if (!isCurrent() || syncServiceInstance !== service) return;
      if (!result.success) {
        throw new Error(result.errors.join("; ") || "Sync download failed");
      }
      setRemoteSyncDownCompletionVersion((prev) => prev + 1);
      const ts = service.getLastSyncDownTimestamp();
      if (ts) setLastSyncTimestamp(ts);
      const mode = service.getLastSyncMode();
      if (mode) setLastSyncMode(mode);
    } catch (error) {
      console.error("❌ [ForceSyncDown] Sync down failed:", error);
      throw error;
    }
  };

  const forceSyncUp = async (
    opts?: { allowDeletes?: boolean },
    isCurrent: () => boolean = () => true
  ) => {
    if (!isCurrent()) return;
    // Device-only actions still save locally; never ask the pull-only service
    // to upload or manufacture a successful sync completion for that no-op.
    if (isUserAnonymous(rhizome.user())) return;
    const service = syncServiceInstance;
    if (!service) {
      console.warn("⚠️ [ForceSyncUp] Sync service not available");
      return;
    }
    try {
      let result: Awaited<ReturnType<SyncService["syncUp"]>>;
      try {
        result = await service.syncUp(opts);
      } catch (error) {
        if (
          error instanceof SyncInProgressError ||
          (error instanceof Error && error.name === "SyncInProgressError")
        ) {
          await waitForSyncIdle();
          if (!isCurrent() || syncServiceInstance !== service) return;
          result = await service.syncUp(opts);
        } else {
          throw error;
        }
      }
      if (!isCurrent() || syncServiceInstance !== service) return;
      if (!result.success) {
        throw new Error(result.errors.join("; ") || "Sync upload failed");
      }
      setRemoteSyncDownCompletionVersion((prev) => prev + 1);
    } catch (error) {
      console.error("❌ [ForceSyncUp] Sync up failed:", error);
      throw error;
    }
  };

  const forceCleanLocalReset = async () => {
    const currentUser = rhizome.user();
    if (!currentUser) {
      throw new Error("Cannot reset local database without an active session");
    }

    try {
      catalogSelectionReconciledKey = null;
      reconcileRunCount = 0;

      // Invalidate completion ownership before asynchronous teardown starts.
      const drained = drainSync();
      const ownsReset = captureLifetime(currentUser.id);
      await drained;

      if (!ownsReset()) {
        throw new Error(
          "Local reset did not run because the active session changed"
        );
      }
      if (autoPersistCleanup) {
        autoPersistCleanup();
        autoPersistCleanup = null;
      }

      setLocalDb(null);
      setUserIdInt(null);
      setInitialSyncComplete(false);
      setLastSyncTimestamp(null);
      setLastSyncMode(null);
      setLastSyncSuccess(null);
      setLastSyncErrorCount(0);
      setLastSyncErrorSummary(null);

      await clearSqliteDb();
      if (!ownsReset()) return;

      if (isUserAnonymous(currentUser)) {
        await initializeAnonymousDatabase(currentUser.id);
      } else {
        await initializeLocalDatabase(currentUser);
      }

      if (navigator.onLine && syncServiceInstance) {
        await forceSyncDown({ full: true });
      }
    } catch (error) {
      console.error("❌ [ForceCleanLocalReset] Local reset failed:", error);
      throw error;
    }
  };

  const syncPracticeScope = async () => {
    if (!syncServiceInstance) return;
    if (!navigator.onLine) return;
    try {
      const tables = [
        "repertoire_tune",
        "practice_record",
        "daily_practice_queue",
        "table_transient_data",
      ] as const;
      await (syncServiceInstance as any).syncDownTables(tables);
      const ts = syncServiceInstance.getLastSyncDownTimestamp();
      if (ts) setLastSyncTimestamp(ts);
      const mode = syncServiceInstance.getLastSyncMode();
      if (mode) setLastSyncMode(mode);
      setRemoteSyncDownCompletionVersion((prev) => prev + 1);
    } catch (e) {
      console.error("❌ [syncPracticeScope] Scoped practice sync failed", e);
    }
  };

  // ---------------------------------------------------------------------------
  // View signal helpers
  // ---------------------------------------------------------------------------
  const triggerAllViewSignals = () => {
    incrementPracticeListStagedChanged();
    incrementRepertoireListChanged();
    incrementCatalogListChanged();
  };

  const incrementRemoteSyncDownCompletion = () => {
    setRemoteSyncDownCompletionVersion((prev) => prev + 1);
  };

  const incrementPracticeListStagedChanged = () => {
    setPracticeListStagedChanged((prev) => prev + 1);
  };

  const incrementCatalogListChanged = () => {
    setCatalogListChanged((prev) => prev + 1);
  };

  const incrementRepertoireListChanged = () => {
    setRepertoireListChanged((prev) => prev + 1);
  };

  // ---------------------------------------------------------------------------
  // Assemble TT auth state
  // ---------------------------------------------------------------------------
  const authState: AuthState = {
    // Forwarded from rhizome (reactive signals)
    user: rhizome.user,
    session: rhizome.session,
    loading: rhizome.loading,
    isAnonymous: rhizome.isAnonymous,
    // TT-specific signals
    userIdInt,
    localDb,
    remoteSyncDownCompletionVersion,
    initialSyncComplete,
    catalogSyncPending,
    lastSyncTimestamp,
    lastSyncMode,
    practiceListStagedChanged,
    catalogListChanged,
    repertoireListChanged,
    // Methods
    incrementRemoteSyncDownCompletion,
    incrementPracticeListStagedChanged,
    incrementCatalogListChanged,
    incrementRepertoireListChanged,
    suppressNextViewRefresh,
    signIn,
    signUp,
    signInWithOAuth,
    signInAnonymously,
    convertAnonymousToRegistered,
    signOut,
    forceSyncDown,
    forceSyncUp,
    forceCleanLocalReset,
    triggerCatalogSync: async () => {
      if (catalogSyncPending()) {
        console.log(
          "[TTAuthProvider] Triggering catalog sync after genre selection"
        );
        setCatalogSyncPending(false);
        setAnonymousCatalogSyncRequested(true);
        try {
          await forceSyncDown({ full: true });
        } catch (error) {
          setCatalogSyncPending(true);
          throw error;
        } finally {
          setAnonymousCatalogSyncRequested(false);
        }
      }
    },
    syncPracticeScope,
  };

  // TEST HOOKS: Expose manual sync controls for Playwright
  if (globalThis.window !== undefined) {
    installAuthTestHooks(globalThis.window, {
      forceSyncUpForTest: async () => {
        await waitForSyncService();
        await forceSyncUp({ allowDeletes: true });
      },
      forceSyncDownForTest: async () => {
        await waitForSyncService();
        await forceSyncDown({ full: true });
      },
      forceCleanLocalResetForTest: forceCleanLocalReset,
      diagLog,
    });
  }

  return (
    <TTAuthContext.Provider value={authState}>
      <div
        data-auth-initialized={!rhizome.loading()}
        data-sync-version={remoteSyncDownCompletionVersion()}
        data-sync-result-version={syncResultVersion()}
        data-sync-success={
          lastSyncSuccess() === null ? "" : String(lastSyncSuccess())
        }
        data-sync-error-count={String(lastSyncErrorCount())}
        data-sync-error-summary={lastSyncErrorSummary() ?? ""}
        data-initial-sync-complete={String(initialSyncComplete())}
        style={{ display: "contents" }}
      >
        <Show when={upgradeBlocked()} fallback={props.children}>
          {(reason) => <DatabaseUpgradeBlocked reason={reason()} />}
        </Show>
      </div>
    </TTAuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// TTAuthProvider - public entry point
//
// Renders rhizome's AuthProvider (owns Supabase auth lifecycle) wrapping TTInner
// (owns TT-specific state and DB/sync lifecycle).
// ---------------------------------------------------------------------------

/**
 * Implementation of the anonymous sign-in flow that:
 * 1. Checks localStorage for a previously saved anonymous session
 * 2. Restores it via refresh_token if available
 * 3. Falls back to creating a new anonymous user via Supabase
 *
 * This is passed as `overrideSignInAnonymously` to RhizomeAuthProvider so that
 * rhizome's LoginPage calls this path instead of the default signInAnonymously.
 */
async function ttAnonymousSignIn(): Promise<void> {
  const savedSession = localStorage.getItem(ANONYMOUS_SESSION_KEY);
  if (savedSession) {
    try {
      const parsed = parseSavedAnonymousSession(savedSession);
      if (parsed?.refreshToken) {
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession({
            refresh_token: parsed.refreshToken,
          });
        if (!refreshError && refreshData.session) {
          localStorage.removeItem(ANONYMOUS_SESSION_KEY);
          // onAuthStateChange will fire SIGNED_IN → rhizome updates user signal
          // → TTInner's createEffect fires → initializeAnonymousDatabase runs
          return;
        }
      }
    } catch {
      // Fall through to new anonymous sign-in
    }
  }
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

export const TTAuthProvider: ParentComponent = (props) => {
  return (
    <RhizomeAuthProvider
      supabaseClient={supabase}
      overrideSignInAnonymously={ttAnonymousSignIn}
    >
      <TTInner>{props.children}</TTInner>
    </RhizomeAuthProvider>
  );
};
