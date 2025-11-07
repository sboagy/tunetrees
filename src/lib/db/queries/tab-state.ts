/**
 * Tab State Persistence Queries
 *
 * Manages active tab and sidebar state in tab_group_main_state table.
 * Used by MainLayout and TabBar to persist UI state across sessions.
 */

import { eq } from "drizzle-orm";
import type { DockPosition } from "@/components/layout/SidebarDockContext";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { tabGroupMainState } from "../schema";

export type TabId = "practice" | "repertoire" | "catalog" | "analysis";

export interface TabState {
  whichTab: TabId;
  sidebarCollapsed?: boolean;
  sidebarDockPosition?: DockPosition;
  playlistId?: string;
}

export async function getTabState(
  db: SqliteDatabase,
  userId: string,
): Promise<TabState> {
  const result = await db
    .select({
      whichTab: tabGroupMainState.whichTab,
      playlistId: tabGroupMainState.playlistId,
      sidebarDockPosition: tabGroupMainState.sidebarDockPosition,
    })
    .from(tabGroupMainState)
    .where(eq(tabGroupMainState.userId, userId))
    .limit(1)
    .all();

  if (result.length === 0) {
    return {
      whichTab: "practice",
      sidebarCollapsed: false,
      sidebarDockPosition: "left",
    };
  }

  return {
    whichTab: (result[0].whichTab as TabId) || "practice",
    playlistId: result[0].playlistId || undefined,
    sidebarCollapsed: false,
    sidebarDockPosition:
      (result[0].sidebarDockPosition as DockPosition) || "left",
  };
}

export async function saveActiveTab(
  db: SqliteDatabase,
  userId: string,
  tabId: TabId,
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
        id: generateId(),
        userId,
        whichTab: tabId,
        lastModifiedAt: new Date().toISOString(),
      })
      .run();
  }
}
