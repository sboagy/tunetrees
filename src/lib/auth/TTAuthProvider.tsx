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
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  type ParentComponent,
} from "solid-js";
import { toast } from "solid-sonner";
import {
  clearDb as clearSqliteDb,
  closeDb as closeSqliteDb,
  getSqliteInstance,
  initializeDb as initializeSqliteDb,
  type SqliteDatabase,
  setupAutoPersist,
} from "../db/client-sqlite";
import {
  enableSyncTriggers,
  suppressSyncTriggers,
} from "../db/install-triggers";
import { log } from "../logger";
import { supabase } from "../supabase/client";
import {
  clearOldOutboxItems,
  ensureSyncRuntimeConfigured,
  SyncInProgressError,
  type SyncService,
  startSyncWorker,
} from "../sync";

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
    category: "repertoire" | "practice" | "catalog",
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
  ) => Promise<{ error: AuthError | null }>;
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
  lastSyncMode: Accessor<"full" | "incremental" | null>;
  /** Scoped practice sync (repertoire_tune, practice_record, daily_practice_queue, table_transient_data) */
  syncPracticeScope: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context - used by useAuth() in AuthContext.tsx
// ---------------------------------------------------------------------------
export const TTAuthContext = createContext<AuthState>();

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
  const attemptMatch = message.match(/Sync upload failed \(attempt (\d+)\)/i);
  const title = attemptMatch?.[1]
    ? `Sync upload failed (attempt ${attemptMatch[1]})`
    : /Background sync error/i.test(message)
      ? "Background sync error"
      : "Sync error";

  if (
    /constraint=tune_set_kind_check/i.test(message) ||
    /CHECK constraint failed: set_kind/i.test(message)
  ) {
    return {
      title,
      description:
        "Your program is saved locally, but the sync server still has the older tune_set kind constraint. Apply the latest Supabase migration or reset the local Supabase DB, then retry sync.",
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

// ---------------------------------------------------------------------------
const TTInner: ParentComponent = (props) => {
  // Read user/session/loading/isAnonymous reactively from rhizome's AuthProvider.
  // TTAuthContext forwards these plus TT-specific state to consumers.
  const rhizome = useRhizomeAuth();

  // TT-specific signals
  const [userIdInt, setUserIdInt] = createSignal<string | null>(null);
  const [localDb, setLocalDb] = createSignal<SqliteDatabase | null>(null);
  const [remoteSyncDownCompletionVersion, setRemoteSyncDownCompletionVersion] =
    createSignal(0);
  const [initialSyncComplete, setInitialSyncComplete] = createSignal(false);
  const [catalogSyncPending, setCatalogSyncPending] = createSignal(false);
  const [anonymousCatalogSyncRequested, setAnonymousCatalogSyncRequested] =
    createSignal(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = createSignal<string | null>(
    null
  );
  const [lastSyncMode, setLastSyncMode] = createSignal<
    "full" | "incremental" | null
  >(null);
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
    Record<"repertoire" | "practice" | "catalog", number>
  > = {};

  // Sync worker cleanup and service instance
  let stopSyncWorker: (() => void) | null = null;
  let syncServiceInstance: SyncService | null = null;
  let autoPersistCleanup: (() => void) | null = null;

  // Catalog reconciliation tracking
  let catalogSelectionReconciledKey: string | null = null;
  let reconcileRunCount = 0;
  const RECONCILE_CHECK_INTERVAL = 10;

  let isInitializing = false;
  let offlineMediaMaintenancePromise: Promise<void> | null = null;

  const SYNC_DIAGNOSTICS = import.meta.env.VITE_SYNC_DIAGNOSTICS === "true";
  let syncDiagnosticsRan = false;

  const diagLog = (...args: unknown[]): void => {
    if (SYNC_DIAGNOSTICS) console.log(...args);
  };

  const runOfflineMediaMaintenance = async () => {
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
      return await offlineMediaMaintenancePromise;
    }

    offlineMediaMaintenancePromise = (async () => {
      try {
        const [{ processPendingNoteMediaDrafts }, { syncPinnedAudioVault }] =
          await Promise.all([
            import("@/lib/media/offline-note-media"),
            import("@/lib/media/audio-lookahead"),
          ]);

        await processPendingNoteMediaDrafts({
          db,
          userId: currentUser.id,
          accessToken,
        });
        await syncPinnedAudioVault({
          db,
          userId: currentUser.id,
          accessToken,
        });
      } catch (error) {
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
    category: "repertoire" | "practice" | "catalog"
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
      const totals = await db.all<{ table: string; count: number }>(sql`
        SELECT 'user_profile' AS table, COUNT(*) AS count FROM user_profile
        UNION ALL SELECT 'repertoire', COUNT(*) FROM repertoire
        UNION ALL SELECT 'repertoire_tune', COUNT(*) FROM repertoire_tune
        UNION ALL SELECT 'tune', COUNT(*) FROM tune
        UNION ALL SELECT 'practice_record', COUNT(*) FROM practice_record
        UNION ALL SELECT 'daily_practice_queue', COUNT(*) FROM daily_practice_queue
      `);
      const repertoireSummary = await db.all<{
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
      console.warn("🔎 [SYNC_DIAG] Snapshot", {
        at: now,
        totals,
        topRepertoires: repertoireSummary,
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

  // ---------------------------------------------------------------------------
  // Catalog genre reconciliation
  // ---------------------------------------------------------------------------
  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const aSorted = [...a].sort();
    const bSorted = [...b].sort();
    return aSorted.every((id, index) => id === bSorted[index]);
  };

  const reconcileCatalogSelection = async (params: {
    db: SqliteDatabase;
    userId: string;
    isAnonymousUser: boolean;
    skipSync?: boolean;
  }) => {
    try {
      const [genreSelection, genreQueries] = await Promise.all([
        import("@/lib/db/queries/user-genre-selection"),
        import("@/lib/db/queries/genres"),
      ]);

      const selected = await genreSelection.getUserGenreSelection(
        params.db,
        params.userId
      );
      const required = await genreSelection.getRequiredGenreIdsForUser(
        params.db,
        params.userId
      );
      const { repertoireCount, repertoireTuneCount } =
        await genreSelection.getUserRepertoireStats(params.db, params.userId);
      const repertoireDefaults =
        await genreSelection.getRepertoireGenreDefaultsForUser(
          params.db,
          params.userId
        );
      const tuneGenres = await genreSelection.getRepertoireTuneGenreIdsForUser(
        params.db,
        params.userId
      );

      const selectedKey = [...selected].sort().join(",");
      const requiredKey = [...required].sort().join(",");
      const repertoireDefaultsKey = [...repertoireDefaults].sort().join(",");
      const tuneGenresKey = [...tuneGenres].sort().join(",");
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
        catalogSelectionReconciledKey !== reconcileKey ||
        reconcileRunCount % RECONCILE_CHECK_INTERVAL === 0;

      reconcileRunCount++;

      if (!shouldReconcile) return;

      catalogSelectionReconciledKey = reconcileKey;

      let effectiveSelected: string[] = [];
      if (selected.length > 0) {
        effectiveSelected = Array.from(new Set([...selected, ...required]));
      } else if (repertoireCount > 0) {
        if (repertoireTuneCount > 0) {
          effectiveSelected = Array.from(
            new Set([...tuneGenres, ...repertoireDefaults])
          );
        } else {
          effectiveSelected = Array.from(new Set([...repertoireDefaults]));
        }
      } else {
        effectiveSelected = [];
      }

      if (effectiveSelected.length === 0) return;

      const selectionChanged = !arraysEqual(selected, effectiveSelected);
      if (selectionChanged) {
        await genreSelection.upsertUserGenreSelection(
          params.db,
          params.userId,
          effectiveSelected
        );
      }

      if (effectiveSelected.length > 0) {
        const allGenres = await genreQueries.getAllGenres(params.db);
        const unselected = allGenres
          .map((g) => g.id)
          .filter((id) => !effectiveSelected.includes(id));

        const purgeResult = await genreSelection.purgeLocalCatalogForGenres(
          params.db,
          params.userId,
          unselected
        );

        if (!params.skipSync) {
          if (selectionChanged && !params.isAnonymousUser) {
            await forceSyncUp({ allowDeletes: true });
          }
          if (selectionChanged || purgeResult.tuneIds.length > 0) {
            await forceSyncDown({ full: true });
          }
        }

        incrementCatalogListChanged();
      }
    } catch (error) {
      console.warn(
        "[TTAuthProvider] Failed to reconcile catalog genre selection:",
        error
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Start sync worker
  // ---------------------------------------------------------------------------
  async function startSyncWorkerForUser(
    db: SqliteDatabase,
    authUserId: string,
    isAnonymousUser: boolean
  ): Promise<{ stop: () => void; service: SyncService }> {
    let firstSyncCompletionHandled = false;
    let metadataPrefetchPromise: Promise<void> | null = null;
    let metadataPrefetchCompleted = false;

    const requestOverridesProvider = async () => {
      try {
        const { buildGenreFilterOverrides, preSyncMetadataViaWorker } =
          await import("@/lib/sync/genre-filter");

        if (!isAnonymousUser) {
          const lastSyncAt =
            syncServiceInstance?.getLastSyncDownTimestamp?.() ?? null;
          const debugUserId = await getUserInternalIdFromLocalDb(
            db,
            authUserId
          ).catch(() => null);
          const shouldRunMetadataPrefetch =
            !metadataPrefetchCompleted && !lastSyncAt;
          if (shouldRunMetadataPrefetch) {
            if (!metadataPrefetchPromise) {
              metadataPrefetchPromise = preSyncMetadataViaWorker({
                db,
                supabase,
                lastSyncAt,
                userId: debugUserId ?? undefined,
              })
                .then(() => {
                  metadataPrefetchCompleted = true;
                })
                .finally(() => {
                  metadataPrefetchPromise = null;
                });
            }
            await metadataPrefetchPromise;
          }
        }

        const internalId = await getUserInternalIdFromLocalDb(db, authUserId);
        if (!internalId) {
          console.warn(
            "[TTAuthProvider] Failed to resolve internal user id for genre filtering"
          );
          return null;
        }

        const isInitialSync =
          !syncServiceInstance?.getLastSyncDownTimestamp?.();

        if (isAnonymousUser && isInitialSync && catalogSyncPending()) {
          const pullTablesOverride = {
            pullTables: [
              "genre",
              "genre_tune_type",
              "tune_type",
              "instrument",
              "user_profile",
              "user_genre_selection",
              "repertoire",
            ],
          };
          return pullTablesOverride;
        }

        if (isAnonymousUser && anonymousCatalogSyncRequested()) {
          const catalogTablesOverride = {
            pullTables: [
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
            isInitialSync,
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
        return null;
      }
    };

    try {
      const {
        repairPendingMediaAssetSyncState,
        repairPendingProgramSyncState,
      } = await import("@/lib/sync/genre-filter");
      const repairResult = await repairPendingMediaAssetSyncState();
      const programRepairResult = await repairPendingProgramSyncState();
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
        programRepairResult.requeuedProgramCount > 0 ||
        programRepairResult.requeuedTuneSetCount > 0 ||
        programRepairResult.requeuedGroupCount > 0
      ) {
        console.warn(
          "[TTAuthProvider] Repaired pending program sync state before startup sync",
          programRepairResult
        );
      }
    } catch (error) {
      console.warn(
        "[TTAuthProvider] Failed to repair pending sync state before startup sync",
        error
      );
    }

    const syncWorker = startSyncWorker(db, {
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
        const isFirstSyncCompletion = !firstSyncCompletionHandled;
        if (isFirstSyncCompletion) firstSyncCompletionHandled = true;

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

        setRemoteSyncDownCompletionVersion((prev) => prev + 1);

        if (syncServiceInstance) {
          const ts = syncServiceInstance.getLastSyncDownTimestamp();
          if (ts) setLastSyncTimestamp(ts);
          const mode = syncServiceInstance.getLastSyncMode();
          if (mode) setLastSyncMode(mode);
        } else if (result?.timestamp) {
          setLastSyncTimestamp(result.timestamp);
        }

        if (!initialSyncComplete()) {
          const internalId = await getUserInternalIdFromLocalDb(db, authUserId);
          if (internalId) {
            setUserIdInt(internalId);
          } else if (isAnonymousUser) {
            setUserIdInt(authUserId);
            // e2e/tests/anonymous-003-account-conversion.spec.ts depends on this log
            console.log(
              `✅ [TTAuthProvider] Anonymous user - using auth ID as internal ID`
            );
          } else {
            log.warn(
              "User profile not found in local DB after initial sync - this may cause issues"
            );
          }

          await reconcileCatalogSelection({
            db,
            userId: authUserId,
            isAnonymousUser,
            skipSync: true,
          });

          setInitialSyncComplete(true);

          import("@/lib/db/client-sqlite").then(({ persistDb }) => {
            persistDb().catch((e) => {
              console.warn(
                "⚠️ [TTAuthProvider] Failed to persist after sync:",
                e
              );
            });
          });
        }

        if (!isFirstSyncCompletion) {
          setTimeout(() => {
            void reconcileCatalogSelection({
              db,
              userId: authUserId,
              isAnonymousUser,
            });
          }, 0);
        }

        if (isFirstSyncCompletion) {
          triggerAllViewSignals();
        }

        if (
          SYNC_DIAGNOSTICS &&
          !syncDiagnosticsRan &&
          result?.success === true
        ) {
          syncDiagnosticsRan = true;
          await runSyncDiagnostics(db);
        }

        try {
          if (result.affectedTables && result.affectedTables.length > 0) {
            const categories = new Set<string>();
            for (const table of result.affectedTables) {
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
          }
        } catch (e) {
          log.error("[TTAuthProvider] Error in granular signaling:", e);
        }

        await runOfflineMediaMaintenance();
      },
    });

    // E2E-only: expose sync control surface for Playwright
    if (typeof window !== "undefined" && !!(window as any).__ttTestApi) {
      (window as any).__ttSyncControl = {
        stop: async () => {
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

    return syncWorker;
  }

  // ---------------------------------------------------------------------------
  // DB init helpers
  // ---------------------------------------------------------------------------
  function isE2eDbClearInProgress(): boolean {
    return (
      typeof window !== "undefined" &&
      (window as any).__ttE2eIsClearing === true
    );
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
    context: "anonymous" | "authenticated"
  ): Promise<SqliteDatabase | null> {
    const maxAttempts = 4;
    let attempt = 0;
    const contextLabel =
      context === "anonymous" ? "Anonymous DB init" : "DB init";
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt += 1;
      try {
        return await initializeSqliteDb(userId);
      } catch (error) {
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

  async function initializeAnonymousDatabase(anonymousUserId: string) {
    if (isE2eDbClearInProgress()) return;
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
        "anonymous"
      );
      if (!db) return;

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

        if (!existingLocal || existingLocal.length === 0) {
          const rawDb = await getSqliteInstance();
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

      setCatalogSyncPending(true);

      // Offline-first: local SQLite is immediately usable
      setUserIdInt(anonymousUserId);
      setInitialSyncComplete(true);

      if (import.meta.env.VITE_DISABLE_SYNC !== "true") {
        const syncWorker = await startSyncWorkerForUser(
          db,
          anonymousUserId,
          true
        );
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
      } else {
        log.warn("⚠️ Sync disabled via VITE_DISABLE_SYNC environment variable");
        setUserIdInt(anonymousUserId);
        setInitialSyncComplete(true);
      }
    } catch (error) {
      if (isTransientDbInitError(error)) {
        log.warn("Anonymous local DB init transient failure:", error);
      } else {
        log.error("Failed to initialize anonymous local database:", error);
      }
    } finally {
      isInitializing = false;
    }
  }

  async function initializeLocalDatabase(userId: string) {
    if (isE2eDbClearInProgress()) return;

    const currentUserId = userIdInt();
    if (isInitializing) return;
    if (localDb() && currentUserId && currentUserId === userId) return;

    isInitializing = true;
    try {
      log.info("Initializing local database for user", userId);

      setInitialSyncComplete(false);
      setUserIdInt(null);

      const db = await initializeSqliteDbWithRetry(userId, "authenticated");
      if (!db) return;

      setLocalDb(db);

      const internalId = await getUserInternalIdFromLocalDb(db, userId);
      if (internalId) {
        setUserIdInt(internalId);
        setInitialSyncComplete(true);
      }

      await clearOldOutboxItems(db);

      ensureSyncRuntimeConfigured();
      if (autoPersistCleanup) {
        autoPersistCleanup();
        autoPersistCleanup = null;
      }
      autoPersistCleanup = setupAutoPersist();

      if (import.meta.env.VITE_DISABLE_SYNC !== "true") {
        const syncWorker = await startSyncWorkerForUser(db, userId, false);
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started for authenticated user");
      } else {
        log.warn("⚠️ Sync disabled via VITE_DISABLE_SYNC environment variable");
        setInitialSyncComplete(true);
      }
    } catch (error) {
      if (isTransientDbInitError(error)) {
        log.warn("DB init transient failure:", error);
      } else {
        log.error("Failed to initialize local database:", error);
      }
    } finally {
      isInitializing = false;
    }
  }

  async function cleanupOnSignOut() {
    catalogSelectionReconciledKey = null;
    reconcileRunCount = 0;

    if (stopSyncWorker) {
      stopSyncWorker();
      stopSyncWorker = null;
      syncServiceInstance = null;
    }

    try {
      await closeSqliteDb();
    } catch (closeError) {
      console.warn("⚠️ Failed to close database:", closeError);
    }

    if (autoPersistCleanup) {
      autoPersistCleanup();
      autoPersistCleanup = null;
    }

    setLocalDb(null);
    setUserIdInt(null);
    setInitialSyncComplete(false);
  }

  // ---------------------------------------------------------------------------
  // React to auth state changes via rhizome's reactive user signal.
  // This replaces the TT-owned supabase.auth.onAuthStateChange listener.
  // ---------------------------------------------------------------------------
  createEffect(
    on(rhizome.user, async (currentUser, prevUser) => {
      // User signed in (null → User)
      if (currentUser && !prevUser) {
        const isAnon = isUserAnonymous(currentUser);
        if (isAnon) {
          void initializeAnonymousDatabase(currentUser.id);
        } else {
          void initializeLocalDatabase(currentUser.id);
        }
      }
      // User signed out (User → null)
      else if (!currentUser && prevUser) {
        // For anonymous users: the signOut path preserves their session in localStorage;
        // only clean up in-process state (DB close, sync stop).
        await cleanupOnSignOut();
      }
    })
  );

  createEffect(() => {
    void localDb();
    void rhizome.user();
    void rhizome.session();
    void runOfflineMediaMaintenance();
  });

  onMount(() => {
    const handleOnline = () => {
      void runOfflineMediaMaintenance();
    };

    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("online", handleOnline);
    onCleanup(() => {
      window.removeEventListener("online", handleOnline);
    });
  });

  // ---------------------------------------------------------------------------
  // Auth method wrappers - adapt rhizome's throw-on-error to TT's {error} return
  // ---------------------------------------------------------------------------

  const signIn = async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return { error: result.error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { error };
  };

  const signInWithOAuth = async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
      await initializeAnonymousDatabase(injectedUserId);
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
        const syncWorker = await startSyncWorkerForUser(
          db,
          currentUser.id,
          false
        );
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
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
      // Close DB and clear in-process state (no supabase signOut)
      await cleanupOnSignOut();
      // Manually clear rhizome's in-memory state by calling supabase signOut
      // Note: this will also trigger cleanupOnSignOut via the createEffect, but
      // cleanupOnSignOut is idempotent so double-calling is safe.
    }

    localStorage.removeItem(LEGACY_ANONYMOUS_USER_KEY);
    localStorage.removeItem(LEGACY_ANONYMOUS_USER_ID_KEY);

    if (isAnon) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } else {
      await rhizome.signOut();
    }

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

  const forceSyncDown = async (opts?: { full?: boolean }) => {
    if (!syncServiceInstance) {
      console.warn("⚠️ [ForceSyncDown] Sync service not available");
      return;
    }
    try {
      try {
        await (opts?.full
          ? syncServiceInstance.forceFullSyncDown()
          : syncServiceInstance.syncDown());
      } catch (error) {
        if (
          error instanceof SyncInProgressError ||
          (error instanceof Error && error.name === "SyncInProgressError")
        ) {
          await waitForSyncIdle();
          await (opts?.full
            ? syncServiceInstance.forceFullSyncDown()
            : syncServiceInstance.syncDown());
        } else {
          throw error;
        }
      }
      setRemoteSyncDownCompletionVersion((prev) => prev + 1);
      const ts = syncServiceInstance.getLastSyncDownTimestamp();
      if (ts) setLastSyncTimestamp(ts);
      const mode = syncServiceInstance.getLastSyncMode();
      if (mode) setLastSyncMode(mode);
    } catch (error) {
      console.error("❌ [ForceSyncDown] Sync down failed:", error);
      throw error;
    }
  };

  const forceSyncUp = async (opts?: { allowDeletes?: boolean }) => {
    if (!syncServiceInstance) {
      console.warn("⚠️ [ForceSyncUp] Sync service not available");
      return;
    }
    try {
      try {
        await syncServiceInstance.syncUp(opts);
      } catch (error) {
        if (
          error instanceof SyncInProgressError ||
          (error instanceof Error && error.name === "SyncInProgressError")
        ) {
          await waitForSyncIdle();
          await syncServiceInstance.syncUp(opts);
        } else {
          throw error;
        }
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

      const serviceWithDestroy = syncServiceInstance as
        | (SyncService & {
            destroy?: () => Promise<void>;
          })
        | null;
      if (serviceWithDestroy?.destroy) {
        try {
          await serviceWithDestroy.destroy();
        } catch (error) {
          console.warn(
            "[ForceCleanLocalReset] Failed to destroy sync service cleanly:",
            error
          );
        }
      }

      if (stopSyncWorker) {
        stopSyncWorker();
        stopSyncWorker = null;
      }
      syncServiceInstance = null;

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

      if (isUserAnonymous(currentUser)) {
        await initializeAnonymousDatabase(currentUser.id);
      } else {
        await initializeLocalDatabase(currentUser.id);
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
  if (typeof window !== "undefined") {
    const w = window as any;
    if (!w.__forceSyncUpForTest) {
      w.__forceSyncUpForTest = async () => {
        try {
          await waitForSyncService();
          await forceSyncUp();
        } catch (e) {
          console.warn("__forceSyncUpForTest failed", e);
        }
      };
    }
    if (!w.__forceSyncDownForTest) {
      w.__forceSyncDownForTest = async () => {
        try {
          await waitForSyncService();
          await forceSyncDown({ full: true });
        } catch (e) {
          console.warn("__forceSyncDownForTest failed", e);
        }
      };
    }
    if (!w.__forceCleanLocalResetForTest) {
      w.__forceCleanLocalResetForTest = async () => {
        try {
          await forceCleanLocalReset();
        } catch (e) {
          console.warn("__forceCleanLocalResetForTest failed", e);
        }
      };
    }
    if (!w.__authSessionDiagForTest) {
      w.__authSessionDiagForTest = async (label?: string) => {
        try {
          const { data, error } = await supabase.auth.getSession();
          const sess = data?.session || null;
          const expEpoch = sess?.expires_at ? sess.expires_at * 1000 : null;
          const nowMs = Date.now();
          const msUntilExpiry = expEpoch !== null ? expEpoch - nowMs : null;
          const diag = {
            label: label || "",
            hasSession: !!sess,
            userId: sess?.user?.id || null,
            error,
            nowIso: new Date(nowMs).toISOString(),
            expiresAtEpochSec: sess?.expires_at ?? null,
            msUntilExpiry,
            accessTokenLength: sess?.access_token?.length ?? 0,
          };
          diagLog("AUTH DIAG", diag);
          w.__lastAuthDiagHasSession = diag.hasSession;
          return diag;
        } catch (e) {
          console.warn("AUTH DIAG ERROR", e);
          return { label, error: String(e) };
        }
      };
    }
  }

  return (
    <TTAuthContext.Provider value={authState}>
      <div
        data-auth-initialized={!rhizome.loading()}
        data-sync-version={remoteSyncDownCompletionVersion()}
        data-sync-success={
          lastSyncSuccess() === null ? "" : String(lastSyncSuccess())
        }
        data-sync-error-count={String(lastSyncErrorCount())}
        data-sync-error-summary={lastSyncErrorSummary() ?? ""}
        style={{ display: "contents" }}
      >
        {props.children}
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
      const parsed = JSON.parse(savedSession) as {
        refresh_token?: string;
        user_id?: string;
      };
      if (parsed.refresh_token) {
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession({
            refresh_token: parsed.refresh_token,
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
