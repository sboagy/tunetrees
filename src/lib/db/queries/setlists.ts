import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { persistDb } from "../client-sqlite";
import {
  setlist,
  setlistItem,
  tune,
  tuneSet,
  tuneSetItem,
  userGroup,
} from "../schema";
import type {
  NewSetlist,
  NewSetlistItem,
  Setlist,
  SetlistItem,
  Tune,
  TuneSet,
  UserGroup,
} from "../types";
import {
  type GroupRole,
  getAccessibleGroupIds,
  getGroupAccessForUser,
  getGroupById,
} from "./groups";
import { getTuneSetAccessForUser, getVisibleTuneSets } from "./tune-sets";

type AnyDatabase = SqliteDatabase | BetterSQLite3Database;

export type SetlistItemKind = "tune" | "tune_set";

export interface SetlistWithSummary extends Setlist {
  groupName: string | null;
  currentUserRole: GroupRole | null;
  canManage: boolean;
  itemCount: number;
}

export interface SetlistItemWithSummary extends SetlistItem {
  tune: Tune | null;
  tuneSet: TuneSet | null;
  tuneSetTuneCount: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getLocalDeviceId(): string {
  return "local";
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Setlist name must not be empty");
  }
  return trimmed;
}

function normalizeDescription(description?: string | null): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

