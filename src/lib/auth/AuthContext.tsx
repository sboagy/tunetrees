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
import { supabase } from "../supabase/client";

import { startSyncWorker } from "../sync";

/**
 * Authentication state interface
 */
interface AuthState {
  /** Current authenticated user (reactive) */
  user: Accessor<User | null>;

  /** Current session (reactive) */
  session: Accessor<Session | null>;

  /** Loading state during initialization */
  loading: Accessor<boolean>;

  /** Local SQLite database instance (null if not initialized) */
  localDb: Accessor<SqliteDatabase | null>;

  /** Sync version - increments when sync completes (triggers UI updates) */
  syncVersion: Accessor<number>;

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
  const [session, setSession] = createSignal<Session | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [localDb, setLocalDb] = createSignal<SqliteDatabase | null>(null);
  const [syncVersion, setSyncVersion] = createSignal(0);

  // Sync worker cleanup function
  let stopSyncWorker: (() => void) | null = null;
  let autoPersistCleanup: (() => void) | null = null;

  // Track if database is being initialized to prevent double initialization
  let isInitializing = false;

  /**
   * Initialize local database for authenticated user
   */
  async function initializeLocalDatabase(userId: string) {
    // Prevent double initialization
    if (isInitializing || localDb()) {
      console.log(
        "⏭️  Skipping database initialization (already initialized or in progress)"
      );
      return;
    }

    isInitializing = true;
    try {
      console.log(`🔧 Initializing local database for user ${userId}...`);

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
        console.error("❌ Failed to get user profile:", error);
        throw new Error("User profile not found in database");
      }

      const userIntId = userProfile.id;
      console.log(`👤 User integer ID: ${userIntId} (UUID: ${userId})`);

      // Start sync worker (now uses Supabase JS client, browser-compatible)
      // Realtime is disabled by default to reduce console noise during development
      // Set VITE_REALTIME_ENABLED=true in .env.local to enable live sync
      const syncWorker = startSyncWorker(db, {
        supabase,
        userId: userIntId,
        realtimeEnabled: import.meta.env.VITE_REALTIME_ENABLED === "true",
        syncIntervalMs: 30000, // Sync every 30 seconds
        onSyncComplete: () => {
          console.log("🔄 Sync completed, incrementing sync version");
          setSyncVersion((prev) => {
            const newVersion = prev + 1;
            console.log(`🔄 Sync version changed: ${prev} -> ${newVersion}`);
            return newVersion;
          });
        },
      });
      stopSyncWorker = syncWorker.stop;
      console.log("🔄 Sync worker started");

      console.log("✅ Local database ready");
    } catch (error) {
      console.error("❌ Failed to initialize local database:", error);
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
        console.log("⏹️  Sync worker stopped");
      }

      await clearSqliteDb();
      setLocalDb(null);
      console.log("🗑️  Local database cleared");
    } catch (error) {
      console.error("❌ Failed to clear local database:", error);
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
          await initializeLocalDatabase(existingSession.user.id);
        }
      } catch (error) {
        console.error("❌ Error during session initialization:", error);
      } finally {
        // Always set loading to false, even if initialization fails
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
      console.log("🔐 Auth state changed:", event);

      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Only clear database on sign out
      // Database initialization happens in the session check effect above
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
    setLoading(false);
  };

  const authState: AuthState = {
    user,
    session,
    loading,
    localDb,
    syncVersion,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
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
