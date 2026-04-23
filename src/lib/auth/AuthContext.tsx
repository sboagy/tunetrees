/**
 * Authentication Context for TuneTrees
 *
 * Provides SolidJS reactive auth state and methods using Supabase Auth.
 * Handles user session management and local database initialization.
 *
 * @module auth/AuthContext
 */

import type { AuthError, Session, User } from "@supabase/supabase-js";
import { type Accessor, useContext } from "solid-js";
import type { SqliteDatabase } from "../db/client-sqlite";
import { TTAuthContext, TTAuthProvider } from "./TTAuthProvider";

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

/**
 * AuthProvider is now backed by TTAuthProvider from TTAuthProvider.tsx.
 * All consumers keep importing from this file unchanged.
 */
export const AuthProvider = TTAuthProvider;

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
  // Reads from TTAuthContext (provided by TTAuthProvider) rather than the old local AuthContext.
  const context = useContext(TTAuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context as AuthState;
}
