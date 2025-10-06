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

// import { startSyncWorker } from "../sync"; // TODO: Re-enable when RLS policies are configured

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

  // Sync worker cleanup function
  let stopSyncWorker: (() => void) | null = null;
  let autoPersistCleanup: (() => void) | null = null;

  /**
   * Initialize local database for authenticated user
   */
  async function initializeLocalDatabase(userId: string) {
    try {
      console.log(`🔧 Initializing local database for user ${userId}...`);

      const db = await initializeSqliteDb(userId);
      setLocalDb(db);

      // Set up auto-persistence (store cleanup for later)
      autoPersistCleanup = setupAutoPersist();

      // TODO: Start sync worker once RLS policies are configured in Supabase
      // Currently disabled to prevent RLS policy violation errors
      // stopSyncWorker = startSyncWorker(db, supabase, 30000);
      console.log("⚠️  Sync worker disabled (RLS policies not configured)");

      console.log("✅ Local database ready");
    } catch (error) {
      console.error("❌ Failed to initialize local database:", error);
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
  createEffect(async () => {
    const {
      data: { session: existingSession },
    } = await supabase.auth.getSession();

    setSession(existingSession);
    setUser(existingSession?.user ?? null);

    if (existingSession?.user) {
      await initializeLocalDatabase(existingSession.user.id);
    }

    setLoading(false);
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

      if (event === "SIGNED_IN" && newSession?.user) {
        await initializeLocalDatabase(newSession.user.id);
      } else if (event === "SIGNED_OUT") {
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
