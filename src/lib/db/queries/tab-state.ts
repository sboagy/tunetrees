/**
 * Tab State Persistence Queries
 *
 * Manages active tab and sidebar state in tab_group_main_state table.
 * Used by MainLayout and TabBar to persist UI state across sessions.
 */

import { eq } from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";
import { tabGroupMainState } from "../schema";

export type TabId = "practice" | "repertoire" | "catalog" | "analysis";

export interface TabState {
  whichTab: TabId;
  sidebarCollapsed?: boolean;
  playlistId?: number;
}

export async function getTabState(
  db: SqliteDatabase,
  userId: number
): Promise<TabState> {
  const result = await db
    .select({
      whichTab: tabGroupMainState.whichTab,
      playlistId: tabGroupMainState.playlistId,
    })
    .from(tabGroupMainState)
    .where(eq(tabGroupMainState.userId, userId))
    .limit(1)
    .all();

  if (result.length === 0) {
    return {
      whichTab: "practice",
      sidebarCollapsed: false,
    };
  }

  return {
    whichTab: (result[0].whichTab as TabId) || "practice",
    playlistId: result[0].playlistId || undefined,
    sidebarCollapsed: false,
  };
}

export async function saveActiveTab(
  db: SqliteDatabase,
  userId: number,
  tabId: TabId
): Promise<void> {
  const existing = await db
    .select({ id: tabGroupMainState.id })
    .from(tabGroupMainState)
    .where(eq(tabGroupMainState.userId, userId))
    .limit(1)
    .all();

  if (existing.length > 0) {
    await db
      .update(tabGroupMainState)
      .set({
        whichTab: tabId,
        lastModifiedAt: new Date().toISOString(),
      })
      .where(eq(tabGroupMainState.userId, userId))
      .run();
  } else {
    await db
      .insert(tabGroupMainState)
      .values({
        userId,
        whichTab: tabId,
        lastModifiedAt: new Date().toISOString(),
      })
      .run();
  }
}
