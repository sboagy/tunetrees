/**
 * Authentication Context for TuneTrees
 *
 * Provides SolidJS reactive auth state and methods using Supabase Auth.
 * Handles user session management and local database initialization.
 *
 * @module auth/AuthContext
 */

import type { AuthError, Session, User } from "@supabase/supabase-js";
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
import { TABLE_REGISTRY } from "../../../shared/table-meta";
import {
  clearDb as clearSqliteDb,
  closeDb as closeSqliteDb,
  initializeDb as initializeSqliteDb,
  type SqliteDatabase,
  setupAutoPersist,
} from "../db/client-sqlite";
import { log } from "../logger";
import { supabase } from "../supabase/client";
import {
  clearOldOutboxItems,
  type SyncService,
  startSyncWorker,
} from "../sync";

/**
 * Authentication state interface
 */
interface AuthState {
  /** Current authenticated user (reactive) */
  user: Accessor<User | null>;
  /** Current authenticated user's UUID from user_profile.supabase_user_id (reactive) */
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
  signInAnonymously: () => Promise<{ error: Error | null }>;

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
  /** Last successful syncDown ISO timestamp (null if none yet) */
  lastSyncTimestamp: Accessor<string | null>;
  /** Mode of last syncDown ('full' | 'incremental' | null if none yet) */
  lastSyncMode: Accessor<"full" | "incremental" | null>;

  /** Scoped practice sync (playlist_tune, practice_record, daily_practice_queue, table_transient_data) */
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

  // Track if database is being initialized to prevent double initialization
  let isInitializing = false;

  // Optional one-time sync diagnostics (off by default).
  // Enable via `VITE_SYNC_DIAGNOSTICS=true` to log row counts after sync.
  const SYNC_DIAGNOSTICS = import.meta.env.VITE_SYNC_DIAGNOSTICS === "true";
  let syncDiagnosticsRan = false;

