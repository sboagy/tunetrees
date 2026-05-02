import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { persistDb } from "../client-sqlite";
import { tune, tuneSet, tuneSetItem } from "../schema";
import type {
  NewTuneSet,
  NewTuneSetItem,
  Tune,
  TuneSet,
  TuneSetItem,
} from "../types";
import {
  type GroupRole,
  getAccessibleGroupIds,
  getGroupAccessForUser,
  getGroupById,
} from "./groups";

type AnyDatabase = SqliteDatabase | BetterSQLite3Database;

export type TuneSetKind = "practice_set";

export interface TuneSetWithSummary extends TuneSet {
  ownerName: string | null;
  groupName: string | null;
  currentUserRole: GroupRole | null;
  canManage: boolean;
  tuneCount: number;
}

export interface TuneSetItemWithTune extends TuneSetItem {
  tune: Tune;
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
    throw new Error("Tune set name must not be empty");
  }
  return trimmed;
}

function normalizeDescription(description?: string | null): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

async function getTuneRow(
  db: AnyDatabase,
  tuneId: string,
  userId: string
): Promise<Tune | null> {
  const rows = await db
    .select()
    .from(tune)
    .where(
      and(
        eq(tune.id, tuneId),
        eq(tune.deleted, 0),
        or(eq(tune.privateFor, userId), isNull(tune.privateFor))
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getTuneSetAccessForUser(
  db: AnyDatabase,
  tuneSetId: string,
  userId: string
): Promise<{
  set: TuneSet | null;
  currentUserRole: GroupRole | null;
  canView: boolean;
  canManage: boolean;
}> {
  const sets = await db
    .select()
    .from(tuneSet)
    .where(eq(tuneSet.id, tuneSetId))
    .limit(1);

  const set = sets[0] ?? null;
  if (!set || set.deleted === 1) {
    return { set, currentUserRole: null, canView: false, canManage: false };
  }

  if (set.ownerUserRef === userId) {
    return {
      set,
      currentUserRole: "owner",
      canView: true,
      canManage: true,
    };
  }

  if (!set.groupRef) {
    return { set, currentUserRole: null, canView: false, canManage: false };
  }

  const groupAccess = await getGroupAccessForUser(db, set.groupRef, userId);
  return {
    set,
    currentUserRole: groupAccess.role,
    canView: groupAccess.canView,
    canManage: groupAccess.canManageSets,
  };
}

export async function getVisibleTuneSets(
  db: AnyDatabase,
  userId: string,
  options?: {
    includeDeleted?: boolean;
    setKind?: TuneSetKind;
    groupId?: string;
  }
): Promise<TuneSetWithSummary[]> {
  const includeDeleted = options?.includeDeleted ?? false;
  const accessibleGroupIds = await getAccessibleGroupIds(
    db,
    userId,
    includeDeleted
  );

  const visibilityConditions = [eq(tuneSet.ownerUserRef, userId)];
  if (accessibleGroupIds.length > 0) {
    visibilityConditions.push(inArray(tuneSet.groupRef, accessibleGroupIds));
  }

  const filters = [or(...visibilityConditions)];
  if (!includeDeleted) {
    filters.push(eq(tuneSet.deleted, 0));
  }
  if (options?.setKind) {
    filters.push(eq(tuneSet.setKind, options.setKind));
  }
  if (options?.groupId) {
    filters.push(eq(tuneSet.groupRef, options.groupId));
  }

  const sets = await db
    .select()
    .from(tuneSet)
    .where(and(...filters))
    .orderBy(asc(tuneSet.name));

  return Promise.all(
    sets.map(async (set) => {
      const groupAccess = set.groupRef
        ? await getGroupAccessForUser(db, set.groupRef, userId)
        : null;
      const items = await db
        .select()
        .from(tuneSetItem)
        .where(
          and(eq(tuneSetItem.tuneSetRef, set.id), eq(tuneSetItem.deleted, 0))
        );

      return {
        ...set,
        ownerName: null,
        groupName: set.groupRef
          ? ((await getGroupById(db, set.groupRef, userId))?.name ?? null)
          : null,
        currentUserRole:
          set.ownerUserRef === userId
            ? ("owner" as const)
            : (groupAccess?.role ?? null),
        canManage:
          set.ownerUserRef === userId || groupAccess?.canManageSets === true,
        tuneCount: items.length,
      };
    })
  );
}

export async function getPersonalTuneSets(
  db: AnyDatabase,
  userId: string,
  includeDeleted = false
): Promise<TuneSetWithSummary[]> {
  const visibleSets = await getVisibleTuneSets(db, userId, {
    includeDeleted,
    setKind: "practice_set",
  });

  return visibleSets.filter(
    (set) => set.ownerUserRef === userId && set.groupRef == null
  );
}

export async function getTuneSetById(
  db: AnyDatabase,
  tuneSetId: string,
  userId: string
): Promise<TuneSet | null> {
  const access = await getTuneSetAccessForUser(db, tuneSetId, userId);
  return access.canView ? access.set : null;
}

export async function createTuneSet(
  db: AnyDatabase,
  userId: string,
  data: {
    name: string;
    description?: string | null;
    setKind?: TuneSetKind;
    groupRef?: string | null;
  }
): Promise<TuneSet> {
  const now = nowIso();
  const groupRef = data.groupRef ?? null;
  const setKind = data.setKind ?? "practice_set";

  if (groupRef) {
    const groupAccess = await getGroupAccessForUser(db, groupRef, userId);
    if (!groupAccess.canManageSets) {
      throw new Error(
        "Only group owners or admins can manage shared Tune Sets"
      );
    }
  }

  const newSet: NewTuneSet = {
    id: generateId(),
    ownerUserRef: groupRef ? null : userId,
    groupRef,
    name: normalizeName(data.name),
    description: normalizeDescription(data.description),
    setKind,
    deleted: 0,
    createdAt: now,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(tuneSet).values(newSet).returning();
  if (result.length === 0) {
    throw new Error("Failed to create tune set");
  }

  await persistDb();
  return result[0];
}

export async function updateTuneSet(
  db: AnyDatabase,
  tuneSetId: string,
  userId: string,
  data: {
    name?: string;
    description?: string | null;
  }
): Promise<TuneSet | null> {
  const access = await getTuneSetAccessForUser(db, tuneSetId, userId);
  if (!access.canManage || !access.set) {
    throw new Error("You do not have permission to update this tune set");
  }

  const updateData: Partial<NewTuneSet> = {
    syncVersion: (access.set.syncVersion ?? 0) + 1,
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
    .update(tuneSet)
    .set(updateData)
    .where(eq(tuneSet.id, tuneSetId))
    .returning();

  await persistDb();
  return result[0] ?? null;
}

export async function deleteTuneSet(
  db: AnyDatabase,
  tuneSetId: string,
  userId: string
): Promise<boolean> {
  const access = await getTuneSetAccessForUser(db, tuneSetId, userId);
  if (!access.canManage || !access.set) {
    throw new Error("You do not have permission to delete this tune set");
  }

  const now = nowIso();
  const activeItems = await db
    .select()
    .from(tuneSetItem)
    .where(
      and(eq(tuneSetItem.tuneSetRef, tuneSetId), eq(tuneSetItem.deleted, 0))
    );

  await db
    .update(tuneSet)
    .set({
      deleted: 1,
      syncVersion: (access.set.syncVersion ?? 0) + 1,
      lastModifiedAt: now,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(tuneSet.id, tuneSetId));

  for (const item of activeItems) {
    await db
      .update(tuneSetItem)
      .set({
        deleted: 1,
        syncVersion: (item.syncVersion ?? 0) + 1,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(tuneSetItem.id, item.id));
  }

  await persistDb();
  return true;
}

export async function getTuneSetItems(
  db: AnyDatabase,
  tuneSetId: string,
  userId: string,
  includeDeleted = false
): Promise<TuneSetItemWithTune[]> {
  const access = await getTuneSetAccessForUser(db, tuneSetId, userId);
  if (!access.canView) {
    return [];
  }

  const filters = [eq(tuneSetItem.tuneSetRef, tuneSetId)];
  if (!includeDeleted) {
    filters.push(eq(tuneSetItem.deleted, 0));
  }

  const items = await db
    .select()
    .from(tuneSetItem)
    .where(and(...filters))
    .orderBy(asc(tuneSetItem.position));

  const result: TuneSetItemWithTune[] = [];
  for (const item of items) {
    const tuneRow = await getTuneRow(db, item.tuneRef, userId);
    if (!tuneRow) {
      continue;
    }

    result.push({
      ...item,
      tune: tuneRow,
    });
  }

  return result;
}

export async function getTuneIdsForTuneSet(
  db: AnyDatabase,
  tuneSetId: string,
  userId: string
): Promise<string[]> {
  const items = await getTuneSetItems(db, tuneSetId, userId);
  return items.map((item) => item.tuneRef);
}

export async function getTuneIdsForTuneSets(
  db: AnyDatabase,
  tuneSetIds: string[],
  userId: string
): Promise<string[]> {
  const uniqueTuneIds = new Set<string>();

  for (const tuneSetId of tuneSetIds) {
    const tuneIds = await getTuneIdsForTuneSet(db, tuneSetId, userId);
    for (const tuneId of tuneIds) {
      uniqueTuneIds.add(tuneId);
    }
  }

  return Array.from(uniqueTuneIds);
}

export async function addTuneToTuneSet(
  db: AnyDatabase,
  tuneSetId: string,
  tuneId: string,
  userId: string,
  position?: number
): Promise<TuneSetItem> {
  const access = await getTuneSetAccessForUser(db, tuneSetId, userId);
  if (!access.canManage || !access.set) {
    throw new Error("You do not have permission to modify this tune set");
  }
  const tuneRow = await getTuneRow(db, tuneId, userId);
  if (!tuneRow) {
    throw new Error("Tune is not visible to the current user");
  }
  if (access.set.groupRef && tuneRow.privateFor) {
    throw new Error("Private tunes cannot be added to a shared Tune Set");
  }

  const existing = await db
    .select()
    .from(tuneSetItem)
    .where(
      and(
        eq(tuneSetItem.tuneSetRef, tuneSetId),
        eq(tuneSetItem.tuneRef, tuneId)
      )
    )
    .limit(1);

  const currentItems = await db
    .select()
    .from(tuneSetItem)
    .where(
      and(eq(tuneSetItem.tuneSetRef, tuneSetId), eq(tuneSetItem.deleted, 0))
    );
  const maxPosition = currentItems.reduce(
    (currentMax, item) => Math.max(currentMax, item.position),
    -1
  );
  const nextPosition = position ?? maxPosition + 1;

  const now = nowIso();
  if (existing.length > 0) {
    const result = await db
      .update(tuneSetItem)
      .set({
        deleted: 0,
        position: nextPosition,
        syncVersion: (existing[0].syncVersion ?? 0) + 1,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(tuneSetItem.id, existing[0].id))
      .returning();
    await persistDb();
    return result[0];
  }

  const newItem: NewTuneSetItem = {
    id: generateId(),
    tuneSetRef: tuneSetId,
    tuneRef: tuneId,
    position: nextPosition,
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(tuneSetItem).values(newItem).returning();
  await persistDb();
  return result[0];
}

export async function addTunesToTuneSet(
  db: AnyDatabase,
  tuneSetId: string,
  tuneIds: string[],
  userId: string
): Promise<{ added: number; skipped: number; tuneIds: string[] }> {
  let added = 0;
  let skipped = 0;
  const addedTuneIds: string[] = [];

  for (const tuneId of tuneIds) {
    try {
      const existing = await db
        .select()
        .from(tuneSetItem)
        .where(
          and(
            eq(tuneSetItem.tuneSetRef, tuneSetId),
            eq(tuneSetItem.tuneRef, tuneId),
            eq(tuneSetItem.deleted, 0)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        skipped += 1;
        continue;
      }

      await addTuneToTuneSet(db, tuneSetId, tuneId, userId);
      added += 1;
      addedTuneIds.push(tuneId);
    } catch {
      skipped += 1;
    }
  }

  return { added, skipped, tuneIds: addedTuneIds };
}

export async function createTuneSetFromTunes(
  db: AnyDatabase,
  userId: string,
  data: {
    name: string;
    tuneIds: string[];
    description?: string | null;
  }
): Promise<TuneSet> {
  if (data.tuneIds.length === 0) {
    throw new Error("Select at least one tune to create a tune set");
  }

  const createdSet = await createTuneSet(db, userId, {
    name: data.name,
    description: data.description,
    setKind: "practice_set",
  });

  for (const [index, tuneId] of data.tuneIds.entries()) {
    await addTuneToTuneSet(db, createdSet.id, tuneId, userId, index);
  }

  return createdSet;
}

export async function removeTuneFromTuneSet(
  db: AnyDatabase,
  tuneSetId: string,
  tuneId: string,
  userId: string
): Promise<boolean> {
  const access = await getTuneSetAccessForUser(db, tuneSetId, userId);
  if (!access.canManage) {
    throw new Error("You do not have permission to modify this tune set");
  }

  const rows = await db
    .select()
    .from(tuneSetItem)
    .where(
      and(
        eq(tuneSetItem.tuneSetRef, tuneSetId),
        eq(tuneSetItem.tuneRef, tuneId)
      )
    )
    .limit(1);

  if (rows.length === 0 || rows[0].deleted === 1) {
    return false;
  }

  await db
    .update(tuneSetItem)
    .set({
      deleted: 1,
      syncVersion: (rows[0].syncVersion ?? 0) + 1,
      lastModifiedAt: nowIso(),
      deviceId: getLocalDeviceId(),
    })
    .where(eq(tuneSetItem.id, rows[0].id));

  await persistDb();
  return true;
}

export async function reorderTuneSetItems(
  db: AnyDatabase,
  tuneSetId: string,
  itemIdsInOrder: string[],
  userId: string
): Promise<void> {
  const access = await getTuneSetAccessForUser(db, tuneSetId, userId);
  if (!access.canManage) {
    throw new Error("You do not have permission to reorder this tune set");
  }

  const existing = await db
    .select()
    .from(tuneSetItem)
    .where(
      and(eq(tuneSetItem.tuneSetRef, tuneSetId), eq(tuneSetItem.deleted, 0))
    );

  const existingIds = existing.map((row) => row.id).sort();
  const requestedIds = [...itemIdsInOrder].sort();
  if (
    existingIds.length !== requestedIds.length ||
    existingIds.some((id, index) => id !== requestedIds[index])
  ) {
    throw new Error(
      "Reorder payload must contain every active tune set item exactly once"
    );
  }

  const offset = existing.length + 100;
  const now = nowIso();
  const existingById = new Map(existing.map((item) => [item.id, item]));

  for (const item of existing) {
    await db
      .update(tuneSetItem)
      .set({
        position: item.position + offset,
        syncVersion: (item.syncVersion ?? 0) + 1,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(tuneSetItem.id, item.id));
  }

  for (const [index, itemId] of itemIdsInOrder.entries()) {
    const existingItem = existingById.get(itemId);
    if (!existingItem) {
      throw new Error(
        "Reorder payload must contain every active tune set item exactly once"
      );
    }

    await db
      .update(tuneSetItem)
      .set({
        position: index,
        syncVersion: (existingItem.syncVersion ?? 0) + 2,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(tuneSetItem.id, itemId));
  }

  await persistDb();
}
