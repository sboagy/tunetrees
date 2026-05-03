/**
 * Top Navigation Bar
 *
 * Displays app branding, user information, and logout button.
 * Matches legacy: legacy/frontend/components/TopNav.tsx
 *
 * @module components/layout/TopNav
 */

import { useLocation } from "@solidjs/router";
import {
  Bug,
  Check,
  ChevronDown,
  Database,
  Download,
  FileText,
  Home,
  Info,
  LogOut,
  MessageCircle,
  Settings,
  Shield,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { useGroupsDialog } from "@/contexts/GroupsDialogContext";
import { useUserSettingsDialog } from "@/contexts/UserSettingsDialogContext";
import { getOutboxStats } from "@/lib/sync";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentRepertoire } from "../../lib/context/CurrentRepertoireContext";
import { getSqliteInstance } from "../../lib/db/client-sqlite";
import { getUserRepertoires } from "../../lib/db/queries/repertoires";
import type { RepertoireWithSummary } from "../../lib/db/types";
import { useClickOutside } from "../../lib/hooks/useClickOutside";
import { log } from "../../lib/logger";
import {
  getSelectedRepertoireId,
  setSelectedRepertoireId,
} from "../../lib/services/repertoire-service";
import { RepertoireManagerDialog } from "../repertoires/RepertoireManagerDialog";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { AboutDialog } from "./AboutDialog";
import { ThemeSwitcher } from "./ThemeSwitcher";

// Helper: format relative time (e.g., 2m, 3h, 5d)
function formatRelativeTime(isoTs: string): string {
  const then = new Date(isoTs).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo`;
  const year = Math.floor(month / 12);
  return `${year}y`;
}

// Helper function to get display name for a repertoire
const getRepertoireDisplayName = (
  repertoire: RepertoireWithSummary
): string => {
  // If name exists and is not empty, use it
  if (repertoire.name?.trim()) {
    return repertoire.name.trim();
  }

  // Otherwise just use instrument name
  const instrument = repertoire.instrumentName || "Unknown Instrument";
  return instrument;
};

type TopNavDbSnapshot = {
  phase: "before" | "after" | "afterError";
  user: string;
  version: string;
  at: string;
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

type SqliteInstance = import("sql.js").Database;

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize?: unknown;
    totalJSHeapSize?: unknown;
    jsHeapSizeLimit?: unknown;
  };
};

const appendTopNavSnapshotError = (
  errors: string[],
  prefix: string,
  error: unknown
) => {
  errors.push(
    `${prefix}: ${error instanceof Error ? error.message : String(error)}`
  );
};

const captureTopNavJsHeap = (snapshot: TopNavDbSnapshot, errors: string[]) => {
  try {
    const perfMemory = (performance as PerformanceWithMemory).memory;
    if (!perfMemory) return;

    snapshot.jsHeap = {
      usedBytes: Number(perfMemory.usedJSHeapSize ?? 0),
      totalBytes: Number(perfMemory.totalJSHeapSize ?? 0),
      limitBytes: Number(perfMemory.jsHeapSizeLimit ?? 0),
    };
  } catch (error) {
    appendTopNavSnapshotError(errors, "jsHeap", error);
  }
};

const captureTopNavWasmHeap = async (
  snapshot: TopNavDbSnapshot,
  errors: string[]
) => {
  try {
    const { getSqlJsDebugInfo } = await import("../../lib/db/client-sqlite");
    const dbg = getSqlJsDebugInfo();
    if (dbg.wasmHeapBytes) snapshot.wasmHeapBytes = dbg.wasmHeapBytes;
  } catch (error) {
    appendTopNavSnapshotError(errors, "wasmHeap", error);
  }
};

const captureTopNavPragmas = (
  sqliteDb: SqliteInstance,
  snapshot: TopNavDbSnapshot,
  errors: string[]
) => {
  try {
    const pageSizeRes = sqliteDb.exec("PRAGMA page_size;");
    const pageCountRes = sqliteDb.exec("PRAGMA page_count;");
    const freelistRes = sqliteDb.exec("PRAGMA freelist_count;");

    const pageSize = Number(pageSizeRes?.[0]?.values?.[0]?.[0] ?? 0);
    const pageCount = Number(pageCountRes?.[0]?.values?.[0]?.[0] ?? 0);
    const freelistCount = Number(freelistRes?.[0]?.values?.[0]?.[0] ?? 0);

    if (pageSize > 0) snapshot.pageSize = pageSize;
    if (pageCount > 0) snapshot.pageCount = pageCount;
    snapshot.freelistCount = freelistCount;
    if (pageSize > 0 && pageCount > 0) {
      snapshot.dbApproxBytes = pageSize * pageCount;
    }
  } catch (error) {
    appendTopNavSnapshotError(errors, "pragma", error);
  }
};

const captureTopNavTableCounts = (
  sqliteDb: SqliteInstance,
  snapshot: TopNavDbSnapshot,
  errors: string[]
) => {
  try {
    const master = sqliteDb.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    const names: string[] = (master?.[0]?.values ?? []).map((row) =>
      String((row as [unknown])[0])
    );

    const counts: Record<string, number> = {};
    for (const name of names) {
      try {
        const res = sqliteDb.exec(
          `SELECT COUNT(*) as c FROM "${name.replaceAll('"', '""')}";`
        );
        counts[name] = Number(res?.[0]?.values?.[0]?.[0] ?? 0);
      } catch (error) {
        counts[name] = -1;
        appendTopNavSnapshotError(errors, `count:${name}`, error);
      }
    }
    snapshot.tableCounts = counts;
  } catch (error) {
    appendTopNavSnapshotError(errors, "sqlite_master", error);
  }
};

