/**
 * Authentication Context for TuneTrees
 *
 * Provides SolidJS reactive auth state and methods using Supabase Auth.
 * Handles user session management and local database initialization.
 *
 * @module auth/AuthContext
 */

import type { AuthError, Session, User } from "@supabase/supabase-js";
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
  initializeDb as initializeSqliteDb,
  type SqliteDatabase,
  setupAutoPersist,
} from "../db/client-sqlite";
import { log } from "../logger";
import { supabase } from "../supabase/client";

import { type SyncService, startSyncWorker } from "../sync";

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

  /** Sign out and clear local data */
  signOut: () => Promise<void>;

  /** Force sync down from Supabase (manual sync). Pass { full: true } to force a full (non-incremental) sync. */
  forceSyncDown: (opts?: { full?: boolean }) => Promise<void>;

  /** Force sync up to Supabase (push local changes immediately) */
  forceSyncUp: () => Promise<void>;
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
export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [userIdInt, setUserIdInt] = createSignal<string | null>(null);
  const [session, setSession] = createSignal<Session | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [localDb, setLocalDb] = createSignal<SqliteDatabase | null>(null);
  const [remoteSyncDownCompletionVersion, setRemoteSyncDownCompletionVersion] =
    createSignal(0);
  const [initialSyncComplete, setInitialSyncComplete] = createSignal(false);
  // Track last successful syncDown timestamp (used for displaying sync recency)
  const [lastSyncTimestamp, setLastSyncTimestamp] = createSignal<string | null>(
    null
  );
  const [lastSyncMode, setLastSyncMode] = createSignal<
    "full" | "incremental" | null
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

  /**
   * Initialize local database for authenticated user
   */
  async function initializeLocalDatabase(userId: string) {
    // Prevent double initialization
    if (isInitializing || localDb()) {
      log.debug(
        "Skipping database initialization (already initialized or in progress)"
      );
      return;
    }

    isInitializing = true;
    try {
      log.info("Initializing local database for user", userId);

      const db = await initializeSqliteDb();
      setLocalDb(db);

      // Set up auto-persistence (store cleanup for later)
      autoPersistCleanup = setupAutoPersist();

      // Get user's UUID from user_profile table (user_ref columns now use UUID)
      const { data: userProfile, error } = await supabase
        .from("user_profile")
        .select("id, supabase_user_id")
        .eq("supabase_user_id", userId)
        .single();

      if (error || !userProfile) {
        log.error("Failed to get user profile:", error);
        throw new Error("User profile not found in database");
      }

      const userInternalId = userProfile.id; // Internal UUID (PK in Postgres)
      const userUuid = userProfile.supabase_user_id; // Auth UUID
      setUserIdInt(userInternalId); // Use internal ID for FK relationships
      log.debug("User internal ID:", userInternalId, "Auth UUID:", userUuid);

      // Start sync worker (now uses Supabase JS client, browser-compatible)
      // Realtime is disabled by default to reduce console noise during development
      // Set VITE_REALTIME_ENABLED=true in .env.local to enable live sync
      // Set VITE_DISABLE_SYNC=true to completely disable sync (useful for testing seed data)
      if (import.meta.env.VITE_DISABLE_SYNC !== "true") {
        const syncWorker = startSyncWorker(db, {
          supabase,
          userId: userUuid,
          realtimeEnabled: import.meta.env.VITE_REALTIME_ENABLED === "true",
          syncIntervalMs: 5000, // Sync every 5 seconds (fast upload of local changes)
          onSyncComplete: (result) => {
            log.debug(
              "Sync completed, incrementing remote sync down completion version"
            );
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
            // Update last syncDown timestamp (only changes when syncDown runs; getter returns last syncDown)
            if (syncServiceInstance) {
              const ts = syncServiceInstance.getLastSyncDownTimestamp();
              if (ts) setLastSyncTimestamp(ts);
              const mode = syncServiceInstance.getLastSyncMode();
              if (mode) setLastSyncMode(mode);
            } else if (result?.timestamp) {
              // Fallback if service not available yet
              setLastSyncTimestamp(result.timestamp);
              // Mode unknown in fallback; leave as null
            }
            // Mark initial sync as complete on first sync
            if (!initialSyncComplete()) {
              setInitialSyncComplete(true);
              console.log(
                "✅ [AuthContext] Initial sync complete, UI can now load data"
              );
            }
          },
        });
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started");

        // Note: syncWorker automatically runs initial syncDown on startup
        // We rely on onSyncComplete callback above to mark sync as complete
        console.log("⏳ [AuthContext] Waiting for initial sync to complete...");
      } else {
        log.warn("⚠️ Sync disabled via VITE_DISABLE_SYNC environment variable");
        // When sync is disabled, mark as complete immediately
        setInitialSyncComplete(true);
      }

      log.info("Local database ready");
    } catch (error) {
      log.error("Failed to initialize local database:", error);
    } finally {
      isInitializing = false;
    }
  }

  /**
   * Clear local database on logout
   */
  async function clearLocalDatabase() {
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

  /**
   * Check for existing session on mount
   */
  createEffect(() => {
    // Wrap async logic inside effect (SolidJS effects can't be async)
    void (async () => {
      try {
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();

        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          // Initialize database in background (don't block loading state)
          void initializeLocalDatabase(existingSession.user.id);
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

      // Initialize database on sign in (in background, don't block)
      if (event === "SIGNED_IN" && newSession?.user) {
        void initializeLocalDatabase(newSession.user.id);
      }

      // Clear database on sign out
      if (event === "SIGNED_OUT") {
        await clearLocalDatabase();
      }
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
   * Sign out and clear local data
   */
  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    await clearLocalDatabase();
    setUserIdInt(null);
    setInitialSyncComplete(false); // Reset sync status on logout
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
  const forceSyncUp = async () => {
    if (!syncServiceInstance) {
      console.warn("⚠️ [ForceSyncUp] Sync service not available");
      log.warn("Sync service not available");
      return;
    }

    try {
      console.log("🔄 [ForceSyncUp] Starting sync up to Supabase...");
      log.info("Forcing sync up to Supabase...");

      const result = await syncServiceInstance.syncUp();

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
