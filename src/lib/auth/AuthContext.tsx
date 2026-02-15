/**
 * Authentication Context for TuneTrees
 *
 * Provides SolidJS reactive auth state and methods using Supabase Auth.
 * Handles user session management and local database initialization.
 *
 * @module auth/AuthContext
 */

import type { AuthError, Session, User } from "@supabase/supabase-js";
import { TABLE_REGISTRY } from "@sync-schema/table-meta";
import { sql } from "drizzle-orm";
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  type ParentComponent,
  useContext,
} from "solid-js";
import {
  clearDb as clearSqliteDb,
  closeDb as closeSqliteDb,
  getClientSqliteDebugState,
  getSqliteInstance,
  getSqlJsDebugInfo,
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
  SyncInProgressError,
  type SyncService,
  startSyncWorker,
} from "../sync";

/**
 * Authentication state interface
 */
interface AuthState {
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

  /** View-specific change signals for optimistic local updates */

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

  /** Sign in anonymously (local-only, no account) */
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

/**
 * Auth context (undefined until provider is mounted)
 */
const AuthContext = createContext<AuthState>();

/**
 * Authentication Provider Component
 *
 * Wraps the app and provides auth state to all child components.
 * Handles:
 * - Session persistence
 * - Auth state changes
 * - Local database initialization on login
 * - Cleanup on logout
 *
 * @example
 * ```tsx
 * import { AuthProvider } from '@/lib/auth/AuthContext';
 *
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <YourApp />
 *     </AuthProvider>
 *   );
 * }
 * ```
 */
// Legacy anonymous user storage keys (for migration from old local-only approach)
// These are kept for backwards compatibility to detect and migrate existing anonymous users
const LEGACY_ANONYMOUS_USER_KEY = "tunetrees:anonymous:user";
const LEGACY_ANONYMOUS_USER_ID_KEY = "tunetrees:anonymous:userId";

// Key to persist anonymous session for "Use on this Device Only" feature
// This allows anonymous users to return to their session after signing out
const ANONYMOUS_SESSION_KEY = "tunetrees:anonymous:session";

/**
 * Check if a Supabase user is anonymous
 * Supabase anonymous users have:
 * - app_metadata.is_anonymous === true (newer versions)
 * - OR: no email AND no identities (fallback for older versions)
 */
function isUserAnonymous(user: User | null): boolean {
  if (!user) return false;

  // Primary check: app_metadata.is_anonymous (set by Supabase Auth in newer versions)
  if (user.app_metadata?.is_anonymous === true) {
    return true;
  }

  // Fallback: Check if user has no email and no linked identities
  // Anonymous users created via signInAnonymously() have:
  // - No email
  // - Empty identities array or identities with provider 'anonymous'
  const hasNoEmail = !user.email;
  const hasNoIdentities = !user.identities || user.identities.length === 0;
  const hasOnlyAnonymousIdentity =
    user.identities?.length === 1 &&
    user.identities[0]?.provider === "anonymous";

  return hasNoEmail && (hasNoIdentities || hasOnlyAnonymousIdentity);
}

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [userIdInt, setUserIdInt] = createSignal<string | null>(null);
  const [session, setSession] = createSignal<Session | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [localDb, setLocalDb] = createSignal<SqliteDatabase | null>(null);
  const [remoteSyncDownCompletionVersion, setRemoteSyncDownCompletionVersion] =
    createSignal(0);
  const [initialSyncComplete, setInitialSyncComplete] = createSignal(false);
  const [catalogSyncPending, setCatalogSyncPending] = createSignal(false);
  const [isAnonymous, setIsAnonymous] = createSignal(false);
  // Track last successful syncDown timestamp (used for displaying sync recency)
  const [lastSyncTimestamp, setLastSyncTimestamp] = createSignal<string | null>(
    null
  );
  const [lastSyncMode, setLastSyncMode] = createSignal<
    "full" | "incremental" | null
  >(null);

  // Track last sync outcome for diagnostics (and Playwright E2E gating)
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

  // Sync worker cleanup function and service instance
  let stopSyncWorker: (() => void) | null = null;
  let syncServiceInstance: SyncService | null = null;
  let autoPersistCleanup: (() => void) | null = null;

  // Catalog reconciliation tracking
  let catalogSelectionReconciledKey: string | null = null;
  let reconcileRunCount = 0;
  const RECONCILE_CHECK_INTERVAL = 10; // Check for drift every 10 syncs (~50 seconds)

  // Track if database is being initialized to prevent double initialization
  let isInitializing = false;

  // Optional one-time sync diagnostics (enabled by default).
  // Set `VITE_SYNC_DIAGNOSTICS=false` to disable row-count diagnostics.
  const SYNC_DIAGNOSTICS = import.meta.env.VITE_SYNC_DIAGNOSTICS !== "false";
  let syncDiagnosticsRan = false;

