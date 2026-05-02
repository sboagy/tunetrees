import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { persistDb } from "../client-sqlite";
import { program, programItem, tune, tuneSet, tuneSetItem } from "../schema";
import type {
  NewProgram,
  NewProgramItem,
  Program,
  ProgramItem,
  Tune,
  TuneSet,
} from "../types";
import {
  type GroupRole,
  getAccessibleGroupIds,
  getGroupAccessForUser,
  getGroupById,
} from "./groups";
import { getTuneSetAccessForUser, getVisibleTuneSets } from "./tune-sets";

type AnyDatabase = SqliteDatabase | BetterSQLite3Database;

export type ProgramItemKind = "tune" | "tune_set";

export interface ProgramWithSummary extends Program {
  groupName: string | null;
  currentUserRole: GroupRole | null;
  canManage: boolean;
  itemCount: number;
}

export interface ProgramItemWithSummary extends ProgramItem {
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
    throw new Error("Program name must not be empty");
  }
  return trimmed;
}

function normalizeDescription(description?: string | null): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
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

async function assertTuneSetEligibleForProgram(
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
        "Only Tune Sets containing public tunes can be added to a Program"
      );
    }
  }

  return access.set;
}

export async function getProgramAccessForUser(
  db: AnyDatabase,
  programId: string,
  userId: string
): Promise<{
  program: Program | null;
  currentUserRole: GroupRole | null;
  canView: boolean;
  canManage: boolean;
}> {
  const programs = await db
    .select()
    .from(program)
    .where(eq(program.id, programId))
    .limit(1);

  const currentProgram = programs[0] ?? null;
  if (!currentProgram || currentProgram.deleted === 1) {
    return {
      program: currentProgram,
      currentUserRole: null,
      canView: false,
      canManage: false,
    };
  }

  const groupAccess = await getGroupAccessForUser(
    db,
    currentProgram.groupRef,
    userId
  );

  return {
    program: currentProgram,
    currentUserRole: groupAccess.role,
    canView: groupAccess.canView,
    canManage: groupAccess.canManageSets,
  };
}

export async function getVisiblePrograms(
  db: AnyDatabase,
  userId: string,
  options?: {
    includeDeleted?: boolean;
    groupId?: string;
  }
): Promise<ProgramWithSummary[]> {
  const includeDeleted = options?.includeDeleted ?? false;
  const accessibleGroupIds = await getAccessibleGroupIds(
    db,
    userId,
    includeDeleted
  );
  if (accessibleGroupIds.length === 0) {
    return [];
  }

  const filters = [inArray(program.groupRef, accessibleGroupIds)];
  if (!includeDeleted) {
    filters.push(eq(program.deleted, 0));
  }
  if (options?.groupId) {
    filters.push(eq(program.groupRef, options.groupId));
  }

  const programs = await db
    .select()
    .from(program)
    .where(and(...filters))
    .orderBy(asc(program.name));

  return Promise.all(
    programs.map(async (programRow) => {
      const groupAccess = await getGroupAccessForUser(
        db,
        programRow.groupRef,
        userId
      );
      const items = await db
        .select()
        .from(programItem)
        .where(
          and(
            eq(programItem.programRef, programRow.id),
            eq(programItem.deleted, 0)
          )
        );

      return {
        ...programRow,
        groupName:
          (await getGroupById(db, programRow.groupRef, userId))?.name ?? null,
        currentUserRole: groupAccess.role,
        canManage: groupAccess.canManageSets,
        itemCount: items.length,
      };
    })
  );
}

export async function getProgramById(
  db: AnyDatabase,
  programId: string,
  userId: string
): Promise<Program | null> {
  const access = await getProgramAccessForUser(db, programId, userId);
  return access.canView ? access.program : null;
}

