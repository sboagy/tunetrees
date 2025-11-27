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
   * Initialize local database for anonymous user (no Supabase sync initially)
   * Creates a user_profile entry in both local SQLite AND Supabase
   */
  async function initializeAnonymousDatabase(anonymousUserId: string) {
    // Prevent double initialization
    if (isInitializing || localDb()) {
      log.debug(
        "Skipping anonymous database initialization (already initialized or in progress)"
      );
      return;
    }

    isInitializing = true;
    try {
      log.info(
        "Initializing local database for anonymous user",
        anonymousUserId
      );

      const db = await initializeSqliteDb();
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

      // 2. Also create user_profile in Supabase (for future sync when they convert)
      try {
        const { data: existingProfile, error: fetchError } = await supabase
          .from("user_profile")
          .select("id")
          .eq("supabase_user_id", anonymousUserId)
          .maybeSingle();

        if (fetchError) {
          log.warn(
            "Error checking user_profile for anonymous user:",
            fetchError
          );
        }

        if (!existingProfile) {
          const { error: insertError } = await supabase
            .from("user_profile")
            .insert({
              id: anonymousUserId,
              supabase_user_id: anonymousUserId,
              email: null,
              name: "Anonymous User",
              sr_alg_type: "fsrs",
            });

          if (insertError) {
            if (!insertError.message?.includes("duplicate key")) {
              log.warn(
                "Failed to create Supabase user_profile for anonymous user:",
                insertError
              );
            }
          } else {
            console.log(
              "✅ Created Supabase user_profile for anonymous user:",
              anonymousUserId
            );
          }
        }
      } catch (profileError) {
        // Non-fatal - Supabase profile can be created later during conversion
        log.warn(
          "Error managing Supabase user_profile for anonymous user:",
          profileError
        );
      }

      // Set anonymous user ID (this is their Supabase UUID)
      setUserIdInt(anonymousUserId);
      setIsAnonymous(true);

      // 3. Sync reference data (genres, tune types, instruments) from Supabase
      // Anonymous users need this data for dropdowns, but not user-specific data
      try {
        console.log("📥 Syncing reference data for anonymous user...");
        await syncReferenceDataForAnonymous(db);
        console.log("✅ Reference data synced for anonymous user");
      } catch (refError) {
        // Non-fatal - user can still use app, just with empty dropdowns
        log.warn("Failed to sync reference data for anonymous user:", refError);
      }

      // Mark sync as complete immediately (no full remote sync for anonymous users)
      setInitialSyncComplete(true);
      console.log("✅ [AuthContext] Anonymous mode - local database ready");

      log.info("Anonymous local database ready");
    } catch (error) {
      log.error("Failed to initialize anonymous local database:", error);
    } finally {
      isInitializing = false;
    }
  }

  /**
   * Sync reference data (genres, tune types, instruments) from Supabase
   * This is needed for anonymous users to have dropdown options
   */
  async function syncReferenceDataForAnonymous(db: SqliteDatabase) {
    const { genre, tuneType, instrument, genreTuneType } = await import(
      "@/lib/db/schema"
    );

    // Sync genres
    const { data: genres, error: genreError } = await supabase
      .from("genre")
      .select("*");

    if (genreError) {
      log.warn("Failed to fetch genres:", genreError);
    } else if (genres && genres.length > 0) {
      for (const g of genres) {
        await db
          .insert(genre)
          .values({
            id: g.id,
            name: g.name,
            region: g.region,
            description: g.description,
          })
          .onConflictDoNothing();
      }
      console.log(`📥 Synced ${genres.length} genres`);
    }

    // Sync tune types
    const { data: tuneTypes, error: tuneTypeError } = await supabase
      .from("tune_type")
      .select("*");

    if (tuneTypeError) {
      log.warn("Failed to fetch tune types:", tuneTypeError);
    } else if (tuneTypes && tuneTypes.length > 0) {
      for (const tt of tuneTypes) {
        await db
          .insert(tuneType)
          .values({
            id: tt.id,
            name: tt.name,
            rhythm: tt.rhythm,
            description: tt.description,
          })
          .onConflictDoNothing();
      }
      console.log(`📥 Synced ${tuneTypes.length} tune types`);
    }

    // Sync instruments (public instruments only - where private_to_user is null)
    const { data: instruments, error: instrumentError } = await supabase
      .from("instrument")
      .select("*")
      .is("private_to_user", null);

    if (instrumentError) {
      log.warn("Failed to fetch instruments:", instrumentError);
    } else if (instruments && instruments.length > 0) {
      const now = new Date().toISOString();
      for (const inst of instruments) {
        await db
          .insert(instrument)
          .values({
            id: inst.id,
            privateToUser: null,
            instrument: inst.instrument,
            description: inst.description,
            genreDefault: inst.genre_default,
            deleted: inst.deleted ? 1 : 0,
            syncVersion: inst.sync_version || 1,
            lastModifiedAt: inst.last_modified_at || now,
            deviceId: inst.device_id,
          })
          .onConflictDoNothing();
      }
      console.log(`📥 Synced ${instruments.length} instruments`);
    }

    // Sync genre-tune-type mappings
    const { data: gttMappings, error: gttError } = await supabase
      .from("genre_tune_type")
      .select("*");

    if (gttError) {
      log.warn("Failed to fetch genre_tune_type mappings:", gttError);
    } else if (gttMappings && gttMappings.length > 0) {
      for (const gtt of gttMappings) {
        await db
          .insert(genreTuneType)
          .values({
            genreId: gtt.genre_id,
            tuneTypeId: gtt.tune_type_id,
          })
          .onConflictDoNothing();
      }
      console.log(`📥 Synced ${gttMappings.length} genre-tune-type mappings`);
    }
  }

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
      console.log("🔍 Checking for saved anonymous session:", savedSession ? "FOUND" : "NOT FOUND");
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          const { refresh_token, user_id } = parsed;
          console.log("🔍 Parsed saved session - user_id:", user_id, "has refresh_token:", !!refresh_token);
          if (refresh_token) {
            console.log("🔄 Restoring previous anonymous session...");
            const { data: refreshData, error: refreshError } =
              await supabase.auth.refreshSession({
                refresh_token,
              });

            console.log("🔍 Refresh result - error:", refreshError, "has session:", !!refreshData?.session);
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

      const anonymousUserId = userIdInt();
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

      // Update user_profile with the new email and name
      try {
        const { error: profileUpdateError } = await supabase
          .from("user_profile")
          .update({
            email,
            name,
          })
          .eq("supabase_user_id", anonymousUserId);

        if (profileUpdateError) {
          log.warn(
            "Failed to update user_profile during conversion:",
            profileUpdateError
          );
        } else {
          console.log("✅ user_profile updated with email:", email);
        }
      } catch (profileError) {
        // Non-fatal - the account is still converted
        log.warn(
          "Error updating user_profile during conversion:",
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

      // If sync was not running (anonymous mode), start it now
      const db = localDb();
      const currentUser = user();
      if (db && currentUser && !stopSyncWorker) {
        console.log("⏳ Starting sync with Supabase for converted user...");
        const syncWorker = startSyncWorker(db, {
          supabase,
          userId: currentUser.id,
          realtimeEnabled: import.meta.env.VITE_REALTIME_ENABLED === "true",
          syncIntervalMs: 5000,
          onSyncComplete: (result) => {
            log.debug(
              "Sync completed, incrementing remote sync down completion version"
            );
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
              setInitialSyncComplete(true);
              console.log(
                "✅ [AuthContext] Initial sync complete after conversion"
              );
            }
          },
        });
        stopSyncWorker = syncWorker.stop;
        syncServiceInstance = syncWorker.service;
        log.info("Sync worker started after anonymous conversion");
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
        console.log("💾 Saving anonymous session for later restoration, user:", currentSession.user?.id);
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
      
      // Clear local state but DON'T call supabase.auth.signOut()
      // This keeps the session valid for restoration
      await clearLocalDatabase();
    } else {
      // For registered users, do a full sign out and clear any saved anonymous session
      console.log("🔍 Sign out - registered user, full sign out");
      localStorage.removeItem(ANONYMOUS_SESSION_KEY);
      await supabase.auth.signOut();
      await clearLocalDatabase();
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