  const diagLog = (...args: unknown[]): void => {
    if (SYNC_DIAGNOSTICS) console.log(...args);
  };

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
          (
            SELECT COUNT(*)
            FROM repertoire_tune pt
            WHERE pt.repertoire_ref = p.repertoire_id
              AND pt.deleted = 0
          ) AS tune_count,
          (
            SELECT COUNT(*)
            FROM daily_practice_queue dpq
            WHERE dpq.repertoire_ref = p.repertoire_id
              AND dpq.active = 1
          ) AS active_queue,
          (
            SELECT COUNT(*)
            FROM practice_list_staged pls
            WHERE pls.repertoire_id = p.repertoire_id
              AND pls.repertoire_deleted = 0
              AND pls.deleted = 0
          ) AS staged_rows
        FROM repertoire p
        ORDER BY tune_count DESC
        LIMIT 10
      `);

      const stagedTop = await db.all<{
        repertoire_id: string;
        count: number;
      }>(sql`
        SELECT repertoire_id, COUNT(*) AS count
        FROM practice_list_staged
        WHERE repertoire_deleted = 0
          AND deleted = 0
        GROUP BY repertoire_id
        ORDER BY count DESC
        LIMIT 10
      `);

      console.warn("🔎 [SYNC_DIAG] Snapshot", {
        at: now,
        totals,
        topRepertoires: repertoireSummary,
        stagedTop,
      });
    } catch (e) {
      console.warn("⚠️ [SYNC_DIAG] Failed to collect diagnostics", e);
    }
  }

  /**
   * Query local SQLite for user's internal ID from user_profile.
   * Used after initial sync to get the internal ID for FK relationships.
   */
  async function getUserInternalIdFromLocalDb(
    db: SqliteDatabase,
    authUserId: string
  ): Promise<string | null> {
    // authUserId IS the canonical user identifier (user_profile.id PK).
    // No lookup needed - just verify the user exists.
    try {
      const { userProfile } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const result = await db
        .select({ id: userProfile.id })
        .from(userProfile)
        .where(eq(userProfile.id, authUserId))
        .limit(1);

      if (result && result.length > 0) {
        return result[0].id;
      }
      return null;
    } catch (error) {
      log.error("Failed to get user internal ID from local DB:", error);
      return null;
    }
  }

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
    /** If true, skip forceSyncUp/Down calls (used during initial sync to avoid recursion) */
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

      diagLog("🔎 [AuthContext] reconcileCatalogSelection snapshot", {
        userId: params.userId,
        selectedCount: selected.length,
        requiredCount: required.length,
        repertoireDefaultsCount: repertoireDefaults.length,
        tuneGenresCount: tuneGenres.length,
        repertoireCount,
        repertoireTuneCount,
        selected,
        required,
        repertoireDefaults,
      });

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

      // Smart guard: Run reconciliation if:
      // 1. First run (key is null), OR
      // 2. Selection inputs changed (key mismatch), OR
      // 3. Periodic check (every Nth sync for self-healing)
      const shouldReconcile =
        catalogSelectionReconciledKey !== reconcileKey ||
        reconcileRunCount % RECONCILE_CHECK_INTERVAL === 0;

      reconcileRunCount++;

      if (!shouldReconcile) {
        diagLog(
          "🔎 [AuthContext] Skipping reconciliation (no changes, not periodic check)"
        );
        return;
      }

      catalogSelectionReconciledKey = reconcileKey;

      let effectiveSelected: string[] = [];

      if (selected.length > 0) {
        // Rule 1: honor selection, but ensure repertoire genres are included.
        effectiveSelected = Array.from(new Set([...selected, ...required]));
      } else if (repertoireCount > 0) {
        if (repertoireTuneCount > 0) {
          // Rule 2: use genres from repertoire tunes + repertoire defaults.
          effectiveSelected = Array.from(
            new Set([...tuneGenres, ...repertoireDefaults])
          );
        } else {
          // Rule 3: no tunes yet, use repertoire defaults.
          effectiveSelected = Array.from(new Set([...repertoireDefaults]));
        }
      } else {
        // Rule 4: no repertoires, empty selection is acceptable.
        effectiveSelected = [];
      }

      if (effectiveSelected.length === 0) return;

      const selectionChanged = !arraysEqual(selected, effectiveSelected);
      diagLog("🔎 [AuthContext] reconcileCatalogSelection plan", {
        userId: params.userId,
        selectionChanged,
        effectiveSelectedCount: effectiveSelected.length,
      });
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
        diagLog("🔎 [AuthContext] reconcileCatalogSelection purge", {
          userId: params.userId,
          unselectedCount: unselected.length,
          purgedTuneCount: purgeResult.tuneIds.length,
        });

        // Skip sync calls during initial sync to avoid recursion - the sync just completed
        if (!params.skipSync) {
          if (selectionChanged && !params.isAnonymousUser) {
            await forceSyncUp({ allowDeletes: true });
          }

          if (selectionChanged || purgeResult.tuneIds.length > 0) {
            await forceSyncDown({ full: true });
          }
        }

        // ALWAYS signal catalog list changed after reconciliation completes.
        // This ensures the catalog grid refetches with the updated genre selection.
        // Previously only incremented when tunes were purged, causing stale data
        // when grid fetched before reconciliation completed.
        incrementCatalogListChanged();
      }
    } catch (error) {
      console.warn(
        "[AuthContext] Failed to reconcile catalog genre selection:",
        error
      );
    }
  };

  /**
   * Start the sync worker with common configuration.
   * Returns the sync worker stop function and service instance.
   */
  async function startSyncWorkerForUser(
    db: SqliteDatabase,
    authUserId: string,
    isAnonymousUser: boolean
  ): Promise<{ stop: () => void; service: SyncService }> {
    // `initialSyncComplete` is used as a UI gate for "DB ready" in some flows (anonymous/offline-safe),
    // so we can't rely on it to infer whether this is the first sync completion.
    // Track first completion per worker to ensure view signals fire at least once.
    let firstSyncCompletionHandled = false;
    let metadataPrefetchPromise: Promise<void> | null = null;
    let metadataPrefetchCompleted = false;

    const requestOverridesProvider = async () => {
      const startedAt = performance.now();
      diagLog("[AuthContext] requestOverridesProvider start", {
        user: authUserId,
        isAnonymousUser,
      });
      try {
        const { buildGenreFilterOverrides, preSyncMetadataViaWorker } =
          await import("@/lib/sync/genre-filter");

        // Only pre-fetch metadata for authenticated users (anonymous users work from local DB only)
        if (!isAnonymousUser) {
          const lastSyncAt =
            syncServiceInstance?.getLastSyncDownTimestamp?.() ?? null;

          // Get userId for debug logging (best effort)
          const debugUserId = await getUserInternalIdFromLocalDb(
            db,
            authUserId
          ).catch(() => null);

          const shouldRunMetadataPrefetch =
            !metadataPrefetchCompleted && !lastSyncAt;

          diagLog("[AuthContext] metadata prefetch decision", {
            shouldRunMetadataPrefetch,
            metadataPrefetchCompleted,
            hasLastSyncAt: !!lastSyncAt,
            debugUserId,
          });

          if (shouldRunMetadataPrefetch) {
            if (!metadataPrefetchPromise) {
              diagLog("[AuthContext] metadata prefetch start");
              metadataPrefetchPromise = preSyncMetadataViaWorker({
                db,
                supabase,
                lastSyncAt,
                userId: debugUserId ?? undefined,
              })
                .then(() => {
                  metadataPrefetchCompleted = true;
                  diagLog("[AuthContext] metadata prefetch complete");
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
            "[AuthContext] Failed to resolve internal user id for genre filtering"
          );
          return null;
        }

        const isInitialSync =
          !syncServiceInstance?.getLastSyncDownTimestamp?.();

        // For anonymous users on initial sync when catalog sync hasn't been done yet:
        // Only pull metadata tables (genre, instrument) to populate onboarding dialogs.
        // Catalog tables (tune, reference, etc.) will be pulled after genre selection.
        // We check catalogSyncPending (not initialSyncComplete) because initialSyncComplete
        // is set to true early to let the offline-first UI load, but catalog sync is still pending.
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
          console.log(
            "[AuthContext] 🎯 Anonymous initial sync: Deferring catalog sync until after genre selection. pullTables=",
            pullTablesOverride.pullTables
          );
          diagLog("[AuthContext] requestOverridesProvider done", {
            durationMs: Math.round(performance.now() - startedAt),
            mode: "anonymous-initial-defer-catalog",
          });
          return pullTablesOverride;
        }

        // For anonymous users doing catalog sync after genre selection:
        // Pull only the catalog tables that were excluded from initial sync.
        // This is a "partial initial sync" for catalog tables with genre filter applied.
        if (isAnonymousUser && isInitialSync && !catalogSyncPending()) {
          const catalogTablesOverride = {
            pullTables: [
              "tune",
              "reference",
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
          console.log(
            "[AuthContext] 🎯 Anonymous catalog sync: Pulling catalog tables with genre filter. pullTables=",
            catalogTablesOverride.pullTables
          );
          // Let genre filter be applied to these tables
          const genreOverrides = await buildGenreFilterOverrides({
            db,
            supabase,
            userId: internalId,
            isInitialSync,
          });
          diagLog("[AuthContext] requestOverridesProvider done", {
            durationMs: Math.round(performance.now() - startedAt),
            mode: "anonymous-initial-catalog",
            hasGenreOverrides: !!genreOverrides,
          });
          return {
            ...catalogTablesOverride,
            ...genreOverrides,
          };
        }

        const overrides = await buildGenreFilterOverrides({
          db,
          supabase,
          userId: internalId,
          isInitialSync,
        });
        diagLog("[AuthContext] requestOverridesProvider done", {
          durationMs: Math.round(performance.now() - startedAt),
          mode: "standard",
          hasOverrides: !!overrides,
          hasGenreFilter: !!overrides?.genreFilter,
          pullTablesCount: overrides?.pullTables?.length ?? 0,
        });
        return overrides;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isNetworkError =
          errorMsg.includes("Failed to fetch") ||
          errorMsg.includes("ERR_INTERNET_DISCONNECTED") ||
          errorMsg.includes("NetworkError") ||
          errorMsg.includes("Sync request timed out") ||
          errorMsg.includes(
            "Timed out while waiting for an open slot in the pool"
          ) ||
          errorMsg.includes("Sync failed: 503");

        if (isNetworkError) {
          console.warn(
            "[AuthContext] Skipping sync overrides due transient network error"
          );
        } else {
          console.error("[AuthContext] Failed to build sync overrides:", error);
        }
        diagLog("[AuthContext] requestOverridesProvider failed", {
          durationMs: Math.round(performance.now() - startedAt),
          error: errorMsg,
        });
        return null;
      }
    };

    const syncWorker = startSyncWorker(db, {
      supabase,
      userId: authUserId,
      realtimeEnabled:
        !isAnonymousUser && import.meta.env.VITE_REALTIME_ENABLED === "true",
      syncIntervalMs: isAnonymousUser ? 30000 : 5000, // Anonymous: less frequent sync
      pullOnly: isAnonymousUser,
      requestOverridesProvider,
      onSyncComplete: async (result) => {
        diagLog("[AuthContext] onSyncComplete called", result);

        const isFirstSyncCompletion = !firstSyncCompletionHandled;
        if (isFirstSyncCompletion) firstSyncCompletionHandled = true;
        log.debug(
          "Sync completed, incrementing remote sync down completion version"
        );

        // Record last sync outcome for E2E and UI diagnostics.
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

        setRemoteSyncDownCompletionVersion((prev) => {
          const newVersion = prev + 1;
          log.debug(
            "Remote sync down completion version changed:",
            prev,
            "->",
            newVersion
          );
          return newVersion;
        });

        // Update last syncDown timestamp
        if (syncServiceInstance) {
          const ts = syncServiceInstance.getLastSyncDownTimestamp();
          if (ts) setLastSyncTimestamp(ts);
          const mode = syncServiceInstance.getLastSyncMode();
          if (mode) setLastSyncMode(mode);
        } else if (result?.timestamp) {
          setLastSyncTimestamp(result.timestamp);
        }
        // On first sync, set userIdInt from local SQLite and mark sync complete
        if (!initialSyncComplete()) {
          // Get user's internal ID from local SQLite (now available after sync)
          const internalId = await getUserInternalIdFromLocalDb(db, authUserId);
          if (internalId) {
            setUserIdInt(internalId);
            diagLog(
              `✅ [AuthContext] User internal ID set from local DB: ${internalId}`
            );
          } else if (isAnonymousUser) {
            // For anonymous users, internal ID equals auth ID (we set it that way)
            setUserIdInt(authUserId);

            // e2e/tests/anonymous-003-account-conversion.spec.ts depends on this log
            console.log(
              `✅ [AuthContext] Anonymous user - using auth ID as internal ID`
            );
          } else {
            log.warn(
              "User profile not found in local DB after initial sync - this may cause issues"
            );
          }

          // CRITICAL: Reconcile genre selection BEFORE marking sync complete.
          // This ensures the catalog grid sees the correct genre filters when it fetches.
          // Previously, setTimeout deferred this causing a race where grid fetched with empty selection.
          await reconcileCatalogSelection({
            db,
            userId: authUserId,
            isAnonymousUser,
            skipSync: true, // Sync just completed; avoid recursive sync calls
          });

          setInitialSyncComplete(true);
          diagLog(
            "✅ [AuthContext] Initial sync complete, UI can now load data"
          );
          diagLog("🔍 [AuthContext] Sync result:", {
            success: result?.success,
            itemsSynced: result?.itemsSynced,
            errors: result?.errors?.length || 0,
          });

          // Persist database after initial sync
          import("@/lib/db/client-sqlite").then(({ persistDb }) => {
            persistDb()
              .then(() => {
                diagLog(
                  "💾 [AuthContext] Database persisted after initial sync"
                );
              })
              .catch((e) => {
                console.warn(
                  "⚠️ [AuthContext] Failed to persist after sync:",
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

        // CRITICAL FIX: On the first sync completion for a worker, always trigger all view signals
        // even if `affectedTables` is empty. This covers anonymous mode where `initialSyncComplete`
        // may already be true before the first syncDown finishes.
        if (isFirstSyncCompletion) {
          diagLog(
            "🔔 [AuthContext] First sync completion - triggering all view signals"
          );
          triggerAllViewSignals();
        }

        // One-time post-sync diagnostics (helps pinpoint missing repertoire/practice data).
        // Runs after first successful sync completion.
        if (
          SYNC_DIAGNOSTICS &&
          !syncDiagnosticsRan &&
          result?.success === true
        ) {
          syncDiagnosticsRan = true;
          await runSyncDiagnostics(db);
        }

        // Granular Signaling: Trigger specific view refreshes
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
              log.debug("[AuthContext] Triggering repertoire list refresh");
              incrementRepertoireListChanged();
            }
            if (categories.has("practice")) {
              log.debug("[AuthContext] Triggering practice list refresh");
              incrementPracticeListStagedChanged();
            }
            if (categories.has("catalog")) {
              log.debug("[AuthContext] Triggering catalog list refresh");
              incrementCatalogListChanged();
            }
          }
        } catch (e) {
          log.error("[AuthContext] Error in granular signaling:", e);
        }
      },
    });

    // E2E-only: expose a minimal sync control surface so Playwright can safely
    // stop background sync before clearing IndexedDB/local DB.
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

  function isDbInitAbortError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      msg.includes("Database initialization aborted") ||
      msg.includes("clearDb() was called during initialization")
    );
  }

  function isE2eDbClearInProgress(): boolean {
    return (
      typeof window !== "undefined" &&
      (window as any).__ttE2eIsClearing === true
    );
  }

  /**
   * Initialize local database for anonymous user.
   * Creates a user_profile in local SQLite and starts sync worker to get reference data.
   */
  async function initializeAnonymousDatabase(anonymousUserId: string) {
    // E2E teardown may clear IndexedDB while the app is still running.
    // If cleanup is in progress, do not attempt initialization or retries.
    if (isE2eDbClearInProgress()) {
      log.debug(
        "Skipping anonymous database initialization (E2E clear in progress)"
      );
      return;
    }

    // Check if we're already initializing
    if (isInitializing) {
      log.debug(
        "Skipping anonymous database initialization (already in progress)"
      );
      return;
    }

    // Check if DB is already initialized for this SAME user
    const existingDb = localDb();
    const currentUserId = userIdInt();
    if (existingDb && currentUserId === anonymousUserId) {
      log.debug(
        "Skipping anonymous database initialization (already initialized for same user)"
      );
      return;
    }

    // If switching to a DIFFERENT user, reset sync state so UI waits for new user's data
    if (currentUserId && currentUserId !== anonymousUserId) {
      diagLog("🔄 Switching anonymous users - resetting sync state");
      setInitialSyncComplete(false);
      setCatalogSyncPending(true); // New anonymous user needs to go through onboarding
      setUserIdInt(null);
    }

    isInitializing = true;
    try {
      log.info(
        "Initializing local database for anonymous user",
        anonymousUserId
      );

      // Initialize user-namespaced database (handles switching automatically)
      let db: SqliteDatabase;
      {
        const maxAttempts = 3;
        let attempt = 0;
        // E2E can clear IndexedDB/DB while the app is booting.
        // Treat "init aborted" as transient and retry briefly.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          attempt += 1;
          try {
            db = await initializeSqliteDb(anonymousUserId);
            break;
          } catch (e) {
            if (isE2eDbClearInProgress()) {
              console.warn(
                "[AuthContext] Anonymous DB init aborted during E2E clear; not retrying"
              );
              return;
            }
            if (!isDbInitAbortError(e) || attempt >= maxAttempts) throw e;
            const delayMs = 50 * attempt;
            console.warn(
              `[AuthContext] Anonymous DB init aborted (attempt ${attempt}/${maxAttempts}); retrying in ${delayMs}ms`
            );
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
      setLocalDb(db);
      // Set up auto-persistence (ensure we don't leak handlers across re-inits)
      if (autoPersistCleanup) {
        autoPersistCleanup();
        autoPersistCleanup = null;
      }
      autoPersistCleanup = setupAutoPersist();

      const now = new Date().toISOString();

      // 1. Create user_profile in LOCAL SQLite database (required for FK relationships)
      try {
        // Import schema dynamically to avoid circular deps
        const { userProfile } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");

        // Check if already exists in local DB
        const existingLocal = await db
          .select({ id: userProfile.id })
          .from(userProfile)
          .where(eq(userProfile.id, anonymousUserId))
          .limit(1);

        if (!existingLocal || existingLocal.length === 0) {
          // Creating a local-only `user_profile` row is required for FK relationships,
          // but it should not enqueue an outbox item that can block the initial syncDown.
          const rawDb = await getSqliteInstance();
          try {
            if (rawDb) suppressSyncTriggers(rawDb);
          } catch (e) {
            console.warn(
              "[AuthContext] Failed to suppress sync triggers for anonymous local profile insert:",
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
                "[AuthContext] Failed to re-enable sync triggers after anonymous local profile insert:",
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
        throw localError; // This is critical - we need the local profile
      }

      // Set anonymous flag early (before sync)
      setIsAnonymous(true);

      // For anonymous users, catalog sync is deferred until after genre selection during onboarding
      setCatalogSyncPending(true);

      // Offline-first: local SQLite is already usable at this point (we just ensured
      // user_profile exists). Allow UI to load immediately, even if initial syncDown
      // is deferred while offline.
      setUserIdInt(anonymousUserId);
      setInitialSyncComplete(true);
      diagLog(
        `✅ [AuthContext] Anonymous local DB ready (offline-safe). userIdInt=${anonymousUserId}`
      );

      // 2. Start sync worker to fetch reference data (pull-only for anonymous).
      if (import.meta.env.VITE_DISABLE_SYNC !== "true") {
        diagLog("📥 Starting sync worker for anonymous user (pull-only)...");
        const syncWorker = await startSyncWorkerForUser(
          db,
          anonymousUserId,
          true // isAnonymous
        );
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started for anonymous user (pull-only)");
        diagLog(
          "⏳ [AuthContext] Anonymous sync worker started (pull-only), waiting for initial sync..."
        );
        // Note: userIdInt will be set in onSyncComplete callback if needed
      } else {
        log.warn("⚠️ Sync disabled via VITE_DISABLE_SYNC environment variable");
        // When sync is disabled, set userIdInt immediately and mark sync as complete
        setUserIdInt(anonymousUserId);
        setInitialSyncComplete(true);
        diagLog(
          "✅ [AuthContext] Anonymous mode - sync disabled, using local data only"
        );
      }

      log.info("Anonymous local database initialization complete");
    } catch (error) {
      log.error("Failed to initialize anonymous local database:", error);
    } finally {
      isInitializing = false;
    }
  }

  /**
   * Initialize local database for authenticated user
   */
  async function initializeLocalDatabase(userId: string) {
    // E2E teardown may clear IndexedDB while the app is still running.
    // If cleanup is in progress, do not attempt initialization or retries.
    if (isE2eDbClearInProgress()) {
      log.debug("Skipping database initialization (E2E clear in progress)");
      return;
    }

    // Check if we're already initializing or already initialized FOR THIS SAME USER
    const currentUserId = userIdInt();
    if (isInitializing) {
      log.debug("Skipping database initialization (already in progress)");
      return;
    }

    // If we have a database but it's for a DIFFERENT user, we need to switch
    if (localDb() && currentUserId && currentUserId === userId) {
      log.debug(
        "Skipping database initialization (already initialized for this user)"
      );
      return;
    }

    isInitializing = true;
    try {
      log.info("Initializing local database for user", userId);
      diagLog(
        "🔍 [initializeLocalDatabase] Starting for user:",
        userId.substring(0, 8)
      );
      diagLog("🔍 [initializeLocalDatabase] Current state:", {
        isInitializing,
        hasLocalDb: !!localDb(),
        currentUserId,
        targetUserId: userId,
        initialSyncComplete: initialSyncComplete(),
      });

      // Reset sync state when switching users - critical for UI to show loading state
      // until the new user's data is synced
      setInitialSyncComplete(false);
      setUserIdInt(null);
      diagLog("🔄 [initializeLocalDatabase] Reset sync state for new user");

      // Initialize user-namespaced database (handles user switching automatically)
      let db: SqliteDatabase;
      {
        const maxAttempts = 3;
        let attempt = 0;
        // E2E can clear IndexedDB/DB while the app is booting.
        // Treat "init aborted" as transient and retry briefly.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          attempt += 1;
          try {
            db = await initializeSqliteDb(userId);
            break;
          } catch (e) {
            if (isE2eDbClearInProgress()) {
              console.warn(
                "[AuthContext] DB init aborted during E2E clear; not retrying"
              );
              return;
            }
            if (!isDbInitAbortError(e) || attempt >= maxAttempts) throw e;
            const delayMs = 50 * attempt;
            console.warn(
              `[AuthContext] DB init aborted (attempt ${attempt}/${maxAttempts}); retrying in ${delayMs}ms`
            );
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
      setLocalDb(db);

      // Offline-first: if we can resolve the internal user ID from local SQLite,
      // the UI should be allowed to load immediately (even if initial syncDown
      // is deferred while offline).
      const internalId = await getUserInternalIdFromLocalDb(db, userId);
      if (internalId) {
        setUserIdInt(internalId);
        setInitialSyncComplete(true);
        diagLog(
          `✅ [AuthContext] Local DB ready (offline-safe). userIdInt=${internalId}`
        );
      }
      diagLog(
        "✅ [initializeLocalDatabase] Database initialized and signal set"
      );

      // Keep pending offline changes across reloads.
      // Only clear old failed outbox items to avoid long-term buildup.
      const shouldDbInitDump = SYNC_DIAGNOSTICS;

      type IDbInitDiagPhase =
        | "beforeClearOldOutboxItems"
        | "afterClearOldOutboxItems"
        | "afterErrorClearOldOutboxItems";

      type IDbInitSnapshot = {
        phase: IDbInitDiagPhase;
        user: string;
        at: string;
        clientState?: unknown;
        sqlJs?: { hasModule: boolean; wasmHeapBytes?: number };
        hasSqliteInstance?: boolean;
        jsHeap?: {
          usedBytes: number;
          totalBytes: number;
          limitBytes: number;
        };
        wasmHeapBytes?: number;
        dbApproxBytes?: number;
        pageCount?: number;
        pageSize?: number;
        freelistCount?: number;
        tableCounts?: Record<string, number>;
        errors?: string[];
      };

      const collectDbInitSnapshot = async (
        phase: IDbInitDiagPhase,
        opts?: { includeTables?: boolean; error?: unknown }
      ): Promise<IDbInitSnapshot | null> => {
        if (!shouldDbInitDump) return null;

        const userShort = userId.substring(0, 8);
        const snapshot: IDbInitSnapshot = {
          phase,
          user: userShort,
          at: new Date().toISOString(),
        };

        const errors: string[] = [];

        try {
          const perfAny = performance as any;
          if (perfAny?.memory) {
            snapshot.jsHeap = {
              usedBytes: Number(perfAny.memory.usedJSHeapSize ?? 0),
              totalBytes: Number(perfAny.memory.totalJSHeapSize ?? 0),
              limitBytes: Number(perfAny.memory.jsHeapSizeLimit ?? 0),
            };
          }
        } catch (e) {
          errors.push(`jsHeap: ${e instanceof Error ? e.message : String(e)}`);
        }

        try {
          try {
            snapshot.clientState = getClientSqliteDebugState();
          } catch {
            // ignore
          }

          try {
            snapshot.sqlJs = getSqlJsDebugInfo();
            if (snapshot.sqlJs?.wasmHeapBytes) {
              snapshot.wasmHeapBytes = snapshot.sqlJs.wasmHeapBytes;
            }
          } catch {
            // ignore
          }

          const sqliteDb = await getSqliteInstance();
          snapshot.hasSqliteInstance = !!sqliteDb;
          if (!sqliteDb) {
            errors.push(
              "sqliteInstance: null (db not initialized yet or init failed)"
            );
          }

          if (sqliteDb) {
            try {
              const pageSizeRes = sqliteDb.exec("PRAGMA page_size;");
              const pageCountRes = sqliteDb.exec("PRAGMA page_count;");
              const freelistRes = sqliteDb.exec("PRAGMA freelist_count;");

              const pageSize = Number(pageSizeRes?.[0]?.values?.[0]?.[0] ?? 0);
              const pageCount = Number(
                pageCountRes?.[0]?.values?.[0]?.[0] ?? 0
              );
              const freelistCount = Number(
                freelistRes?.[0]?.values?.[0]?.[0] ?? 0
              );

              if (pageSize > 0) snapshot.pageSize = pageSize;
              if (pageCount > 0) snapshot.pageCount = pageCount;
              snapshot.freelistCount = freelistCount;
              if (pageSize > 0 && pageCount > 0) {
                snapshot.dbApproxBytes = pageSize * pageCount;
              }
            } catch (e) {
              errors.push(
                `pragma: ${e instanceof Error ? e.message : String(e)}`
              );
            }

            if (opts?.includeTables) {
              try {
                const master = sqliteDb.exec(
                  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
                );
                const names: string[] = (master?.[0]?.values ?? []).map((row) =>
                  String((row as unknown as any)[0])
                );

                const counts: Record<string, number> = {};
                for (const name of names) {
                  try {
                    const res = sqliteDb.exec(
                      `SELECT COUNT(*) as c FROM "${name.replaceAll('"', '""')}";`
                    );
                    counts[name] = Number(res?.[0]?.values?.[0]?.[0] ?? 0);
                  } catch (e) {
                    counts[name] = -1;
                    errors.push(
                      `count:${name}: ${e instanceof Error ? e.message : String(e)}`
                    );
                  }
                }
                snapshot.tableCounts = counts;
              } catch (e) {
                errors.push(
                  `sqlite_master: ${e instanceof Error ? e.message : String(e)}`
                );
              }
            }
          }
        } catch (e) {
          errors.push(`sqlite: ${e instanceof Error ? e.message : String(e)}`);
        }

        if (opts?.error) {
          const msg =
            opts.error instanceof Error
              ? opts.error.message
              : String(opts.error);
          errors.push(`error: ${msg}`);
        }

        if (errors.length > 0) snapshot.errors = errors;

        try {
          const header = {
            phase: snapshot.phase,
            user: snapshot.user,
            at: snapshot.at,
            clientState: snapshot.clientState,
            sqlJs: snapshot.sqlJs,
            hasSqliteInstance: snapshot.hasSqliteInstance,
            jsHeap: snapshot.jsHeap,
            wasmHeapBytes: snapshot.wasmHeapBytes,
            pageSize: snapshot.pageSize,
            pageCount: snapshot.pageCount,
            freelistCount: snapshot.freelistCount,
            dbApproxBytes: snapshot.dbApproxBytes,
            errors: snapshot.errors,
          };
          diagLog(`[DbInitDiag] ${JSON.stringify(header)}`);
          if (snapshot.tableCounts) {
            diagLog(
              `[DbInitDiag] tables user=${snapshot.user} ${JSON.stringify(snapshot.tableCounts)}`
            );
          }
        } catch (e) {
          diagLog(
            `[DbInitDiag] failed to emit snapshot: ${e instanceof Error ? e.message : String(e)}`
          );
        }

        return snapshot;
      };

      const includeTables = import.meta.env.VITE_SYNC_DIAGNOSTICS === "true";
      await collectDbInitSnapshot("beforeClearOldOutboxItems", {
        includeTables,
      });
      try {
        await clearOldOutboxItems(db);
        await collectDbInitSnapshot("afterClearOldOutboxItems");
      } catch (error) {
        await collectDbInitSnapshot("afterErrorClearOldOutboxItems", {
          includeTables: true,
          error,
        });
        throw error;
      }

      // Set up auto-persistence (ensure we don't leak handlers across re-inits)
      if (autoPersistCleanup) {
        autoPersistCleanup();
        autoPersistCleanup = null;
      }
      autoPersistCleanup = setupAutoPersist();

      // Start sync worker (now uses Supabase JS client, browser-compatible)
      // The user's internal ID will be set in onSyncComplete callback after initial sync
      // This avoids querying Supabase directly for user_profile
      if (import.meta.env.VITE_DISABLE_SYNC !== "true") {
        diagLog("📥 Starting sync worker for authenticated user...");
        const syncWorker = await startSyncWorkerForUser(
          db,
          userId,
          false // not anonymous
        );
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started");
        diagLog(
          "⏳ [AuthContext] Sync worker started, waiting for initial sync..."
        );
        // Note: userIdInt will be set in onSyncComplete callback after initial sync
      } else {
        log.warn("⚠️ Sync disabled via VITE_DISABLE_SYNC environment variable");
        // When sync is disabled, try to get userIdInt from local DB if available
        const internalId = await getUserInternalIdFromLocalDb(db, userId);
        if (internalId) {
          setUserIdInt(internalId);
        } else {
          // Fallback: use auth UUID directly (may cause issues with FKs if mismatch)
          log.warn(
            "No user profile in local DB - using auth UUID as internal ID"
          );
          setUserIdInt(userId);
        }
        setInitialSyncComplete(true);
      }

      log.info("Local database initialization complete");
    } catch (error) {
      log.error("Failed to initialize local database:", error);
    } finally {
      isInitializing = false;
    }
  }

  /**
   * Clear local database - useful for "clear all data" feature
   * Currently unused but kept for future use
   */
  async function _clearLocalDatabase() {
    try {
      // Stop auto-persist
      if (autoPersistCleanup) {
        autoPersistCleanup();
        autoPersistCleanup = null;
      }

      // Stop sync worker
      if (stopSyncWorker) {
        stopSyncWorker();
        stopSyncWorker = null;
        syncServiceInstance = null;
        log.info("Sync worker stopped");
      }

      await clearSqliteDb();
      setLocalDb(null);
      log.info("Local database cleared");
    } catch (error) {
      log.error("Failed to clear local database:", error);
    }
  }
  // Keep reference to avoid unused warning - can be exposed via context later
  void _clearLocalDatabase;

  /**
   * Check for existing session on mount
   */
  createEffect(() => {
    // Wrap async logic inside effect (SolidJS effects can't be async)
    void (async () => {
      try {
        // Check for legacy anonymous mode (localStorage-based)
        // and migrate to Supabase native anonymous auth if found
        const isLegacyAnonymousMode =
          localStorage.getItem(LEGACY_ANONYMOUS_USER_KEY) === "true";
        const legacyAnonymousUserId = localStorage.getItem(
          LEGACY_ANONYMOUS_USER_ID_KEY
        );

        if (isLegacyAnonymousMode && legacyAnonymousUserId) {
          // Clear legacy flags and sign in with Supabase anonymous auth
          diagLog(
            "🔄 Migrating legacy anonymous user to Supabase anonymous auth"
          );
          localStorage.removeItem(LEGACY_ANONYMOUS_USER_KEY);
          localStorage.removeItem(LEGACY_ANONYMOUS_USER_ID_KEY);

          // Sign in anonymously with Supabase (this creates a real auth.users entry)
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error("❌ Failed to migrate legacy anonymous user:", error);
            setLoading(false);
            return;
          }

          // The onAuthStateChange handler will pick up the new session
          diagLog(
            "✅ Legacy anonymous user migrated to Supabase:",
            data.user?.id
          );
          // Note: Local data from legacy anonymous mode will be orphaned
          // because the user_ref was the old anon_* ID
          setLoading(false);
          return;
        }

        // Otherwise, check for Supabase session
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();

        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          // Check if this is an anonymous user
          const isAnon = isUserAnonymous(existingSession.user);
          setIsAnonymous(isAnon);

          if (isAnon) {
            // Anonymous Supabase user - initialize local database
            diagLog(
              "🔄 Restoring Supabase anonymous session:",
              existingSession.user.id
            );
            await initializeAnonymousDatabase(existingSession.user.id);
          } else {
            // Regular authenticated user - initialize with sync
            void initializeLocalDatabase(existingSession.user.id);
          }
        }
      } catch (error) {
        log.error("Error during session initialization:", error);
      } finally {
        // Set loading to false to allow UI to render
        // Database initialization continues in background
        setLoading(false);
      }
    })();
  });

  /**
   * Listen for auth state changes
   */
  createEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      log.info("Auth state changed:", event);

      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Update anonymous state based on Supabase user
      if (newSession?.user) {
        const isAnon = isUserAnonymous(newSession.user);
        setIsAnonymous(isAnon);
      } else {
        setIsAnonymous(false);
      }

      // Initialize database on sign in (in background, don't block)
      if (event === "SIGNED_IN" && newSession?.user) {
        const isAnon = isUserAnonymous(newSession.user);
        diagLog("🔍 SIGNED_IN user details:", {
          email: newSession.user.email,
          app_metadata: newSession.user.app_metadata,
          identities: newSession.user.identities,
          isAnonymous: isAnon,
        });
        if (isAnon) {
          // Anonymous user - initialize local-only database
          void initializeAnonymousDatabase(newSession.user.id);
        } else {
          // Registered user - initialize with sync
          void initializeLocalDatabase(newSession.user.id);
        }
      }

      // Handle user update (e.g., anonymous to registered conversion)
      if (event === "USER_UPDATED" && newSession?.user) {
        const wasAnonymous = isAnonymous();
        const isNowAnonymous = isUserAnonymous(newSession.user);

        if (wasAnonymous && !isNowAnonymous) {
          // User just converted from anonymous to registered
          diagLog("🔄 User converted from anonymous to registered");
          setIsAnonymous(false);
        }
      }

      // Note: We don't clear database on SIGNED_OUT event anymore
      // Database lifecycle is managed in signOut() and initializeLocalDatabase()
      // - signOut() persists to IndexedDB and resets in-memory state
      // - initializeLocalDatabase() clears if different user signs in
    });

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  /**
   * Sign in with email and password
   */
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    diagLog("🔐 SignIn attempt:", {
      email,
      passwordLength: password.length,
    });
    diagLog("🔐 Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    diagLog("🔐 SignIn result:", {
      success: !result.error,
      error: result.error,
      user: result.data?.user?.email,
    });
    setLoading(false);
    return { error: result.error };
  };

  /**
   * Sign up with email and password
   */
  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });
    setLoading(false);
    return { error };
  };

  /**
   * Sign in with OAuth provider
   */
  const signInWithOAuth = async (provider: "google" | "github") => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    return { error };
  };

  /**
   * Sign in anonymously using Supabase native anonymous auth
   * Creates a real auth.users entry with is_anonymous = true
   * UUID is preserved when user later converts to registered account
   *
   * If user previously signed out as anonymous, restores their session
   * instead of creating a new anonymous user (preserves their data)
   */
  const signInAnonymously = async (injectedUserId?: string) => {
    if (injectedUserId) {
      setLoading(true);
      diagLog("🔐 Anonymous sign-in (injected user id)");
      await initializeAnonymousDatabase(injectedUserId);
      setIsAnonymous(true);
      setUserIdInt(injectedUserId);
      setLoading(false);
      return { error: null };
    }

    setLoading(true);
    diagLog("🔐 Anonymous sign-in attempt (Supabase native)");

    try {
      // Check if there's a saved anonymous session to restore
      const savedSession = localStorage.getItem(ANONYMOUS_SESSION_KEY);
      diagLog(
        "🔍 Checking for saved anonymous session:",
        savedSession ? "FOUND" : "NOT FOUND"
      );
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          const { refresh_token, user_id } = parsed;
          diagLog(
            "🔍 Parsed saved session - user_id:",
            user_id,
            "has refresh_token:",
            !!refresh_token
          );
          if (refresh_token) {
            diagLog("🔄 Restoring previous anonymous session...");
            const { data: refreshData, error: refreshError } =
              await supabase.auth.refreshSession({
                refresh_token,
              });

            diagLog(
              "🔍 Refresh result - error:",
              refreshError,
              "has session:",
              !!refreshData?.session
            );
            if (!refreshError && refreshData.session) {
              // Successfully restored session - clear saved session
              localStorage.removeItem(ANONYMOUS_SESSION_KEY);
              diagLog(
                "✅ Restored anonymous session for user:",
                refreshData.user?.id
              );

              // Initialize the database for this restored user
              await initializeAnonymousDatabase(refreshData.user!.id);

              // The onAuthStateChange handler will handle the rest
              setIsAnonymous(true);
              setLoading(false);
              return { error: null };
            } else {
              // Refresh failed - session expired, create new anonymous user
              diagLog(
                "⚠️ Could not restore anonymous session, creating new one. Error:",
                refreshError?.message
              );
              localStorage.removeItem(ANONYMOUS_SESSION_KEY);
            }
          }
        } catch (parseError) {
          console.warn("Failed to parse saved anonymous session:", parseError);
          localStorage.removeItem(ANONYMOUS_SESSION_KEY);
        }
      }

      // Use Supabase's native anonymous auth
      // This creates a real user in auth.users with is_anonymous = true
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        console.error("❌ Supabase anonymous sign-in failed:", error);
        setLoading(false);
        return { error };
      }

      const anonymousUserId = data.user?.id;
      if (!anonymousUserId) {
        const err = new Error("No user ID returned from anonymous sign-in");
        console.error("❌ Anonymous sign-in failed:", err);
        setLoading(false);
        return { error: err };
      }

      // The onAuthStateChange handler will fire and set user/session
      // But we also need to set anonymous mode explicitly
      setIsAnonymous(true);

      // Initialize local database for anonymous user
      await initializeAnonymousDatabase(anonymousUserId);

      // e2e/tests/anonymous-003-account-conversion.spec.ts depends on this log
      console.log("✅ Supabase anonymous sign-in successful:", anonymousUserId);
      setLoading(false);
      return { error: null };
    } catch (error) {
      console.error("❌ Anonymous sign-in failed:", error);
      setLoading(false);
      return { error: error as Error };
    }
  };

  /**
   * Convert anonymous user to registered account
   * Uses Supabase's updateUser to link email/password while preserving UUID
   * This ensures all local data with user_ref FK remains valid
   */
  const convertAnonymousToRegistered = async (
    email: string,
    password: string,
    name: string
  ) => {
    setLoading(true);

    // e2e/tests/anonymous-003-account-conversion.spec.ts depends on this log
    console.log("🔄 Converting anonymous user to registered account");

    try {
      if (!isAnonymous()) {
        throw new Error("User is not in anonymous mode");
      }

      // Wait briefly for userIdInt signal to populate (handle race during conversion)
      let anonymousUserId: string | null = userIdInt();
      for (let i = 0; !anonymousUserId && i < 10; i += 1) {
        anonymousUserId = userIdInt();
        if (!anonymousUserId) {
          await new Promise<void>((res) => setTimeout(res, 100));
        }
      }
      // optional debug
      log.debug("convertAnonymousToRegistered: resolved anonymousUserId:", {
        anonymousUserId,
      });
      if (!anonymousUserId) {
        throw new Error("No anonymous user ID found");
      }

      // Use updateUser to link email/password to existing anonymous user
      // This preserves the UUID - the user ID doesn't change!
      const { data: updateData, error: updateError } =
        await supabase.auth.updateUser({
          email,
          password,
          data: {
            name,
          },
        });

      if (updateError) {
        console.error("❌ Account linking failed:", updateError);
        setLoading(false);
        return { error: updateError };
      }

      // e2e/tests/anonymous-003-account-conversion.spec.ts depends on this log
      console.log("✅ Email/password linked to anonymous account");

      // e2e/tests/anonymous-003-account-conversion.spec.ts depends on this log
      console.log("👤 User ID preserved:", updateData.user?.id);

      // Update user_profile in LOCAL SQLite - sync will push it to Supabase
      // This avoids direct Supabase queries which can race with sync
      try {
        const db = localDb();
        if (db) {
          const { userProfile } = await import("@/lib/db/schema");
          const { eq } = await import("drizzle-orm");

          await db
            .update(userProfile)
            .set({
              email,
              name,
              lastModifiedAt: new Date().toISOString(),
              syncVersion: 2, // Increment to trigger sync
            })
            .where(eq(userProfile.id, anonymousUserId));

          diagLog("✅ Local user_profile updated with email:", email);
        }
      } catch (profileError) {
        // Non-fatal - the account is still converted, sync will eventually catch up
        log.warn(
          "Error updating local user_profile during conversion:",
          profileError
        );
      }

      // Clear anonymous mode flag (user is now registered)
      setIsAnonymous(false);

      // Clear any legacy localStorage flags (in case they exist)
      localStorage.removeItem(LEGACY_ANONYMOUS_USER_KEY);
      localStorage.removeItem(LEGACY_ANONYMOUS_USER_ID_KEY);

      diagLog("✅ Account conversion complete - UUID preserved!");
      diagLog("🔄 Local data with user_ref FK references remain valid");

      // Note: is_anonymous in auth.users is automatically set to false by Supabase
      // when the user is linked to an email identity

      // Sync worker should already be running (anonymous users now use sync too)
      // It will push the updated user_profile automatically
      // If for some reason it's not running, start it now
      const db = localDb();
      const currentUser = user();
      if (db && currentUser && !stopSyncWorker) {
        diagLog("⏳ Starting sync with Supabase for converted user...");
        const syncWorker = await startSyncWorkerForUser(
          db,
          currentUser.id,
          false // no longer anonymous
        );
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started after anonymous conversion");
      } else if (stopSyncWorker) {
        diagLog(
          "✅ Sync worker already running - will push updated user_profile"
        );
      }

      setLoading(false);
      return { error: null };
    } catch (error) {
      console.error("❌ Conversion failed:", error);
      setLoading(false);
      return { error: error as Error };
    }
  };

  /**
   * Sign out and clear local data
   * For anonymous users, preserves their Supabase session so they can return later
   */
  const signOut = async () => {
    setLoading(true);
    catalogSelectionReconciledKey = null;
    reconcileRunCount = 0;

    // For anonymous users, DON'T call supabase.auth.signOut()
    // This preserves their session so they can return to the same account
    // Supabase signOut() invalidates the refresh token, making restoration impossible
    if (isAnonymous()) {
      const currentSession = session();
      diagLog("🔍 Sign out (anonymous) - preserving Supabase session");
      if (currentSession?.refresh_token) {
        diagLog(
          "💾 Saving anonymous session for later restoration, user:",
          currentSession.user?.id
        );
        localStorage.setItem(
          ANONYMOUS_SESSION_KEY,
          JSON.stringify({
            refresh_token: currentSession.refresh_token,
            user_id: currentSession.user?.id,
          })
        );
        // Verify it was saved
        const saved = localStorage.getItem(ANONYMOUS_SESSION_KEY);
        diagLog("💾 Verified saved session:", saved ? "YES" : "NO");
      } else {
        console.warn("⚠️ No refresh token available to save");
      }

      // Close database properly (persists and resets module state)
      // This allows the next user to initialize cleanly
      try {
        await closeSqliteDb();
      } catch (closeError) {
        console.warn("⚠️ Failed to close database:", closeError);
      }

      // Stop auto-persist cleanup
      if (autoPersistCleanup) {
        autoPersistCleanup();
        autoPersistCleanup = null;
      }

      // Reset AuthContext signal
      setLocalDb(null);
    } else {
      // For registered users, do a full sign out
      // IMPORTANT: Do NOT clear ANONYMOUS_SESSION_KEY - the user may want to return
      // to their anonymous session after logging out of their registered account
      diagLog(
        "🔍 Sign out - registered user, full sign out (preserving any saved anonymous session)"
      );

      // Stop sync worker before closing database
      if (stopSyncWorker) {
        stopSyncWorker();
        stopSyncWorker = null;
        syncServiceInstance = null;
        diagLog("🛑 Stopped sync worker");
      }

      // Close database properly (persists and resets module state)
      try {
        await closeSqliteDb();
      } catch (closeError) {
        console.warn("⚠️ Failed to close database:", closeError);
      }

      // Stop auto-persist cleanup
      if (autoPersistCleanup) {
        autoPersistCleanup();
        autoPersistCleanup = null;
      }

      // Reset AuthContext signal
      setLocalDb(null);

      await supabase.auth.signOut();
    }

    // Clear any legacy localStorage flags
    localStorage.removeItem(LEGACY_ANONYMOUS_USER_KEY);
    localStorage.removeItem(LEGACY_ANONYMOUS_USER_ID_KEY);

    setSession(null);
    setUser(null);
    setUserIdInt(null);
    setIsAnonymous(false);
    setInitialSyncComplete(false);
    setLoading(false);
  };

  /**
   * Force sync down from Supabase (manual sync)
   */
  const forceSyncDown = async (opts?: { full?: boolean }) => {
    if (!syncServiceInstance) {
      console.warn("⚠️ [ForceSyncDown] Sync service not available");
      log.warn("Sync service not available");
      return;
    }

    try {
      diagLog("🔄 [ForceSyncDown] Starting sync down from Supabase...");
      log.info("Forcing sync down from Supabase...");
      const result = opts?.full
        ? await syncServiceInstance.forceFullSyncDown()
        : await syncServiceInstance.syncDown();

      diagLog(
        `✅ [ForceSyncDown] ${opts?.full ? "Full" : "Incremental"} sync down completed:`,
        {
          success: result.success,
          itemsSynced: result.itemsSynced,
          itemsFailed: result.itemsFailed,
          conflicts: result.conflicts,
          errors: result.errors,
        }
      );
      log.info(
        `Force ${opts?.full ? "FULL" : "incremental"} sync down completed:`,
        result
      );

      // Increment remote sync down completion version to trigger UI updates
      setRemoteSyncDownCompletionVersion((prev) => {
        const newVersion = prev + 1;
        diagLog(
          `🔄 [ForceSyncDown] Remote sync down completion version updated: ${prev} → ${newVersion}`
        );
        log.debug(
          "Remote sync down completion version changed after force sync:",
          prev,
          "->",
          newVersion
        );
        return newVersion;
      });
      // Update last sync timestamp after manual syncDown
      const ts = syncServiceInstance.getLastSyncDownTimestamp();
      if (ts) setLastSyncTimestamp(ts);
      const mode = syncServiceInstance.getLastSyncMode();
      if (mode) setLastSyncMode(mode);
    } catch (error) {
      console.error("❌ [ForceSyncDown] Sync down failed:", error);
      log.error("Force sync down failed:", error);
      throw error;
    }
  };

  /**
   * Increment remote sync down completion version to trigger UI refresh
   * DEPRECATED: This should only be called by SyncService after syncDown completes.
   * For local data changes, use view-specific signals (e.g., incrementPracticeListStagedChanged).
   * Call this after local database mutations (staging, deletions, etc.)
   * to force grids and queries to refetch data
   */
  const incrementRemoteSyncDownCompletion = () => {
    setRemoteSyncDownCompletionVersion((prev) => {
      const newVersion = prev + 1;
      diagLog(
        `🔄 [incrementRemoteSyncDownCompletion] Remote sync down completion version updated: ${prev} → ${newVersion}`
      );
      return newVersion;
    });
  };

  /**
   * View-specific change signal increment functions
   * These are called immediately after local writes to trigger optimistic UI updates
   */

  /**
   * Increment all view signals at once
   * Used on initial sync to ensure all views refresh regardless of affected tables
   */
  const triggerAllViewSignals = () => {
    incrementPracticeListStagedChanged();
    incrementRepertoireListChanged();
    incrementCatalogListChanged();
  };

  /**
   * Increment practice list staged changed counter
   * Call after writes affecting practice_list_staged VIEW
   * (evaluations, queue operations, staging operations)
   */
  const incrementPracticeListStagedChanged = () => {
    setPracticeListStagedChanged((prev) => {
      const newVersion = prev + 1;
      diagLog(
        `🔄 [incrementPracticeListStagedChanged] Practice list version: ${prev} → ${newVersion}`
      );
      return newVersion;
    });
  };

  /**
   * Increment catalog list changed counter
   * Call after writes affecting catalog VIEWs
   * (catalog metadata changes, tune additions/deletions)
   */
  const incrementCatalogListChanged = () => {
    setCatalogListChanged((prev) => {
      const newVersion = prev + 1;
      diagLog(
        `🔄 [incrementCatalogListChanged] Catalog list version: ${prev} → ${newVersion}`
      );
      return newVersion;
    });
  };

  /**
   * Increment repertoire list changed counter
   * Call after writes affecting repertoire VIEWs
   * (repertoire metadata changes, repertoire additions/deletions)
   */
  const incrementRepertoireListChanged = () => {
    setRepertoireListChanged((prev) => {
      const newVersion = prev + 1;
      diagLog(
        `🔄 [incrementRepertoireListChanged] Repertoire list version: ${prev} → ${newVersion}`
      );
      return newVersion;
    });
  };

  /**
   * Force sync up to Supabase (push local changes immediately)
   */
  const forceSyncUp = async (opts?: { allowDeletes?: boolean }) => {
    if (!syncServiceInstance) {
      console.warn("⚠️ [ForceSyncUp] Sync service not available");
      log.warn("Sync service not available");
      return;
    }

    const waitForSyncIdle = async (timeoutMs = 15_000) => {
      const startedAt = Date.now();
      while (syncServiceInstance?.syncing) {
        if (Date.now() - startedAt > timeoutMs) {
          throw new Error("Timed out waiting for in-progress sync to finish");
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    };

    try {
      diagLog("🔄 [ForceSyncUp] Starting sync up to Supabase...");
      log.info("Forcing sync up to Supabase...");

      let result: Awaited<ReturnType<SyncService["syncUp"]>>;
      try {
        result = await syncServiceInstance.syncUp(opts);
      } catch (error) {
        if (
          error instanceof SyncInProgressError ||
          (error instanceof Error && error.name === "SyncInProgressError")
        ) {
          console.warn(
            "⚠️ [ForceSyncUp] Sync already in progress - waiting and retrying..."
          );
          await waitForSyncIdle();
          result = await syncServiceInstance.syncUp(opts);
        } else {
          throw error;
        }
      }

      diagLog("✅ [ForceSyncUp] Sync up completed:", {
        success: result.success,
        itemsSynced: result.itemsSynced,
        itemsFailed: result.itemsFailed,
        conflicts: result.conflicts,
        errors: result.errors,
      });
      log.info("Force sync up completed:", result);

      // Increment remote sync down completion version to trigger UI updates
      setRemoteSyncDownCompletionVersion((prev) => {
        const newVersion = prev + 1;
        diagLog(
          `🔄 [ForceSyncUp] Remote sync down completion version updated: ${prev} → ${newVersion}`
        );
        log.debug(
          "Remote sync down completion version changed after force sync:",
          prev,
          "->",
          newVersion
        );
        return newVersion;
      });
    } catch (error) {
      console.error("❌ [ForceSyncUp] Sync up failed:", error);
      log.error("Force sync up failed:", error);
      throw error;
    }
  };

  /**
   * Scoped practice-related syncDown (after successful evaluation commit).
   * Minimizes latency vs full table sweep by restricting to just practice tables.
   */
  const syncPracticeScope = async () => {
    if (!syncServiceInstance) {
      console.warn("⚠️ [syncPracticeScope] Sync service not available");
      return;
    }

    // Skip sync if offline (browser reports no connectivity)
    if (!navigator.onLine) {
      diagLog("⚠️ [syncPracticeScope] Skipping - browser is offline");
      return;
    }

    try {
      diagLog("🔄 [syncPracticeScope] Starting scoped practice syncDown...");
      const tables = [
        "repertoire_tune",
        "practice_record",
        "daily_practice_queue",
        "table_transient_data",
      ] as const;
      const result = await (syncServiceInstance as any).syncDownTables(tables);
      diagLog(
        "✅ [syncPracticeScope] Scoped practice syncDown complete",
        result
      );
      // Update mode & timestamp signals
      const ts = syncServiceInstance.getLastSyncDownTimestamp();
      if (ts) setLastSyncTimestamp(ts);
      const mode = syncServiceInstance.getLastSyncMode();
      if (mode) setLastSyncMode(mode);
      // Increment completion version for UI refresh
      setRemoteSyncDownCompletionVersion((prev) => prev + 1);
    } catch (e) {
      console.error("❌ [syncPracticeScope] Scoped practice sync failed", e);
    }
  };

  const authState: AuthState = {
    user,
    userIdInt,
    session,
    loading,
    localDb,
    remoteSyncDownCompletionVersion,
    initialSyncComplete,
    isAnonymous,
    incrementRemoteSyncDownCompletion,
    practiceListStagedChanged,
    incrementPracticeListStagedChanged,
    catalogListChanged,
    incrementCatalogListChanged,
    repertoireListChanged,
    incrementRepertoireListChanged,
    signIn,
    signUp,
    signInWithOAuth,
    signInAnonymously,
    convertAnonymousToRegistered,
    signOut,
    forceSyncDown,
    forceSyncUp,
    catalogSyncPending,
    triggerCatalogSync: async () => {
      if (catalogSyncPending()) {
        console.log(
          "[AuthContext] Triggering catalog sync after genre selection"
        );
        setCatalogSyncPending(false);

        // Use full:true to make this an "initial sync" so requestOverridesProvider
        // can apply the catalog-only pullTables override (condition #2).
        // Without full:true, this would be an incremental sync and the pullTables condition
        // wouldn't match (because isInitialSync would be false).
        await forceSyncDown({ full: true });
      }
    },
    lastSyncTimestamp,
    lastSyncMode,
    syncPracticeScope,
  };

  // TEST HOOKS: Expose manual sync controls for Playwright to call explicitly
  if (typeof window !== "undefined") {
    const w = window as any;
    if (!w.__forceSyncUpForTest) {
      w.__forceSyncUpForTest = async () => {
        try {
          await forceSyncUp();
        } catch (e) {
          console.warn("__forceSyncUpForTest failed", e);
        }
      };
    }
    if (!w.__forceSyncDownForTest) {
      w.__forceSyncDownForTest = async () => {
        try {
          await forceSyncDown();
        } catch (e) {
          console.warn("__forceSyncDownForTest failed", e);
        }
      };
    }
    // AUTH DIAGNOSTIC: Capture session state, expiry proximity, and current (possibly time‑traveled) clock.
    // Label parameter lets tests tag when/where it was invoked.
    if (!w.__authSessionDiagForTest) {
      w.__authSessionDiagForTest = async (label?: string) => {
        try {
          const { data, error } = await supabase.auth.getSession();
          const session = data?.session || null;
          const expEpoch = session?.expires_at
            ? session.expires_at * 1000
            : null; // seconds → ms
          const nowMs = Date.now();
          const msUntilExpiry = expEpoch !== null ? expEpoch - nowMs : null;
          const diag = {
            label: label || "",
            hasSession: !!session,
            userId: session?.user?.id || null,
            error,
            nowIso: new Date(nowMs).toISOString(),
            expiresAtEpochSec: session?.expires_at ?? null,
            msUntilExpiry,
            timeTravelAheadMs: session?.expires_at
              ? nowMs - session.expires_at * 1000
              : null,
            accessTokenLength: session?.access_token?.length ?? 0,
            refreshTokenLength: session?.refresh_token?.length ?? 0,
          };
          // Use console.log so Playwright captures it in CI run output.
          // Prefix makes grepping easy: AUTH DIAG
          // NOTE: Avoid JSON.stringify circular refs by logging plain object.
          diagLog("AUTH DIAG", diag);
          // Store last hasSession for quick page.evaluate access in diagnostics-only spec
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
    <AuthContext.Provider value={authState}>
      <div
        data-auth-initialized={!loading()}
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
    </AuthContext.Provider>
  );
};

/**
 * Hook to access auth context
 *
 * @throws Error if used outside AuthProvider
 *
 * @example
 * ```tsx
 * import { useAuth } from '@/lib/auth/AuthContext';
 *
 * function MyComponent() {
 *   const { user, signIn, signOut } = useAuth();
 *
 *   return (
 *     <div>
 *       {user() ? (
 *         <button onClick={signOut}>Sign Out</button>
 *       ) : (
 *         <button onClick={() => signIn('user@example.com', 'password')}>
 *           Sign In
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