  async function runSyncDiagnostics(db: SqliteDatabase): Promise<void> {
    try {
      const now = new Date().toISOString();

      const totals = await db.all<{ table: string; count: number }>(sql`
        SELECT 'user_profile' AS table, COUNT(*) AS count FROM user_profile
        UNION ALL SELECT 'playlist', COUNT(*) FROM playlist
        UNION ALL SELECT 'playlist_tune', COUNT(*) FROM playlist_tune
        UNION ALL SELECT 'tune', COUNT(*) FROM tune
        UNION ALL SELECT 'practice_record', COUNT(*) FROM practice_record
        UNION ALL SELECT 'daily_practice_queue', COUNT(*) FROM daily_practice_queue
      `);

      const playlistSummary = await db.all<{
        playlist_id: string;
        name: string | null;
        user_ref: string;
        deleted: number;
        tune_count: number;
        active_queue: number;
        staged_rows: number;
      }>(sql`
        SELECT
          p.playlist_id,
          p.name,
          p.user_ref,
          p.deleted,
          (
            SELECT COUNT(*)
            FROM playlist_tune pt
            WHERE pt.playlist_ref = p.playlist_id
              AND pt.deleted = 0
          ) AS tune_count,
          (
            SELECT COUNT(*)
            FROM daily_practice_queue dpq
            WHERE dpq.playlist_ref = p.playlist_id
              AND dpq.active = 1
          ) AS active_queue,
          (
            SELECT COUNT(*)
            FROM practice_list_staged pls
            WHERE pls.playlist_id = p.playlist_id
              AND pls.playlist_deleted = 0
              AND pls.deleted = 0
          ) AS staged_rows
        FROM playlist p
        ORDER BY tune_count DESC
        LIMIT 10
      `);

      const stagedTop = await db.all<{
        playlist_id: string;
        count: number;
      }>(sql`
        SELECT playlist_id, COUNT(*) AS count
        FROM practice_list_staged
        WHERE playlist_deleted = 0
          AND deleted = 0
        GROUP BY playlist_id
        ORDER BY count DESC
        LIMIT 10
      `);

      console.warn("🔎 [SYNC_DIAG] Snapshot", {
        at: now,
        totals,
        topPlaylists: playlistSummary,
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
    try {
      const { userProfile } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const result = await db
        .select({ id: userProfile.id })
        .from(userProfile)
        .where(eq(userProfile.supabaseUserId, authUserId))
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

  /**
   * Start the sync worker with common configuration.
   * Returns the sync worker stop function and service instance.
   */
  async function startSyncWorkerForUser(
    db: SqliteDatabase,
    authUserId: string,
    isAnonymousUser: boolean
  ): Promise<{ stop: () => void; service: SyncService }> {
    const syncWorker = startSyncWorker(db, {
      supabase,
      userId: authUserId,
      realtimeEnabled:
        !isAnonymousUser && import.meta.env.VITE_REALTIME_ENABLED === "true",
      syncIntervalMs: isAnonymousUser ? 30000 : 5000, // Anonymous: less frequent sync
      onSyncComplete: async (result) => {
        console.log("[AuthContext] onSyncComplete called", result);
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
            console.log(
              `✅ [AuthContext] User internal ID set from local DB: ${internalId}`
            );
          } else if (isAnonymousUser) {
            // For anonymous users, internal ID equals auth ID (we set it that way)
            setUserIdInt(authUserId);
            console.log(
              `✅ [AuthContext] Anonymous user - using auth ID as internal ID`
            );
          } else {
            log.warn(
              "User profile not found in local DB after initial sync - this may cause issues"
            );
          }

          setInitialSyncComplete(true);
          console.log(
            "✅ [AuthContext] Initial sync complete, UI can now load data"
          );
          console.log("🔍 [AuthContext] Sync result:", {
            success: result?.success,
            itemsSynced: result?.itemsSynced,
            errors: result?.errors?.length || 0,
          });

          // Persist database after initial sync
          import("@/lib/db/client-sqlite").then(({ persistDb }) => {
            persistDb()
              .then(() => {
                console.log(
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

          // CRITICAL FIX: On initial sync, always trigger all view signals
          // even if affectedTables is empty (first login may have no data to sync)
          // This ensures UI components waiting for these signals will render
          console.log(
            "🔔 [AuthContext] Initial sync - triggering all view signals"
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

    return syncWorker;
  }

  /**
   * Initialize local database for anonymous user.
   * Creates a user_profile in local SQLite and starts sync worker to get reference data.
   */
  async function initializeAnonymousDatabase(anonymousUserId: string) {
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
      console.log("🔄 Switching anonymous users - resetting sync state");
      setInitialSyncComplete(false);
      setUserIdInt(null);
    }

    isInitializing = true;
    try {
      log.info(
        "Initializing local database for anonymous user",
        anonymousUserId
      );

      // Initialize user-namespaced database (handles switching automatically)
      const db = await initializeSqliteDb(anonymousUserId);
      setLocalDb(db);
      // Set up auto-persistence (store cleanup for later)
      autoPersistCleanup = setupAutoPersist();

      const now = new Date().toISOString();

      // 1. Create user_profile in LOCAL SQLite database (required for FK relationships)
      try {
        // Import schema dynamically to avoid circular deps
        const { userProfile } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");

        // Check if already exists in local DB
        const existingLocal = await db
          .select({ id: userProfile.supabaseUserId })
          .from(userProfile)
          .where(eq(userProfile.supabaseUserId, anonymousUserId))
          .limit(1);

        if (!existingLocal || existingLocal.length === 0) {
          await db.insert(userProfile).values({
            id: anonymousUserId, // Use Supabase UUID as internal ID
            supabaseUserId: anonymousUserId,
            name: "Anonymous User",
            email: null,
            srAlgType: "fsrs",
            deleted: 0,
            syncVersion: 1,
            lastModifiedAt: now,
            deviceId: "local",
          });
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

      // Offline-first: local SQLite is already usable at this point (we just ensured
      // user_profile exists). Allow UI to load immediately, even if initial syncDown
      // is deferred while offline.
      setUserIdInt(anonymousUserId);
      setInitialSyncComplete(true);
      console.log(
        `✅ [AuthContext] Anonymous local DB ready (offline-safe). userIdInt=${anonymousUserId}`
      );

      // 2. Start sync worker to fetch reference data (genres, tune_types, instruments, tunes)
      // The sync worker pulls system/shared reference rows (user_ref NULL) plus user-owned rows.
      // This replaces the old direct Supabase queries for reference data.
      if (import.meta.env.VITE_DISABLE_SYNC !== "true") {
        console.log("📥 Starting sync worker for anonymous user...");
        const syncWorker = await startSyncWorkerForUser(
          db,
          anonymousUserId,
          true // isAnonymous
        );
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started for anonymous user");
        console.log(
          "⏳ [AuthContext] Anonymous sync worker started, waiting for initial sync..."
        );
        // Note: userIdInt will be set in onSyncComplete callback
      } else {
        log.warn("⚠️ Sync disabled via VITE_DISABLE_SYNC environment variable");
        // When sync is disabled, set userIdInt immediately and mark sync as complete
        setUserIdInt(anonymousUserId);
        setInitialSyncComplete(true);
        console.log(
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
      console.log(
        "🔍 [initializeLocalDatabase] Starting for user:",
        userId.substring(0, 8)
      );
      console.log("🔍 [initializeLocalDatabase] Current state:", {
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
      console.log("🔄 [initializeLocalDatabase] Reset sync state for new user");

      // Initialize user-namespaced database (handles user switching automatically)
      const db = await initializeSqliteDb(userId);
      setLocalDb(db);

      // Offline-first: if we can resolve the internal user ID from local SQLite,
      // the UI should be allowed to load immediately (even if initial syncDown
      // is deferred while offline).
      const internalId = await getUserInternalIdFromLocalDb(db, userId);
      if (internalId) {
        setUserIdInt(internalId);
        setInitialSyncComplete(true);
        console.log(
          `✅ [AuthContext] Local DB ready (offline-safe). userIdInt=${internalId}`
        );
      }
      console.log(
        "✅ [initializeLocalDatabase] Database initialized and signal set"
      );

      // Keep pending offline changes across reloads.
      // Only clear old failed outbox items to avoid long-term buildup.
      await clearOldOutboxItems(db);

      // Set up auto-persistence (store cleanup for later)
      autoPersistCleanup = setupAutoPersist();

      // Start sync worker (now uses Supabase JS client, browser-compatible)
      // The user's internal ID will be set in onSyncComplete callback after initial sync
      // This avoids querying Supabase directly for user_profile
      if (import.meta.env.VITE_DISABLE_SYNC !== "true") {
        console.log("📥 Starting sync worker for authenticated user...");
        const syncWorker = await startSyncWorkerForUser(
          db,
          userId,
          false // not anonymous
        );
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started");
        console.log(
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
          console.log(
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
          console.log(
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
            console.log(
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
        console.log("🔍 SIGNED_IN user details:", {
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
          console.log("🔄 User converted from anonymous to registered");
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
    console.log("🔐 SignIn attempt:", {
      email,
      passwordLength: password.length,
    });
    console.log("🔐 Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("🔐 SignIn result:", {
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
  const signInAnonymously = async () => {
    setLoading(true);
    console.log("🔐 Anonymous sign-in attempt (Supabase native)");

    try {
      // Check if there's a saved anonymous session to restore
      const savedSession = localStorage.getItem(ANONYMOUS_SESSION_KEY);
      console.log(
        "🔍 Checking for saved anonymous session:",
        savedSession ? "FOUND" : "NOT FOUND"
      );
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          const { refresh_token, user_id } = parsed;
          console.log(
            "🔍 Parsed saved session - user_id:",
            user_id,
            "has refresh_token:",
            !!refresh_token
          );
          if (refresh_token) {
            console.log("🔄 Restoring previous anonymous session...");
            const { data: refreshData, error: refreshError } =
              await supabase.auth.refreshSession({
                refresh_token,
              });

            console.log(
              "🔍 Refresh result - error:",
              refreshError,
              "has session:",
              !!refreshData?.session
            );
            if (!refreshError && refreshData.session) {
              // Successfully restored session - clear saved session
              localStorage.removeItem(ANONYMOUS_SESSION_KEY);
              console.log(
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
              console.log(
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

      console.log("✅ Email/password linked to anonymous account");
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
            .where(eq(userProfile.supabaseUserId, anonymousUserId));

          console.log("✅ Local user_profile updated with email:", email);
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

      console.log("✅ Account conversion complete - UUID preserved!");
      console.log("🔄 Local data with user_ref FK references remain valid");

      // Note: is_anonymous in auth.users is automatically set to false by Supabase
      // when the user is linked to an email identity

      // Sync worker should already be running (anonymous users now use sync too)
      // It will push the updated user_profile automatically
      // If for some reason it's not running, start it now
      const db = localDb();
      const currentUser = user();
      if (db && currentUser && !stopSyncWorker) {
        console.log("⏳ Starting sync with Supabase for converted user...");
        const syncWorker = await startSyncWorkerForUser(
          db,
          currentUser.id,
          false // no longer anonymous
        );
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started after anonymous conversion");
      } else if (stopSyncWorker) {
        console.log(
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

    // For anonymous users, DON'T call supabase.auth.signOut()
    // This preserves their session so they can return to the same account
    // Supabase signOut() invalidates the refresh token, making restoration impossible
    if (isAnonymous()) {
      const currentSession = session();
      console.log("🔍 Sign out (anonymous) - preserving Supabase session");
      if (currentSession?.refresh_token) {
        console.log(
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
        console.log("💾 Verified saved session:", saved ? "YES" : "NO");
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
      console.log(
        "🔍 Sign out - registered user, full sign out (preserving any saved anonymous session)"
      );

      // Stop sync worker before closing database
      if (stopSyncWorker) {
        stopSyncWorker();
        stopSyncWorker = null;
        syncServiceInstance = null;
        console.log("🛑 Stopped sync worker");
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
      console.log("🔄 [ForceSyncDown] Starting sync down from Supabase...");
      log.info("Forcing sync down from Supabase...");
      const result = opts?.full
        ? await syncServiceInstance.forceFullSyncDown()
        : await syncServiceInstance.syncDown();

      console.log(
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
        console.log(
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
      console.log(
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
      console.log(
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
      console.log(
        `🔄 [incrementCatalogListChanged] Catalog list version: ${prev} → ${newVersion}`
      );
      return newVersion;
    });
  };

  /**
   * Increment repertoire list changed counter
   * Call after writes affecting repertoire VIEWs
   * (repertoire metadata changes, playlist additions/deletions)
   */
  const incrementRepertoireListChanged = () => {
    setRepertoireListChanged((prev) => {
      const newVersion = prev + 1;
      console.log(
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

    try {
      console.log("🔄 [ForceSyncUp] Starting sync up to Supabase...");
      log.info("Forcing sync up to Supabase...");

      const result = await syncServiceInstance.syncUp(opts);

      console.log("✅ [ForceSyncUp] Sync up completed:", {
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
        console.log(
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
      console.log("⚠️ [syncPracticeScope] Skipping - browser is offline");
      return;
    }

    try {
      console.log(
        "🔄 [syncPracticeScope] Starting scoped practice syncDown..."
      );
      const tables = [
        "playlist_tune",
        "practice_record",
        "daily_practice_queue",
        "table_transient_data",
      ] as const;
      const result = await (syncServiceInstance as any).syncDownTables(tables);
      console.log(
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
          console.log("AUTH DIAG", diag);
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
