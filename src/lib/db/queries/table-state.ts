/**
 * Table State DB Queries
 *
 * Reads and writes table state (column visibility, ordering, sorting, etc.)
 * to/from the local SQLite `table_state` table, which is synced remotely via
 * the oosync worker to Supabase.  This ensures column preferences survive a
 * localStorage reset and are restored on any device the user signs in to.
 *
 * Key encoding:
 *   - screenSize  : "small" | "full"  (< 768 px → "small")
 *   - purpose     : DB accepts "practice" | "repertoire" | "catalog" | "analysis"
 *                   The UI uses "scheduled" for the practice queue – map it here.
 *   - repertoireId: must be a real UUID; skip DB operations when it equals "0".
 *
 * @module lib/db/queries/table-state
 */

import { and, eq } from "drizzle-orm";
import type { ITableStateExtended } from "@/components/grids/types";
import type { TablePurpose } from "@/components/grids/types";
import type { SqliteDatabase } from "../client-sqlite";
import { tableState } from "../schema";

/** Screen size category stored in the DB. */
export type ScreenSize = "small" | "full";

/**
 * Derive the current screen-size category from the viewport width.
 * Matches the breakpoint used by the mobile-detection hook (< 768 px).
 */
export function getScreenSize(): ScreenSize {
  if (typeof window === "undefined") return "full";
  return window.innerWidth < 768 ? "small" : "full";
}

/**
 * Map UI table purpose to the purpose value stored in the DB.
 * The DB CHECK constraint only allows: practice | repertoire | catalog | analysis.
 */
function mapPurpose(tablePurpose: TablePurpose): string {
  return tablePurpose === "scheduled" ? "practice" : tablePurpose;
}

/**
 * Load table state from the local SQLite DB for the given key + screen size.
 * Returns null when no matching row exists or when the `settings` column is
 * empty / unparseable.
 */
export async function loadTableStateFromDb(
  db: SqliteDatabase,
  userId: string,
  tablePurpose: TablePurpose,
  repertoireId: string,
  screenSize: ScreenSize
): Promise<ITableStateExtended | null> {
  // Skip when repertoireId is the placeholder "0" (not a valid FK).
  if (!userId || !repertoireId || repertoireId === "0") return null;

  try {
    const rows = await db
      .select({ settings: tableState.settings })
      .from(tableState)
      .where(
        and(
          eq(tableState.userId, userId),
          eq(tableState.screenSize, screenSize),
          eq(tableState.purpose, mapPurpose(tablePurpose)),
          eq(tableState.repertoireId, repertoireId)
        )
      )
      .limit(1)
      .all();

    if (rows.length === 0 || !rows[0].settings) return null;
    return JSON.parse(rows[0].settings) as ITableStateExtended;
  } catch (error) {
    console.warn("[table-state] Failed to load state from DB:", error);
    return null;
  }
}

/**
 * Upsert table state into the local SQLite DB.
 * Fire-and-forget: callers should not await this in render-critical paths.
 */
export async function saveTableStateToDb(
  db: SqliteDatabase,
  userId: string,
  tablePurpose: TablePurpose,
  repertoireId: string,
  screenSize: ScreenSize,
  state: ITableStateExtended
): Promise<void> {
  // Skip when repertoireId is the placeholder "0" (not a valid FK).
  if (!userId || !repertoireId || repertoireId === "0") return;

  const settings = JSON.stringify(state);
  const now = new Date().toISOString();
  const dbPurpose = mapPurpose(tablePurpose);

  try {
    await db
      .insert(tableState)
      .values({
        userId,
        screenSize,
        purpose: dbPurpose,
        repertoireId,
        settings,
        lastModifiedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          tableState.userId,
          tableState.screenSize,
          tableState.purpose,
          tableState.repertoireId,
        ],
        set: {
          settings,
          lastModifiedAt: now,
        },
      });
  } catch (error) {
    console.warn("[table-state] Failed to save state to DB:", error);
  }
}