const captureTopNavSqliteSnapshot = async (
  snapshot: TopNavDbSnapshot,
  errors: string[]
) => {
  try {
    const sqliteDb = await getSqliteInstance();
    snapshot.hasSqliteInstance = !!sqliteDb;
    if (!sqliteDb) {
      errors.push(
        "sqliteInstance: null (db not initialized yet or init failed)"
      );
      return;
    }

    await captureTopNavWasmHeap(snapshot, errors);
    captureTopNavPragmas(sqliteDb, snapshot, errors);
    captureTopNavTableCounts(sqliteDb, snapshot, errors);
  } catch (error) {
    appendTopNavSnapshotError(errors, "sqlite", error);
  }
};

const emitTopNavSnapshot = (snapshot: TopNavDbSnapshot) => {
  try {
    const header = {
      phase: snapshot.phase,
      user: snapshot.user,
      version: snapshot.version,
      at: snapshot.at,
      hasSqliteInstance: snapshot.hasSqliteInstance,
      jsHeap: snapshot.jsHeap,
      wasmHeapBytes: snapshot.wasmHeapBytes,
      pageSize: snapshot.pageSize,
      pageCount: snapshot.pageCount,
      freelistCount: snapshot.freelistCount,
      dbApproxBytes: snapshot.dbApproxBytes,
      errors: snapshot.errors,
    };
    console.log(`[TopNavDiag] ${JSON.stringify(header)}`);

    if (snapshot.tableCounts) {
      console.log(
        `[TopNavDiag] tables user=${snapshot.user} ${JSON.stringify(snapshot.tableCounts)}`
      );
    }
  } catch (error) {
    console.log(
      `[TopNavDiag] failed to emit snapshot: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Top Navigation Component
 *
 * Features:
 * - App logo and branding
 * - Repertoire selector dropdown
 * - User menu dropdown
 * - Theme switcher
 * - Network/sync status indicator
 * - Responsive design
 */

/**
 * Logo Dropdown Component
 *
 * Dropdown menu for app-level navigation and information
 */
const LogoDropdown: Component<{
  onOpenAbout: () => void;
}> = (props) => {
  const [showDropdown, setShowDropdown] = createSignal(false);
  let dropdownContainerRef: HTMLDivElement | undefined;

  // Close dropdown when clicking outside
  useClickOutside(
    () => dropdownContainerRef,
    () => {
      if (showDropdown()) {
        setShowDropdown(false);
      }
    }
  );

  const handleAboutClick = () => {
    setShowDropdown(false);
    props.onOpenAbout();
  };

  return (
    <div
      class="relative"
      data-testid="logo-dropdown"
      ref={dropdownContainerRef}
    >
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown())}
        class="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="App menu"
        aria-expanded={showDropdown()}
        data-testid="logo-dropdown-button"
      >
        <img
          src="/logo4.png"
          alt="TuneTrees Logo"
          width="48"
          height="48"
          class="h-12 w-12 object-contain"
        />
        <span class="hidden sm:inline ml-[0ch] text-lg dark:text-blue-400">
          TuneTrees
        </span>
        <ChevronDown
          class="w-4 h-4 transition-transform"
          classList={{ "rotate-180": showDropdown() }}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      <Show when={showDropdown()}>
        <div class="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div class="py-2" data-testid="logo-dropdown-panel">
            {/* Home */}
            <a
              href="/"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={() => setShowDropdown(false)}
            >
              <Home class="w-4 h-4" aria-hidden="true" />
              Home
            </a>

            {/* Divider */}
            <div class="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* About TuneTrees */}
            <button
              type="button"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={handleAboutClick}
              data-testid="logo-dropdown-about-button"
            >
              <Info class="w-4 h-4" aria-hidden="true" />
              About TuneTrees...
            </button>

            {/* What's New */}
            <a
              href="https://github.com/sboagy/tunetrees/releases"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={() => setShowDropdown(false)}
              data-testid="logo-dropdown-whats-new-link"
            >
              <Tag class="w-4 h-4" aria-hidden="true" />
              What's New
            </a>

            {/* Divider */}
            <div class="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* Privacy Policy */}
            <a
              href="/privacy"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={() => setShowDropdown(false)}
              data-testid="logo-dropdown-privacy-link"
            >
              <Shield class="w-4 h-4" aria-hidden="true" />
              Privacy Policy
            </a>

            {/* Terms of Service */}
            <a
              href="/terms"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={() => setShowDropdown(false)}
              data-testid="logo-dropdown-terms-link"
            >
              <FileText class="w-4 h-4" aria-hidden="true" />
              Terms of Service
            </a>
          </div>
        </div>
      </Show>
    </div>
  );
};

/**
 * Repertoire Dropdown Component
 *
 * Dropdown for selecting active repertoire with "Manage Repertoires..." option
 */
const RepertoireDropdown: Component<{
  onOpenRepertoireManager: () => void;
}> = (props) => {
  const { user, localDb, repertoireListChanged } = useAuth();
  const { currentRepertoireId, setCurrentRepertoireId } =
    useCurrentRepertoire();
  const [showDropdown, setShowDropdown] = createSignal(false);
  let dropdownContainerRef: HTMLDivElement | undefined;

  const shouldTopNavDiag = import.meta.env.VITE_SYNC_DIAGNOSTICS === "true";

  // Close dropdown when clicking outside
  useClickOutside(
    () => dropdownContainerRef,
    () => {
      if (showDropdown()) {
        setShowDropdown(false);
      }
    }
  );

  // Fetch user repertoires
  // Fetch immediately if data exists in SQLite, don't wait for sync
  // repertoireListChanged is tracked as a dependency to trigger refetch after repertoire changes
  let lastTopNavDiagKey: string | null = null;
  const [repertoires] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = `${repertoireListChanged()}`; // Triggers refetch when repertoires change

      if (shouldTopNavDiag) {
        console.log("🔍 [TopNav] Repertoires dependency check:", {
          hasDb: !!db,
          userId,
          userObject: user(),
          repertoireListChanged: version,
          shouldFetch: !!(db && userId),
        });
        log.debug("TOPNAV repertoires dependency:", {
          hasDb: !!db,
          userId,
          repertoireListChanged: version,
        });
      }

      // Fetch if database and user are ready
      // Don't wait for sync - repertoires exist in local DB
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      if (shouldTopNavDiag) {
        console.log("📋 [TopNav] Fetching repertoires with params:", params);
        log.debug("TOPNAV repertoires fetcher:", {
          hasParams: !!params,
          repertoireListChanged: params?.version,
        });
      }
      if (!params) return [];

      const shouldTopNavDump = shouldTopNavDiag;

      const userShort = params.userId.slice(0, 8);
      const diagKey = `${params.userId}:${params.version}`;

      const collectTopNavDbSnapshot = async (
        phase: TopNavDbSnapshot["phase"],
        opts?: { always?: boolean; error?: unknown }
      ): Promise<TopNavDbSnapshot | null> => {
        if (!shouldTopNavDump) return null;
        if (!opts?.always && lastTopNavDiagKey === diagKey) return null;

        const snapshot: TopNavDbSnapshot = {
          phase,
          user: userShort,
          version: params.version,
          at: new Date().toISOString(),
        };

        const errors: string[] = [];
        captureTopNavJsHeap(snapshot, errors);
        await captureTopNavSqliteSnapshot(snapshot, errors);

        if (opts?.error) {
          appendTopNavSnapshotError(errors, "error", opts.error);
        }

        if (errors.length > 0) snapshot.errors = errors;

        emitTopNavSnapshot(snapshot);

        lastTopNavDiagKey = diagKey;
        return snapshot;
      };

      try {
        if (shouldTopNavDump) {
          await collectTopNavDbSnapshot("before");
        }

        if (shouldTopNavDiag) {
          console.log(
            "🔄 [TopNav] Calling getUserRepertoires with userId:",
            params.userId
          );
        }
        const result = await getUserRepertoires(params.db, params.userId);

        if (shouldTopNavDiag) {
          console.log("✅ [TopNav] Got repertoires:", result.length, result);
        }
        if (shouldTopNavDump) {
          await collectTopNavDbSnapshot("after");
        }
        if (shouldTopNavDiag) {
          log.debug("TOPNAV repertoires result:", result.length, "repertoires");
        }
        return result;
      } catch (error) {
        if (shouldTopNavDump) {
          await collectTopNavDbSnapshot("afterError", { always: true, error });
        }
        console.error("❌ [TopNav] Repertoire fetch error:", error);
        log.error("TOPNAV repertoires fetch error:", error);
        return [];
      }
    }
  );

  // Additional debug effect to track repertoires changes
  createEffect(() => {
    const repertoiresList = repertoires();
    const loading = repertoires.loading;
    log.debug("TOPNAV repertoires changed:", {
      loading,
      count: repertoiresList?.length || 0,
      repertoires:
        repertoiresList?.map((p) => ({ id: p.repertoireId, name: p.name })) ||
        [],
    });
  });

  // Load selected repertoire from localStorage on mount
  createEffect(() => {
    const userId = user()?.id;
    const repertoiresList = repertoires();
    if (!userId || !repertoiresList) return;

    const storedId = getSelectedRepertoireId(userId);

    if (storedId) {
      setCurrentRepertoireId(storedId);
    } else if (repertoiresList.length > 0) {
      // Default to first repertoire
      const firstId = repertoiresList[0].repertoireId;
      setCurrentRepertoireId(firstId);
      setSelectedRepertoireId(userId, firstId);
    }
  });

  const handleRepertoireSelect = (repertoireId: string) => {
    const userId = user()?.id;
    if (!userId) return;

    setCurrentRepertoireId(repertoireId);
    setSelectedRepertoireId(userId, repertoireId);
    setShowDropdown(false);
  };

  const handleManageRepertoires = () => {
    setShowDropdown(false);
    props.onOpenRepertoireManager();
  };

  const selectedRepertoire = createMemo(() => {
    const id = currentRepertoireId();
    const repertoiresList = repertoires();
    if (!id || !repertoiresList) return null;
    return repertoiresList.find((p) => p.repertoireId === id);
  });

  return (
    <div
      class="relative"
      data-testid="repertoire-dropdown"
      ref={dropdownContainerRef}
    >
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown())}
        class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        aria-label="Select repertoire"
        aria-expanded={showDropdown()}
        data-testid="repertoire-dropdown-button"
      >
        <span class="hidden md:inline font-medium">
          {selectedRepertoire()
            ? getRepertoireDisplayName(selectedRepertoire()!)
            : "No Repertoire"}
        </span>
        <span class="md:hidden inline-block max-w-[8ch] min-w-0 truncate font-medium">
          {selectedRepertoire()
            ? getRepertoireDisplayName(selectedRepertoire()!)
            : "No Repertoire"}
        </span>
        <ChevronDown
          class="w-4 h-4 transition-transform"
          classList={{ "rotate-180": showDropdown() }}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      <Show when={showDropdown()}>
        <div class="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div class="py-2" data-testid="top-nav-manage-repertoires-panel">
            {/* Repertoires List */}
            <Show
              when={!repertoires.loading && repertoires()}
              fallback={
                <div class="px-4 py-2 text-sm text-gray-500">
                  Loading repertoires...
                </div>
              }
            >
              <For each={repertoires()}>
                {(repertoire) => (
                  <button
                    type="button"
                    class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                    classList={{
                      "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300":
                        currentRepertoireId() === repertoire.repertoireId,
                    }}
                    onClick={() =>
                      handleRepertoireSelect(repertoire.repertoireId)
                    }
                  >
                    <div class="flex-1">
                      <div class="font-medium">
                        {getRepertoireDisplayName(repertoire)}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        {repertoire.tuneCount} tune
                        {repertoire.tuneCount !== 1 ? "s" : ""}
                        {repertoire.genreDefault &&
                          ` • ${repertoire.genreDefault}`}
                      </div>
                    </div>
                    <Show
                      when={currentRepertoireId() === repertoire.repertoireId}
                    >
                      <Check
                        class="w-4 h-4 text-blue-600 dark:text-blue-400"
                        aria-hidden="true"
                      />
                    </Show>
                  </button>
                )}
              </For>
            </Show>

            {/* Divider */}
            <div class="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* Manage Repertoires */}
            <button
              type="button"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={handleManageRepertoires}
              data-testid="manage-repertoires-button"
            >
              <Settings class="w-4 h-4" aria-hidden="true" />
              Configure Repertoires...
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export const TopNav: Component = () => {
  const location = useLocation();
  const { openUserSettings } = useUserSettingsDialog();
  const { openGroupsDialog } = useGroupsDialog();
  const {
    user,
    localDb,
    signOut,
    forceSyncDown,
    forceSyncUp,
    forceCleanLocalReset,
    remoteSyncDownCompletionVersion,
    isAnonymous,
    lastSyncTimestamp,
    lastSyncMode,
  } = useAuth();
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);
  const [pendingCount, setPendingCount] = createSignal(0);
  const [showUserMenu, setShowUserMenu] = createSignal(false);
  const [showDbMenu, setShowDbMenu] = createSignal(false);
  const [showRepertoireManager, setShowRepertoireManager] = createSignal(false);
  const [showAboutDialog, setShowAboutDialog] = createSignal(false);
  const [showForceSyncUpConfirm, setShowForceSyncUpConfirm] =
    createSignal(false);
  const [pendingDeleteCount, setPendingDeleteCount] = createSignal(0);
  const [forceSyncUpBusy, setForceSyncUpBusy] = createSignal(false);
  const [forceCleanLocalResetBusy, setForceCleanLocalResetBusy] =
    createSignal(false);

  const canOpenAssistant = createMemo(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    return (
      tab === "catalog" ||
      tab === "repertoire" ||
      tab === "practice" ||
      tab === "analysis"
    );
  });

  const handleOpenAssistant = () => {
    window.dispatchEvent(new CustomEvent("tt-open-ai-assistant"));
  };

  let userMenuContainerRef: HTMLDivElement | undefined;
  let dbMenuContainerRef: HTMLDivElement | undefined;

  const getPendingDeleteCount = async (): Promise<number> => {
    const db = localDb();
    if (!db) return 0;
    const rows = await db.all<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_push_queue WHERE status IN ('pending','in_progress') AND lower(operation) = 'delete';"
    );
    return Number(rows[0]?.count ?? 0);
  };

  const runForceSyncUp = async (opts?: { allowDeletes?: boolean }) => {
    setForceSyncUpBusy(true);
    try {
      await forceSyncUp(opts);
      toast.success(
        opts?.allowDeletes === false
          ? "Uploaded local changes (deletions skipped)"
          : "Local changes uploaded to server"
      );
    } catch (error) {
      console.error("❌ [Force Sync Up] Sync failed:", error);
      toast.error("Failed to upload changes");
    } finally {
      setForceSyncUpBusy(false);
      setShowDbMenu(false);
    }
  };

  const runForceCleanLocalReset = async () => {
    setForceCleanLocalResetBusy(true);
    try {
      await forceCleanLocalReset();
      toast.success("Local database cleared and resynced");
    } catch (error) {
      console.error("❌ [Force Clean Local Reset] Reset failed:", error);
      toast.error("Failed to reset local database");
    } finally {
      setForceCleanLocalResetBusy(false);
      setShowDbMenu(false);
    }
  };

  // Fetch user avatar (refetch when remote sync completes)
  const [userAvatar] = createResource(
    () => ({
      db: localDb(),
      userId: user()?.id,
      version: remoteSyncDownCompletionVersion(),
    }),
    async ({ db, userId }) => {
      if (!db || !userId) return null;

      try {
        const { userProfile } = await import("@/../drizzle/schema-sqlite");
        const { eq } = await import("drizzle-orm");

        const result = await db
          .select({ avatarUrl: userProfile.avatarUrl })
          .from(userProfile)
          .where(eq(userProfile.id, userId))
          .limit(1);

        return result[0]?.avatarUrl || null;
      } catch (error) {
        console.error("Failed to load user avatar:", error);
        return null;
      }
    }
  );

  // Close user menu when clicking outside
  useClickOutside(
    () => userMenuContainerRef,
    () => {
      if (showUserMenu()) {
        setShowUserMenu(false);
      }
    }
  );

  // Close database menu when clicking outside
  useClickOutside(
    () => dbMenuContainerRef,
    () => {
      if (showDbMenu()) {
        setShowDbMenu(false);
      }
    }
  );

  // Monitor online/offline status
  createEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    onCleanup(() => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    });
  });

  // Poll for pending sync count (skip for anonymous users - they don't sync)
  createEffect(() => {
    const db = localDb();
    // In Playwright E2E runs, avoid polling SQLite WASM in the UI.
    // This has caused browser OOMs under heavy parallelism.
    const isE2E =
      typeof window !== "undefined" && !!(window as any).__ttTestApi;

    if (!db || isAnonymous() || isE2E) {
      setPendingCount(0); // Reset count for anonymous users
      return;
    }

    const updateSyncCount = async () => {
      try {
        const stats = await getOutboxStats(db);
        setPendingCount(stats.pending + stats.inProgress);
      } catch (error) {
        log.error("Failed to get sync outbox stats:", error);
      }
    };

    updateSyncCount();
    const interval = setInterval(updateSyncCount, 5000);
    onCleanup(() => clearInterval(interval));
  });

  const statusText = () => {
    // Anonymous users don't sync - show "Local Only"
    if (isAnonymous()) return "Local Only";
    if (!isOnline() && pendingCount() > 0) {
      return `Offline - ${pendingCount()} pending`;
    }
    if (!isOnline()) return "Offline";
    if (pendingCount() > 0) return `Syncing ${pendingCount()}`;
    return "Synced";
  };

  return (
    <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16 gap-2 sm:gap-4">
          <div class="flex min-w-0 items-center gap-2 sm:gap-6">
            {/* App Logo Dropdown */}
            <LogoDropdown onOpenAbout={() => setShowAboutDialog(true)} />
            {/* Repertoire Selector */}
            <div class="flex min-w-0 items-center gap--1">
              <span class="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400">
                Current Repertoire:
              </span>
              <RepertoireDropdown
                onOpenRepertoireManager={() => setShowRepertoireManager(true)}
              />
            </div>
          </div>

          {/* User Info + Theme + Logout */}
          <div class="flex shrink-0 items-center gap-2 sm:gap-4">
            {/* User Menu Dropdown - show for both authenticated and anonymous users */}
            <Show when={user() || isAnonymous()}>
              <div
                class="relative"
                data-testid="user-menu-dropdown"
                ref={userMenuContainerRef}
              >
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu())}
                  class="flex shrink-0 items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  aria-label="User menu"
                  aria-expanded={showUserMenu()}
                  data-testid="user-menu-button"
                >
                  <Show
                    when={user()}
                    fallback={
                      <>
                        <span class="hidden sm:inline font-medium">
                          Device Only
                        </span>
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                          ?
                        </div>
                      </>
                    }
                  >
                    {(u) => (
                      <>
                        <span class="hidden sm:inline font-medium">
                          {isAnonymous() ? "Anonymous" : u().email}
                        </span>
                        {/* User Avatar */}
                        <Show
                          when={!isAnonymous() && userAvatar()}
                          fallback={
                            <div
                              class={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                isAnonymous()
                                  ? "bg-gradient-to-br from-gray-400 to-gray-600"
                                  : "bg-gradient-to-br from-blue-500 to-purple-600"
                              }`}
                            >
                              {isAnonymous()
                                ? "?"
                                : u().email?.charAt(0).toUpperCase()}
                            </div>
                          }
                        >
                          {(avatarUrl) => (
                            <img
                              src={avatarUrl()}
                              alt="User avatar"
                              class="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                            />
                          )}
                        </Show>
                      </>
                    )}
                  </Show>
                  <ChevronDown
                    class="w-4 h-4 transition-transform"
                    classList={{ "rotate-180": showUserMenu() }}
                    aria-hidden="true"
                  />
                </button>

                {/* Dropdown Menu */}
                <Show when={showUserMenu()}>
                  <div
                    class="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                    data-testid="user-menu-panel"
                  >
                    <div class="py-2">
                      {/* User Information - for authenticated non-anonymous users */}
                      <Show when={user() && !isAnonymous()}>
                        {(_) => {
                          const u = user()!;
                          return (
                            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                              <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                User Information
                              </h3>
                              <dl class="space-y-1.5 text-sm">
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    Email:
                                  </dt>
                                  <dd class="text-gray-900 dark:text-gray-100 break-all">
                                    {u.email}
                                  </dd>
                                </div>
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    Name:
                                  </dt>
                                  <dd class="text-gray-900 dark:text-gray-100">
                                    {u.user_metadata?.name || "Not set"}
                                  </dd>
                                </div>
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    User ID:
                                  </dt>
                                  <dd class="text-gray-700 dark:text-gray-300 font-mono text-xs break-all">
                                    {u.id}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          );
                        }}
                      </Show>

                      {/* Anonymous User Info - for users in device-only mode */}
                      <Show when={isAnonymous()}>
                        {(_) => {
                          const u = user();
                          return (
                            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                              <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                Device-Only Mode
                              </h3>
                              <dl class="space-y-1.5 text-sm">
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    Email:
                                  </dt>
                                  <dd class="text-gray-500 dark:text-gray-400 italic">
                                    Anonymous
                                  </dd>
                                </div>
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    Name:
                                  </dt>
                                  <dd class="text-gray-500 dark:text-gray-400 italic">
                                    Anonymous
                                  </dd>
                                </div>
                                <Show when={u}>
                                  <div class="flex gap-2">
                                    <dt class="font-medium text-gray-600 dark:text-gray-400">
                                      User ID:
                                    </dt>
                                    <dd class="text-gray-700 dark:text-gray-300 font-mono text-xs break-all">
                                      {u!.id}
                                    </dd>
                                  </div>
                                </Show>
                              </dl>
                              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Your data is stored locally on this device only.
                              </p>
                            </div>
                          );
                        }}
                      </Show>

                      {/* Create Account button for anonymous users */}
                      <Show when={isAnonymous()}>
                        <button
                          type="button"
                          class="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2 font-medium"
                          onClick={() => {
                            setShowUserMenu(false);
                            window.location.href = "/login?convert=true";
                          }}
                          data-testid="create-account-button"
                        >
                          <UserPlus class="w-4 h-4" aria-hidden="true" />
                          Create Account
                        </button>
                      </Show>

                      {/* Menu Items */}
                      <button
                        type="button"
                        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setShowUserMenu(false);
                          openUserSettings("scheduling-options");
                        }}
                        data-testid="user-settings-button"
                      >
                        <Settings class="w-4 h-4" aria-hidden="true" />
                        User Settings
                      </button>

                      <button
                        type="button"
                        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setShowUserMenu(false);
                          openGroupsDialog();
                        }}
                        data-testid="user-menu-groups-link"
                      >
                        <Users class="w-4 h-4" aria-hidden="true" />
                        Groups
                      </button>

                      {/* Theme Switcher */}
                      <div class="w-full">
                        <ThemeSwitcher showLabel={true} />
                      </div>

                      <button
                        type="button"
                        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                        onClick={async () => {
                          setShowUserMenu(false);
                          await signOut();
                          window.location.href = "/login";
                        }}
                      >
                        <LogOut class="w-4 h-4" aria-hidden="true" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            {/* Database/Sync Status Dropdown */}
            <div
              class="relative"
              data-testid="database-status-dropdown"
              ref={dbMenuContainerRef}
            >
              <button
                type="button"
                onClick={() => setShowDbMenu(!showDbMenu())}
                class="flex shrink-0 items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label="Database and sync status"
                aria-expanded={showDbMenu()}
                data-testid="database-status-button"
              >
                {/* Database Icon */}
                <Database class="w-5 h-5" aria-hidden="true" />

                {/* Status indicator badge */}
                <Show
                  when={isOnline() && pendingCount() === 0}
                  fallback={
                    <span class="text-yellow-500" title="Warning">
                      ⚠️
                    </span>
                  }
                >
                  <span class="text-green-500" title="Synced">
                    ✓
                  </span>
                </Show>
              </button>

              {/* Dropdown Menu */}
              <Show when={showDbMenu()}>
                <div
                  class="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                  data-testid="database-dropdown-panel"
                >
                  <div class="py-2">
                    {/* Database Status Section */}
                    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                        Database Status
                      </h3>
                      <div class="space-y-2">
                        {/* Local DB Status */}
                        <div class="flex items-start gap-2">
                          <Show
                            when={localDb()}
                            fallback={
                              <span class="text-yellow-500 text-sm">⏳</span>
                            }
                          >
                            <span class="text-green-500 text-sm">✓</span>
                          </Show>
                          <div class="flex-1">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Local Database
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                              {localDb()
                                ? "Initialized and ready"
                                : "Initializing..."}
                            </div>
                          </div>
                        </div>

                        {/* Sync Status */}
                        <div class="flex items-start gap-2">
                          <Show
                            when={isOnline() && pendingCount() === 0}
                            fallback={
                              <span class="text-yellow-500 text-sm">
                                {isOnline() ? "🔄" : "⚠️"}
                              </span>
                            }
                          >
                            <span class="text-green-500 text-sm">✓</span>
                          </Show>
                          <div class="flex-1">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {statusText()}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                              {isAnonymous() &&
                                "Data stored on this device only"}
                              {!isAnonymous() &&
                                !isOnline() &&
                                "Changes will sync when reconnected"}
                              {!isAnonymous() &&
                                isOnline() &&
                                pendingCount() === 0 &&
                                "All changes synced to Supabase"}
                              {!isAnonymous() &&
                                isOnline() &&
                                pendingCount() > 0 &&
                                `${pendingCount()} change${pendingCount() === 1 ? "" : "s"} syncing...`}
                            </div>
                            <div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                              <span class="font-medium text-gray-600 dark:text-gray-300">
                                Last Sync:
                              </span>{" "}
                              {lastSyncTimestamp()
                                ? `${new Date(lastSyncTimestamp()!).toLocaleString()} (${formatRelativeTime(lastSyncTimestamp()!)} ago, ${lastSyncMode() || "n/a"})`
                                : "Not yet"}
                            </div>
                          </div>
                        </div>

                        {/* Connection Status */}
                        <div class="flex items-start gap-2">
                          <span
                            class={`text-sm ${isOnline() ? "text-green-500" : "text-yellow-500"}`}
                          >
                            {isOnline() ? "🌐" : "📴"}
                          </span>
                          <div class="flex-1">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Network
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                              {isOnline() ? "Online" : "Offline"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Force Sync Up Button */}
                    <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={async () => {
                          console.log(
                            "🔄 [Force Sync Up] Button clicked - starting sync..."
                          );
                          try {
                            const deletes = await getPendingDeleteCount();
                            setPendingDeleteCount(deletes);

                            if (deletes > 0) {
                              setShowForceSyncUpConfirm(true);
                              return;
                            }

                            await runForceSyncUp();
                          } catch (error) {
                            console.error(
                              "❌ [Force Sync Up] Preflight failed:",
                              error
                            );
                            toast.error("Failed to check pending deletes");
                            setShowDbMenu(false);
                          }
                        }}
                        class="w-full px-4 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-2 rounded-md font-medium"
                        disabled={!isOnline() || forceSyncUpBusy()}
                        classList={{
                          "opacity-50 cursor-not-allowed":
                            !isOnline() || forceSyncUpBusy(),
                        }}
                      >
                        <Upload class="w-4 h-4" aria-hidden="true" />
                        Force Sync Up
                        {!isOnline() && (
                          <span class="ml-auto text-xs text-gray-500 dark:text-gray-400">
                            (Offline)
                          </span>
                        )}
                      </button>
                    </div>

                    <AlertDialog
                      open={showForceSyncUpConfirm()}
                      onOpenChange={setShowForceSyncUpConfirm}
                    >
                      <AlertDialogContent>
                        <AlertDialogCloseButton />
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Allow record deletions?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {pendingDeleteCount()} pending delete operation(s)
                            are queued for upload. You can upload changes
                            without deletions, or allow deletions to be applied
                            on Supabase.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <button
                            type="button"
                            class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                            onClick={() => setShowForceSyncUpConfirm(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            class="px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                            onClick={async () => {
                              setShowForceSyncUpConfirm(false);
                              await runForceSyncUp({ allowDeletes: false });
                            }}
                          >
                            Upload (no deletions)
                          </button>
                          <button
                            type="button"
                            class="px-4 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                            onClick={async () => {
                              setShowForceSyncUpConfirm(false);
                              await runForceSyncUp({ allowDeletes: true });
                            }}
                          >
                            Upload (allow deletions)
                          </button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Show when={!isAnonymous()}>
                      <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={runForceCleanLocalReset}
                          class="w-full px-4 py-2 text-left text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2 rounded-md font-medium"
                          disabled={!isOnline() || forceCleanLocalResetBusy()}
                          classList={{
                            "opacity-50 cursor-not-allowed":
                              !isOnline() || forceCleanLocalResetBusy(),
                          }}
                          data-testid="force-clean-local-reset-button"
                        >
                          <Trash2 class="w-4 h-4" aria-hidden="true" />
                          Force Clean Local Reset
                          {!isOnline() && (
                            <span class="ml-auto text-xs text-gray-500 dark:text-gray-400">
                              (Offline)
                            </span>
                          )}
                        </button>
                        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Clears the local SQLite mirror, keeps you signed in,
                          then downloads fresh data from Supabase.
                        </p>
                      </div>
                    </Show>

                    {/* Force Sync Down Button */}
                    <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={async () => {
                          console.log(
                            "🔄 [Force FULL Sync Down] Button clicked - starting FULL sync..."
                          );
                          try {
                            await forceSyncDown({ full: true });
                            console.log(
                              "✅ [Force FULL Sync Down] Full sync completed successfully"
                            );
                            toast.success("Remote data downloaded");
                            setShowDbMenu(false); // Close menu after successful sync
                          } catch (error) {
                            console.error(
                              "❌ [Force FULL Sync Down] Full sync failed:",
                              error
                            );
                            toast.error("Failed to perform full download");
                            setShowDbMenu(false); // Close menu even on error
                          }
                        }}
                        class="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2 rounded-md font-medium"
                        disabled={!isOnline()}
                        classList={{
                          "opacity-50 cursor-not-allowed": !isOnline(),
                        }}
                      >
                        <Download class="w-4 h-4" aria-hidden="true" />
                        Force Full Sync Down
                        {!isOnline() && (
                          <span class="ml-auto text-xs text-gray-500 dark:text-gray-400">
                            (Offline)
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Database Browser (Temporarily enabled for production) */}
                    {/* TODO: Restore dev-only condition: <Show when={import.meta.env.DEV}> */}
                    {/* TODO: Switch back to target="_blank" after https://github.com/sboagy/tunetrees/issues/321 is resolved */}
                    <Show when={true}>
                      <a
                        href="/debug/db"
                        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                        onClick={() => setShowDbMenu(false)}
                      >
                        <Bug class="w-4 h-4" aria-hidden="true" />
                        Database Browser (Dev)
                      </a>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>

            <Show when={canOpenAssistant()}>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenAssistant}
                title="Ask Assistant"
                aria-label="Ask Assistant"
                data-testid="assistant-button"
              >
                <MessageCircle class="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              </Button>
            </Show>
          </div>
        </div>
      </div>

      {/* Repertoire Manager Dialog */}
      <RepertoireManagerDialog
        isOpen={showRepertoireManager()}
        onClose={() => setShowRepertoireManager(false)}
      />

      {/* About Dialog */}
      <AboutDialog
        isOpen={showAboutDialog()}
        onClose={() => setShowAboutDialog(false)}
      />
    </nav>
  );
};