async function touchGroup(
  db: AnyDatabase,
  groupId: string,
  currentGroup?: UserGroup | null,
  at = nowIso()
): Promise<void> {
  const groupRow =
    currentGroup ??
    (
      await db
        .select()
        .from(userGroup)
        .where(eq(userGroup.id, groupId))
        .limit(1)
    )[0] ??
    null;

  if (!groupRow || groupRow.deleted === 1) {
    throw new Error("Group is not available");
  }

  await db
    .update(userGroup)
    .set({
      syncVersion: (groupRow.syncVersion ?? 0) + 1,
      lastModifiedAt: at,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(userGroup.id, groupId));
}

async function touchSetlist(
  db: AnyDatabase,
  setlistId: string,
  currentSetlist?: Setlist | null,
  at = nowIso()
): Promise<void> {
  const setlistRow =
    currentSetlist ??
    (
      await db.select().from(setlist).where(eq(setlist.id, setlistId)).limit(1)
    )[0] ??
    null;

  if (!setlistRow || setlistRow.deleted === 1) {
    throw new Error("Setlist is not available");
  }

  await db
    .update(setlist)
    .set({
      syncVersion: (setlistRow.syncVersion ?? 0) + 1,
      lastModifiedAt: at,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(setlist.id, setlistId));

  if (setlistRow.groupRef) {
    await touchGroup(db, setlistRow.groupRef, undefined, at);
  }
}

async function getPublicTuneRow(
  db: AnyDatabase,
  tuneId: string
): Promise<Tune | null> {
  const rows = await db
    .select()
    .from(tune)
    .where(
      and(eq(tune.id, tuneId), eq(tune.deleted, 0), isNull(tune.privateFor))
    )
    .limit(1);

  return rows[0] ?? null;
}

async function getTuneSetRow(
  db: AnyDatabase,
  tuneSetId: string
): Promise<TuneSet | null> {
  const rows = await db
    .select()
    .from(tuneSet)
    .where(and(eq(tuneSet.id, tuneSetId), eq(tuneSet.deleted, 0)))
    .limit(1);

  return rows[0] ?? null;
}

async function touchTuneSet(
  db: AnyDatabase,
  tuneSetId: string,
  currentTuneSet?: TuneSet | null,
  at = nowIso()
): Promise<void> {
  const tuneSetRow = currentTuneSet ?? (await getTuneSetRow(db, tuneSetId));

  if (!tuneSetRow || tuneSetRow.deleted === 1) {
    throw new Error("Tune Set is not available");
  }

  await db
    .update(tuneSet)
    .set({
      syncVersion: (tuneSetRow.syncVersion ?? 0) + 1,
      lastModifiedAt: at,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(tuneSet.id, tuneSetId));

  if (tuneSetRow.groupRef) {
    await touchGroup(db, tuneSetRow.groupRef, undefined, at);
  }
}

async function getTuneSetTuneCount(
  db: AnyDatabase,
  tuneSetId: string
): Promise<number> {
  const items = await db
    .select()
    .from(tuneSetItem)
    .where(
      and(eq(tuneSetItem.tuneSetRef, tuneSetId), eq(tuneSetItem.deleted, 0))
    );

  return items.length;
}

async function assertTuneSetEligibleForSetlist(
  db: AnyDatabase,
  tuneSetId: string,
  userId: string
): Promise<TuneSet> {
  const access = await getTuneSetAccessForUser(db, tuneSetId, userId);
  if (!access.canView || !access.set) {
    throw new Error("Tune Set is not visible to the current user");
  }

  const items = await db
    .select()
    .from(tuneSetItem)
    .where(
      and(eq(tuneSetItem.tuneSetRef, tuneSetId), eq(tuneSetItem.deleted, 0))
    );

  for (const item of items) {
    const tuneRow = await getPublicTuneRow(db, item.tuneRef);
    if (!tuneRow) {
      throw new Error(
        "Only Tune Sets containing public tunes can be added to a Setlist"
      );
    }
  }

  return access.set;
}

export async function getSetlistAccessForUser(
  db: AnyDatabase,
  setlistId: string,
  userId: string
): Promise<{
  setlist: Setlist | null;
  currentUserRole: GroupRole | null;
  canView: boolean;
  canManage: boolean;
}> {
  const setlists = await db
    .select()
    .from(setlist)
    .where(eq(setlist.id, setlistId))
    .limit(1);

  const currentSetlist = setlists[0] ?? null;
  if (!currentSetlist || currentSetlist.deleted === 1) {
    return {
      setlist: currentSetlist,
      currentUserRole: null,
      canView: false,
      canManage: false,
    };
  }

  // User-owned setlist: the owning user can manage
  if (currentSetlist.userRef === userId) {
    return {
      setlist: currentSetlist,
      currentUserRole: "owner",
      canView: true,
      canManage: true,
    };
  }

  // Group-owned setlist: check group membership
  if (currentSetlist.groupRef) {
    const groupAccess = await getGroupAccessForUser(
      db,
      currentSetlist.groupRef,
      userId
    );

    return {
      setlist: currentSetlist,
      currentUserRole: groupAccess.role,
      canView: groupAccess.canView,
      canManage: groupAccess.canManageSets,
    };
  }

  return {
    setlist: currentSetlist,
    currentUserRole: null,
    canView: false,
    canManage: false,
  };
}

export async function getVisibleSetlists(
  db: AnyDatabase,
  userId: string,
  options?: {
    includeDeleted?: boolean;
    groupId?: string;
  }
): Promise<SetlistWithSummary[]> {
  const includeDeleted = options?.includeDeleted ?? false;
  const accessibleGroupIds = await getAccessibleGroupIds(
    db,
    userId,
    includeDeleted
  );

  // Build WHERE clause: (group-accessible AND optionally filtered by groupId) OR user-owned
  const orFilters = [];

  if (accessibleGroupIds.length > 0) {
    const groupFilters = [inArray(setlist.groupRef, accessibleGroupIds)];
    if (options?.groupId) {
      groupFilters.push(eq(setlist.groupRef, options.groupId));
    }
    if (!includeDeleted) {
      groupFilters.push(eq(setlist.deleted, 0));
    }
    orFilters.push(and(...groupFilters));
  }

  const userFilters = [eq(setlist.userRef, userId)];
  if (!includeDeleted) {
    userFilters.push(eq(setlist.deleted, 0));
  }
  orFilters.push(and(...userFilters));

  const setlists = await db
    .select()
    .from(setlist)
    .where(or(...orFilters))
    .orderBy(asc(setlist.name));

  return Promise.all(
    setlists.map(async (setlistRow) => {
      let groupAccess: {
        role: GroupRole | null;
        canView: boolean;
        canManageSets: boolean;
      } = {
        role: null,
        canView: false,
        canManageSets: false,
      };

      if (setlistRow.userRef === userId) {
        groupAccess = { role: "owner", canView: true, canManageSets: true };
      } else if (setlistRow.groupRef) {
        groupAccess = await getGroupAccessForUser(
          db,
          setlistRow.groupRef,
          userId
        );
      }

      const items = await db
        .select()
        .from(setlistItem)
        .where(
          and(
            eq(setlistItem.setlistRef, setlistRow.id),
            eq(setlistItem.deleted, 0)
          )
        );

      return {
        ...setlistRow,
        groupName: setlistRow.groupRef
          ? ((await getGroupById(db, setlistRow.groupRef, userId))?.name ??
            null)
          : null,
        currentUserRole: groupAccess.role,
        canManage: groupAccess.canManageSets,
        itemCount: items.length,
      };
    })
  );
}

export async function getSetlistById(
  db: AnyDatabase,
  setlistId: string,
  userId: string
): Promise<Setlist | null> {
  const access = await getSetlistAccessForUser(db, setlistId, userId);
  return access.canView ? access.setlist : null;
}

export async function createSetlist(
  db: AnyDatabase,
  userId: string,
  data: {
    groupRef?: string | null;
    userRef?: string | null;
    name: string;
    description?: string | null;
  }
): Promise<Setlist> {
  // Must have at least one owner
  if (!data.groupRef && !data.userRef) {
    throw new Error("Setlist must have either a group or user owner");
  }

  // If group-scoped, check permissions
  if (data.groupRef) {
    const groupAccess = await getGroupAccessForUser(db, data.groupRef, userId);
    if (!groupAccess.canManageSets) {
      throw new Error("Only group owners or admins can manage setlists");
    }
  }

  const now = nowIso();
  const newSetlist: NewSetlist = {
    id: generateId(),
    groupRef: data.groupRef ?? null,
    userRef: data.userRef ?? null,
    name: normalizeName(data.name),
    description: normalizeDescription(data.description),
    deleted: 0,
    createdAt: now,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(setlist).values(newSetlist).returning();
  if (result.length === 0) {
    throw new Error("Failed to create Setlist");
  }

  if (data.groupRef) {
    const groupAccess = await getGroupAccessForUser(db, data.groupRef, userId);
    await touchGroup(db, data.groupRef, groupAccess.group, now);
  }
  await persistDb();
  return result[0];
}

export async function updateSetlist(
  db: AnyDatabase,
  setlistId: string,
  userId: string,
  data: {
    name?: string;
    description?: string | null;
  }
): Promise<Setlist | null> {
  const access = await getSetlistAccessForUser(db, setlistId, userId);
  if (!access.canManage || !access.setlist) {
    throw new Error("You do not have permission to update this Setlist");
  }

  const updateData: Partial<NewSetlist> = {
    syncVersion: (access.setlist.syncVersion ?? 0) + 1,
    lastModifiedAt: nowIso(),
    deviceId: getLocalDeviceId(),
  };

  if (data.name !== undefined) {
    updateData.name = normalizeName(data.name);
  }
  if (data.description !== undefined) {
    updateData.description = normalizeDescription(data.description);
  }

  const result = await db
    .update(setlist)
    .set(updateData)
    .where(eq(setlist.id, setlistId))
    .returning();

  if (access.setlist.groupRef) {
    await touchGroup(
      db,
      access.setlist.groupRef,
      undefined,
      updateData.lastModifiedAt
    );
  }
  await persistDb();
  return result[0] ?? null;
}

export async function deleteSetlist(
  db: AnyDatabase,
  setlistId: string,
  userId: string
): Promise<boolean> {
  const access = await getSetlistAccessForUser(db, setlistId, userId);
  if (!access.canManage || !access.setlist) {
    throw new Error("You do not have permission to delete this Setlist");
  }

  const now = nowIso();
  const activeItems = await db
    .select()
    .from(setlistItem)
    .where(
      and(eq(setlistItem.setlistRef, setlistId), eq(setlistItem.deleted, 0))
    );

  await db
    .update(setlist)
    .set({
      deleted: 1,
      syncVersion: (access.setlist.syncVersion ?? 0) + 1,
      lastModifiedAt: now,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(setlist.id, setlistId));

  if (access.setlist.groupRef) {
    await touchGroup(db, access.setlist.groupRef, undefined, now);
  }

  for (const item of activeItems) {
    await db
      .update(setlistItem)
      .set({
        deleted: 1,
        syncVersion: (item.syncVersion ?? 0) + 1,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(setlistItem.id, item.id));
  }

  await persistDb();
  return true;
}

export async function getSetlistItems(
  db: AnyDatabase,
  setlistId: string,
  userId: string,
  includeDeleted = false
): Promise<SetlistItemWithSummary[]> {
  const access = await getSetlistAccessForUser(db, setlistId, userId);
  if (!access.canView) {
    return [];
  }

  const filters = [eq(setlistItem.setlistRef, setlistId)];
  if (!includeDeleted) {
    filters.push(eq(setlistItem.deleted, 0));
  }

  const items = await db
    .select()
    .from(setlistItem)
    .where(and(...filters))
    .orderBy(asc(setlistItem.position));

  const result: SetlistItemWithSummary[] = [];
  for (const item of items) {
    if (item.itemKind === "tune") {
      const tuneRow = item.tuneRef
        ? await getPublicTuneRow(db, item.tuneRef)
        : null;
      if (!tuneRow) {
        continue;
      }

      result.push({
        ...item,
        tune: tuneRow,
        tuneSet: null,
        tuneSetTuneCount: 0,
      });
      continue;
    }

    const tuneSetRow = item.tuneSetRef
      ? await getTuneSetRow(db, item.tuneSetRef)
      : null;
    if (!tuneSetRow) {
      continue;
    }

    result.push({
      ...item,
      tune: null,
      tuneSet: tuneSetRow,
      tuneSetTuneCount: await getTuneSetTuneCount(db, tuneSetRow.id),
    });
  }

  return result;
}

async function getNextSetlistPosition(
  db: AnyDatabase,
  setlistId: string
): Promise<number> {
  const items = await db
    .select()
    .from(setlistItem)
    .where(
      and(eq(setlistItem.setlistRef, setlistId), eq(setlistItem.deleted, 0))
    );

  return (
    items.reduce(
      (currentMax, item) => Math.max(currentMax, item.position),
      -1
    ) + 1
  );
}

export async function addTuneToSetlist(
  db: AnyDatabase,
  setlistId: string,
  tuneId: string,
  userId: string,
  position?: number
): Promise<SetlistItem> {
  const access = await getSetlistAccessForUser(db, setlistId, userId);
  if (!access.canManage || !access.setlist) {
    throw new Error("You do not have permission to modify this Setlist");
  }

  const tuneRow = await getPublicTuneRow(db, tuneId);
  if (!tuneRow) {
    throw new Error("Only public Tunes can be added to a Setlist");
  }

  const now = nowIso();
  const newItem: NewSetlistItem = {
    id: generateId(),
    setlistRef: setlistId,
    itemKind: "tune",
    tuneRef: tuneId,
    tuneSetRef: null,
    position: position ?? (await getNextSetlistPosition(db, setlistId)),
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(setlistItem).values(newItem).returning();
  await touchSetlist(db, setlistId, access.setlist, now);
  await persistDb();
  return result[0];
}

export async function addTuneSetToSetlist(
  db: AnyDatabase,
  setlistId: string,
  tuneSetId: string,
  userId: string,
  position?: number
): Promise<SetlistItem> {
  const access = await getSetlistAccessForUser(db, setlistId, userId);
  if (!access.canManage || !access.setlist) {
    throw new Error("You do not have permission to modify this Setlist");
  }

  const eligibleTuneSet = await assertTuneSetEligibleForSetlist(
    db,
    tuneSetId,
    userId
  );

  const now = nowIso();
  const newItem: NewSetlistItem = {
    id: generateId(),
    setlistRef: setlistId,
    itemKind: "tune_set",
    tuneRef: null,
    tuneSetRef: tuneSetId,
    position: position ?? (await getNextSetlistPosition(db, setlistId)),
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(setlistItem).values(newItem).returning();
  await touchSetlist(db, setlistId, access.setlist, now);
  await touchTuneSet(db, tuneSetId, eligibleTuneSet, now);
  await persistDb();
  return result[0];
}

export async function removeSetlistItem(
  db: AnyDatabase,
  setlistId: string,
  itemId: string,
  userId: string
): Promise<boolean> {
  const access = await getSetlistAccessForUser(db, setlistId, userId);
  if (!access.canManage) {
    throw new Error("You do not have permission to modify this Setlist");
  }

  const rows = await db
    .select()
    .from(setlistItem)
    .where(
      and(eq(setlistItem.id, itemId), eq(setlistItem.setlistRef, setlistId))
    )
    .limit(1);

  if (rows.length === 0 || rows[0].deleted === 1) {
    return false;
  }

  const now = nowIso();

  await db
    .update(setlistItem)
    .set({
      deleted: 1,
      syncVersion: (rows[0].syncVersion ?? 0) + 1,
      lastModifiedAt: now,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(setlistItem.id, rows[0].id));

  await touchSetlist(db, setlistId, access.setlist, now);
  if (rows[0].tuneSetRef) {
    await touchTuneSet(db, rows[0].tuneSetRef, undefined, now);
  }
  await persistDb();
  return true;
}

export async function reorderSetlistItems(
  db: AnyDatabase,
  setlistId: string,
  itemIdsInOrder: string[],
  userId: string
): Promise<void> {
  const access = await getSetlistAccessForUser(db, setlistId, userId);
  if (!access.canManage) {
    throw new Error("You do not have permission to reorder this Setlist");
  }

  const existing = await db
    .select()
    .from(setlistItem)
    .where(
      and(eq(setlistItem.setlistRef, setlistId), eq(setlistItem.deleted, 0))
    );

  const existingIds = existing.map((row) => row.id).sort();
  const requestedIds = [...itemIdsInOrder].sort();
  if (
    existingIds.length !== requestedIds.length ||
    existingIds.some((id, index) => id !== requestedIds[index])
  ) {
    throw new Error(
      "Reorder payload must contain every active Setlist item exactly once"
    );
  }

  const offset = existing.length + 100;
  const now = nowIso();
  const existingById = new Map(existing.map((item) => [item.id, item]));

  for (const item of existing) {
    await db
      .update(setlistItem)
      .set({
        position: item.position + offset,
        syncVersion: (item.syncVersion ?? 0) + 1,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(setlistItem.id, item.id));
  }

  for (const [index, itemId] of itemIdsInOrder.entries()) {
    const existingItem = existingById.get(itemId);
    if (!existingItem) {
      throw new Error(
        "Reorder payload must contain every active Setlist item exactly once"
      );
    }

    await db
      .update(setlistItem)
      .set({
        position: index,
        syncVersion: (existingItem.syncVersion ?? 0) + 2,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(setlistItem.id, itemId));
  }

  await touchSetlist(db, setlistId, access.setlist, now);
  const tuneSetIds = new Set(
    existing
      .map((item) => item.tuneSetRef)
      .filter((tuneSetRef): tuneSetRef is string => Boolean(tuneSetRef))
  );
  for (const tuneSetId of tuneSetIds) {
    await touchTuneSet(db, tuneSetId, undefined, now);
  }
  await persistDb();
}

export async function getEligibleTuneSetsForSetlist(
  db: AnyDatabase,
  userId: string
): Promise<TuneSet[]> {
  const visibleTuneSets = await getVisibleTuneSets(db, userId, {
    includeDeleted: false,
    setKind: "practice_set",
  });

  const eligible: TuneSet[] = [];
  for (const tuneSetSummary of visibleTuneSets) {
    try {
      const tuneSetRow = await assertTuneSetEligibleForSetlist(
        db,
        tuneSetSummary.id,
        userId
      );
      eligible.push(tuneSetRow);
    } catch {}
  }

  return eligible;
}
