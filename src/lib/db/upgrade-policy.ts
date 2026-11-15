import type { IBrowserSqliteHooks } from "oosync/runtime/browser-sqlite";

// Audited pre-goals sync contract. Do not derive this from new generated metadata:
// adding a formerly local-only table must not silently authorize its deletion.
const REDOWNLOADABLE_TABLES = new Set([
  "genre",
  "tune_type",
  "genre_tune_type",
  "rhythm_patterns",
  "user_profile",
  "daily_practice_queue",
  "goal",
  "instrument",
  "plugin",
  "prefs_scheduling_options",
  "prefs_spaced_repetition",
  "repertoire",
  "tab_group_main_state",
  "table_state",
  "tune",
  "note",
  "practice_record",
  "reference",
  "media_asset",
  "repertoire_tune",
  "table_transient_data",
  "tag",
  "tune_override",
  "user_genre_selection",
  "user_group",
  "group_member",
  "setlist",
  "event",
  "tune_set",
  "setlist_item",
  "tune_set_item",
]);
const REGENERATED_TABLES = new Set(["view_column_meta", "sync_change_log"]);
const authenticatedInitializations = new Set<string>();

export async function withUpgradeIdentity<T>(
  userId: string,
  authenticated: boolean,
  initialize: () => Promise<T>
): Promise<T> {
  if (authenticated) authenticatedInitializations.add(userId);
  try {
    return await initialize();
  } finally {
    authenticatedInitializations.delete(userId);
  }
}

export const canDiscardLocalTable: NonNullable<
  IBrowserSqliteHooks["canDiscardLocalTable"]
> = ({ rawDb, userId, tableName }) => {
  if (REGENERATED_TABLES.has(tableName)) return true;
  // Anonymous sessions are pull-only, so even an empty outbox is insufficient.
  // Unknown/removed tables and media_draft_outbox require explicit preservation.
  if (
    !authenticatedInitializations.has(userId) ||
    !REDOWNLOADABLE_TABLES.has(tableName)
  )
    return false;
  if (!localStorage.getItem(`TT_LAST_SYNC_TIMESTAMP_${userId}`)) return false;
  // Older installations may predate a table's sync support. An audited table
  // must also have tracked writes in this snapshot. The runtime independently
  // refuses any outstanding queue rows and unreplayed backups.
  const triggers = new Set(
    rawDb
      .exec("SELECT name FROM sqlite_master WHERE type = 'trigger'")[0]
      ?.values.map((row) => String(row[0])) ?? []
  );
  return ["insert", "update", "delete"].every((operation) =>
    triggers.has(`trg_${tableName}_${operation}`)
  );
};

const fullPullKey = (userId: string) => `TT_UPGRADE_FULL_PULL_${userId}`;
export function requireUpgradeFullPull(userId: string): void {
  localStorage.setItem(fullPullKey(userId), "1");
  resumeUpgradeFullPull(userId);
}
export function resumeUpgradeFullPull(userId: string): void {
  if (localStorage.getItem(fullPullKey(userId))) {
    localStorage.removeItem(`TT_LAST_SYNC_TIMESTAMP_${userId}`);
  }
}
export async function finishUpgradeFullPull(
  userId: string,
  persist: () => Promise<void>
): Promise<void> {
  if (!localStorage.getItem(fullPullKey(userId))) return;
  // The engine advances its watermark before SQLite persistence. Keep the
  // marker across crashes/failures so the next startup repeats the full pull.
  await persist();
  localStorage.removeItem(fullPullKey(userId));
}
