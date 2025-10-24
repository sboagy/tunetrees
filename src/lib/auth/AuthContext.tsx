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
  /** Current authenticated user's integer user_profile.id (reactive) */
  userIdInt: Accessor<number | null>;

  /** Current session (reactive) */
  session: Accessor<Session | null>;

  /** Loading state during initialization */
  loading: Accessor<boolean>;

  /** Local SQLite database instance (null if not initialized) */
  localDb: Accessor<SqliteDatabase | null>;

  /** Sync version - increments when sync completes (triggers UI updates) */
  syncVersion: Accessor<number>;

  /** Increment sync version to trigger UI refresh */
  incrementSyncVersion: () => void;

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

  /** Force sync down from Supabase (manual sync) */
  forceSyncDown: () => Promise<void>;

  /** Force sync up to Supabase (push local changes immediately) */
  forceSyncUp: () => Promise<void>;
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
  const [userIdInt, setUserIdInt] = createSignal<number | null>(null);
  const [session, setSession] = createSignal<Session | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [localDb, setLocalDb] = createSignal<SqliteDatabase | null>(null);
  const [syncVersion, setSyncVersion] = createSignal(0);

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

      // Get user's integer ID from user_profile table (user_ref columns use integer IDs)
      const { data: userProfile, error } = await supabase
        .from("user_profile")
        .select("id")
        .eq("supabase_user_id", userId)
        .single();

      if (error || !userProfile) {
        log.error("Failed to get user profile:", error);
        throw new Error("User profile not found in database");
      }

      const userIntId = userProfile.id;
      setUserIdInt(userIntId);
      log.debug("User integer ID:", userIntId, "UUID:", userId);

      // Start sync worker (now uses Supabase JS client, browser-compatible)
      // Realtime is disabled by default to reduce console noise during development
      // Set VITE_REALTIME_ENABLED=true in .env.local to enable live sync
      // Set VITE_DISABLE_SYNC=true to completely disable sync (useful for testing seed data)
      if (import.meta.env.VITE_DISABLE_SYNC !== "true") {
        const syncWorker = startSyncWorker(db, {
          supabase,
          userId: userIntId,
          realtimeEnabled: import.meta.env.VITE_REALTIME_ENABLED === "true",
          syncIntervalMs: 5000, // Sync every 5 seconds (fast upload of local changes)
          onSyncComplete: () => {
            log.debug("Sync completed, incrementing sync version");
            setSyncVersion((prev) => {
              const newVersion = prev + 1;
              log.debug("Sync version changed:", prev, "->", newVersion);
              return newVersion;
            });
          },
        });
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started");

        // Perform initial sync down to populate local database with user's data
        log.info("Performing initial syncDown on login...");
        try {
          const result = await syncWorker.service.syncDown();
          log.info("Initial syncDown completed:", result);
          // Increment sync version to trigger UI updates
          setSyncVersion((prev) => {
            const newVersion = prev + 1;
            log.debug(
              "Sync version changed after initial sync:",
              prev,
              "->",
              newVersion
            );
            return newVersion;
          });
        } catch (error) {
          log.error("Initial syncDown failed:", error);
        }
      } else {
        log.warn("⚠️ Sync disabled via VITE_DISABLE_SYNC environment variable");
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    return { error };
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
    setLoading(false);
  };

  /**
   * Force sync down from Supabase (manual sync)
   */
  const forceSyncDown = async () => {
    if (!syncServiceInstance) {
      console.warn("⚠️ [ForceSyncDown] Sync service not available");
      log.warn("Sync service not available");
      return;
    }

    try {
      console.log("🔄 [ForceSyncDown] Starting sync down from Supabase...");
      log.info("Forcing sync down from Supabase...");

      const result = await syncServiceInstance.syncDown();

      console.log("✅ [ForceSyncDown] Sync down completed:", {
        success: result.success,
        itemsSynced: result.itemsSynced,
        itemsFailed: result.itemsFailed,
        conflicts: result.conflicts,
        errors: result.errors,
      });
      log.info("Force sync down completed:", result);

      // Increment sync version to trigger UI updates
      setSyncVersion((prev) => {
        const newVersion = prev + 1;
        console.log(
          `🔄 [ForceSyncDown] Sync version updated: ${prev} → ${newVersion}`
        );
        log.debug(
          "Sync version changed after force sync:",
          prev,
          "->",
          newVersion
        );
        return newVersion;
      });
    } catch (error) {
      console.error("❌ [ForceSyncDown] Sync down failed:", error);
      log.error("Force sync down failed:", error);
      throw error;
    }
  };

  /**
   * Increment sync version to trigger UI refresh
   * Call this after local database mutations (staging, deletions, etc.)
   * to force grids and queries to refetch data
   */
  const incrementSyncVersion = () => {
    setSyncVersion((prev) => {
      const newVersion = prev + 1;
      console.log(
        `🔄 [incrementSyncVersion] Sync version updated: ${prev} → ${newVersion}`
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

      // Increment sync version to trigger UI updates
      setSyncVersion((prev) => {
        const newVersion = prev + 1;
        console.log(
          `🔄 [ForceSyncUp] Sync version updated: ${prev} → ${newVersion}`
        );
        log.debug(
          "Sync version changed after force sync:",
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

  const authState: AuthState = {
    user,
    userIdInt,
    session,
    loading,
    localDb,
    syncVersion,
    incrementSyncVersion,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    forceSyncDown,
    forceSyncUp,
  };

  return (
    <AuthContext.Provider value={authState}>
      {props.children}
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