export async function createProgram(
  db: AnyDatabase,
  userId: string,
  data: {
    groupRef: string;
    name: string;
    description?: string | null;
  }
): Promise<Program> {
  const groupAccess = await getGroupAccessForUser(db, data.groupRef, userId);
  if (!groupAccess.canManageSets) {
    throw new Error("Only group owners or admins can manage Programs");
  }

  const now = nowIso();
  const newProgram: NewProgram = {
    id: generateId(),
    groupRef: data.groupRef,
    name: normalizeName(data.name),
    description: normalizeDescription(data.description),
    deleted: 0,
    createdAt: now,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(program).values(newProgram).returning();
  if (result.length === 0) {
    throw new Error("Failed to create Program");
  }

  await persistDb();
  return result[0];
}

export async function updateProgram(
  db: AnyDatabase,
  programId: string,
  userId: string,
  data: {
    name?: string;
    description?: string | null;
  }
): Promise<Program | null> {
  const access = await getProgramAccessForUser(db, programId, userId);
  if (!access.canManage || !access.program) {
    throw new Error("You do not have permission to update this Program");
  }

  const updateData: Partial<NewProgram> = {
    syncVersion: (access.program.syncVersion ?? 0) + 1,
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
    .update(program)
    .set(updateData)
    .where(eq(program.id, programId))
    .returning();

  await persistDb();
  return result[0] ?? null;
}

export async function deleteProgram(
  db: AnyDatabase,
  programId: string,
  userId: string
): Promise<boolean> {
  const access = await getProgramAccessForUser(db, programId, userId);
  if (!access.canManage || !access.program) {
    throw new Error("You do not have permission to delete this Program");
  }

  const now = nowIso();
  const activeItems = await db
    .select()
    .from(programItem)
    .where(
      and(eq(programItem.programRef, programId), eq(programItem.deleted, 0))
    );

  await db
    .update(program)
    .set({
      deleted: 1,
      syncVersion: (access.program.syncVersion ?? 0) + 1,
      lastModifiedAt: now,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(program.id, programId));

  for (const item of activeItems) {
    await db
      .update(programItem)
      .set({
        deleted: 1,
        syncVersion: (item.syncVersion ?? 0) + 1,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(programItem.id, item.id));
  }

  await persistDb();
  return true;
}

export async function getProgramItems(
  db: AnyDatabase,
  programId: string,
  userId: string,
  includeDeleted = false
): Promise<ProgramItemWithSummary[]> {
  const access = await getProgramAccessForUser(db, programId, userId);
  if (!access.canView) {
    return [];
  }

  const filters = [eq(programItem.programRef, programId)];
  if (!includeDeleted) {
    filters.push(eq(programItem.deleted, 0));
  }

  const items = await db
    .select()
    .from(programItem)
    .where(and(...filters))
    .orderBy(asc(programItem.position));

  const result: ProgramItemWithSummary[] = [];
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

async function getNextProgramPosition(
  db: AnyDatabase,
  programId: string
): Promise<number> {
  const items = await db
    .select()
    .from(programItem)
    .where(
      and(eq(programItem.programRef, programId), eq(programItem.deleted, 0))
    );

  return (
    items.reduce(
      (currentMax, item) => Math.max(currentMax, item.position),
      -1
    ) + 1
  );
}

export async function addTuneToProgram(
  db: AnyDatabase,
  programId: string,
  tuneId: string,
  userId: string,
  position?: number
): Promise<ProgramItem> {
  const access = await getProgramAccessForUser(db, programId, userId);
  if (!access.canManage || !access.program) {
    throw new Error("You do not have permission to modify this Program");
  }

  const tuneRow = await getPublicTuneRow(db, tuneId);
  if (!tuneRow) {
    throw new Error("Only public Tunes can be added to a Program");
  }

  const now = nowIso();
  const newItem: NewProgramItem = {
    id: generateId(),
    programRef: programId,
    itemKind: "tune",
    tuneRef: tuneId,
    tuneSetRef: null,
    position: position ?? (await getNextProgramPosition(db, programId)),
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(programItem).values(newItem).returning();
  await persistDb();
  return result[0];
}

export async function addTuneSetToProgram(
  db: AnyDatabase,
  programId: string,
  tuneSetId: string,
  userId: string,
  position?: number
): Promise<ProgramItem> {
  const access = await getProgramAccessForUser(db, programId, userId);
  if (!access.canManage || !access.program) {
    throw new Error("You do not have permission to modify this Program");
  }

  await assertTuneSetEligibleForProgram(db, tuneSetId, userId);

  const now = nowIso();
  const newItem: NewProgramItem = {
    id: generateId(),
    programRef: programId,
    itemKind: "tune_set",
    tuneRef: null,
    tuneSetRef: tuneSetId,
    position: position ?? (await getNextProgramPosition(db, programId)),
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(programItem).values(newItem).returning();
  await persistDb();
  return result[0];
}

export async function removeProgramItem(
  db: AnyDatabase,
  programId: string,
  itemId: string,
  userId: string
): Promise<boolean> {
  const access = await getProgramAccessForUser(db, programId, userId);
  if (!access.canManage) {
    throw new Error("You do not have permission to modify this Program");
  }

  const rows = await db
    .select()
    .from(programItem)
    .where(
      and(eq(programItem.id, itemId), eq(programItem.programRef, programId))
    )
    .limit(1);

  if (rows.length === 0 || rows[0].deleted === 1) {
    return false;
  }

  await db
    .update(programItem)
    .set({
      deleted: 1,
      syncVersion: (rows[0].syncVersion ?? 0) + 1,
      lastModifiedAt: nowIso(),
      deviceId: getLocalDeviceId(),
    })
    .where(eq(programItem.id, rows[0].id));

  await persistDb();
  return true;
}

export async function reorderProgramItems(
  db: AnyDatabase,
  programId: string,
  itemIdsInOrder: string[],
  userId: string
): Promise<void> {
  const access = await getProgramAccessForUser(db, programId, userId);
  if (!access.canManage) {
    throw new Error("You do not have permission to reorder this Program");
  }

  const existing = await db
    .select()
    .from(programItem)
    .where(
      and(eq(programItem.programRef, programId), eq(programItem.deleted, 0))
    );

  const existingIds = existing.map((row) => row.id).sort();
  const requestedIds = [...itemIdsInOrder].sort();
  if (
    existingIds.length !== requestedIds.length ||
    existingIds.some((id, index) => id !== requestedIds[index])
  ) {
    throw new Error(
      "Reorder payload must contain every active Program item exactly once"
    );
  }

  const offset = existing.length + 100;
  const now = nowIso();
  const existingById = new Map(existing.map((item) => [item.id, item]));

  for (const item of existing) {
    await db
      .update(programItem)
      .set({
        position: item.position + offset,
        syncVersion: (item.syncVersion ?? 0) + 1,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(programItem.id, item.id));
  }

  for (const [index, itemId] of itemIdsInOrder.entries()) {
    const existingItem = existingById.get(itemId);
    if (!existingItem) {
      throw new Error(
        "Reorder payload must contain every active Program item exactly once"
      );
    }

    await db
      .update(programItem)
      .set({
        position: index,
        syncVersion: (existingItem.syncVersion ?? 0) + 2,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(programItem.id, itemId));
  }

  await persistDb();
}

export async function getEligibleTuneSetsForProgram(
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
      const tuneSetRow = await assertTuneSetEligibleForProgram(
        db,
        tuneSetSummary.id,
        userId
      );
      eligible.push(tuneSetRow);
    } catch {}
  }

  return eligible;
}
