import { and, eq, inArray, or } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { supabase } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { persistDb } from "../client-sqlite";
import {
  groupMember,
  program,
  programItem,
  tuneSet,
  tuneSetItem,
  userGroup,
  userProfile,
} from "../schema";
import type {
  GroupMember as GroupMemberRow,
  NewGroupMember,
  NewUserGroup,
  UserGroup,
} from "../types";

type AnyDatabase = SqliteDatabase | BetterSQLite3Database;

export type GroupRole = "owner" | "admin" | "member";

export interface GroupAccess {
  role: GroupRole | null;
  canView: boolean;
  canManageMembership: boolean;
  canManageSets: boolean;
  group: UserGroup | null;
}

export interface GroupWithSummary extends UserGroup {
  ownerName: string | null;
  memberCount: number;
  currentUserRole: GroupRole | null;
  canManageMembership: boolean;
  canManageSets: boolean;
}

export interface GroupMemberWithProfile {
  membershipId: string | null;
  groupRef: string;
  userRef: string;
  role: GroupRole;
  effectiveRole: GroupRole;
  isOwner: boolean;
  deleted: number;
  joinedAt: string;
  lastModifiedAt: string;
  profileName: string | null;
  profileEmail: string | null;
}

export interface GroupMemberCandidate {
  userRef: string;
  profileName: string | null;
  profileEmail: string | null;
  membershipId: string | null;
  effectiveRole: GroupRole;
  isOwner: boolean;
  canAdd: boolean;
}

interface GroupMemberSearchProfile {
  userRef: string;
  profileName: string | null;
  profileEmail: string | null;
}

interface GroupMemberSearchContext {
  ownerUserRef: string;
  membershipsByUserRef: Map<string, GroupMemberRow>;
}

interface RemoteGroupMemberProfileRow {
  id: string;
  name: string | null;
  email: string | null;
}

async function getRemoteGroupMemberProfileMap(
  groupId: string
): Promise<Map<string, GroupMemberSearchProfile>> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("get_group_member_profiles", {
    p_group_id: groupId,
  });

  if (error) {
    console.warn("Failed to fetch remote group member profiles", error);
    return new Map();
  }

  if (!Array.isArray(data)) {
    return new Map();
  }

  return new Map(
    data.filter(isRemoteGroupMemberProfileRow).map((profile) => [
      profile.id,
      {
        userRef: profile.id,
        profileName: profile.name,
        profileEmail: profile.email,
      },
    ])
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function getLocalDeviceId(): string {
  return "local";
}

function normalizeDescription(description?: string | null): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

function normalizeGroupName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Group name must not be empty");
  }
  return trimmed;
}

async function getMembershipRecord(
  db: AnyDatabase,
  groupId: string,
  userId: string
): Promise<GroupMemberRow | null> {
  const memberships = await db
    .select()
    .from(groupMember)
    .where(
      and(
        eq(groupMember.groupRef, groupId),
        eq(groupMember.userRef, userId),
        eq(groupMember.deleted, 0)
      )
    )
    .limit(1);

  return memberships[0] ?? null;
}

async function getUserName(
  db: AnyDatabase,
  userId: string
): Promise<string | null> {
  const rows = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.id, userId))
    .limit(1);

  return rows[0]?.name ?? null;
}

async function getUserProfileRecord(
  db: AnyDatabase,
  userId: string
): Promise<{ name: string | null; email: string | null } | null> {
  const rows = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.id, userId))
    .limit(1);

  const row = rows[0];
  return row
    ? {
        name: row.name ?? null,
        email: row.email ?? null,
      }
    : null;
}

function isRemoteGroupMemberProfileRow(
  value: unknown
): value is RemoteGroupMemberProfileRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    (typeof row.name === "string" || row.name === null) &&
    (typeof row.email === "string" || row.email === null)
  );
}

function mergeGroupMemberSearchProfile(
  existing: GroupMemberSearchProfile | undefined,
  incoming: GroupMemberSearchProfile
): GroupMemberSearchProfile {
  if (!existing) {
    return incoming;
  }

  return {
    userRef: existing.userRef,
    profileName: existing.profileName ?? incoming.profileName,
    profileEmail: existing.profileEmail ?? incoming.profileEmail,
  };
}

function toGroupMemberCandidate(
  profile: GroupMemberSearchProfile,
  context: GroupMemberSearchContext
): GroupMemberCandidate {
  const membership = context.membershipsByUserRef.get(profile.userRef);
  const isOwner = profile.userRef === context.ownerUserRef;

  return {
    userRef: profile.userRef,
    profileName: profile.profileName,
    profileEmail: profile.profileEmail,
    membershipId: membership?.id ?? null,
    effectiveRole: isOwner
      ? "owner"
      : ((membership?.role as GroupRole | undefined) ?? "member"),
    isOwner,
    canAdd: !isOwner && !membership,
  };
}

function filterAndSortGroupMemberCandidates(
  profiles: GroupMemberSearchProfile[],
  searchTerm: string,
  context: GroupMemberSearchContext,
  limit: number
): GroupMemberCandidate[] {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  if (normalizedTerm.length < 2) {
    return [];
  }

  const mergedProfiles = new Map<string, GroupMemberSearchProfile>();
  for (const profile of profiles) {
    mergedProfiles.set(
      profile.userRef,
      mergeGroupMemberSearchProfile(
        mergedProfiles.get(profile.userRef),
        profile
      )
    );
  }

  return Array.from(mergedProfiles.values())
    .filter((profile) => {
      const haystack = [
        profile.userRef,
        profile.profileName ?? "",
        profile.profileEmail ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedTerm);
    })
    .map((profile) => toGroupMemberCandidate(profile, context))
    .sort((left, right) => {
      if (left.canAdd !== right.canAdd) {
        return left.canAdd ? -1 : 1;
      }
      const leftName = (
        left.profileName ??
        left.profileEmail ??
        left.userRef
      ).toLowerCase();
      const rightName = (
        right.profileName ??
        right.profileEmail ??
        right.userRef
      ).toLowerCase();
      return leftName.localeCompare(rightName);
    })
    .slice(0, limit);
}

async function getGroupMemberSearchContext(
  db: AnyDatabase,
  groupId: string,
  actingUserId: string
): Promise<GroupMemberSearchContext | null> {
  const access = await getGroupAccessForUser(db, groupId, actingUserId);
  if (!access.canManageMembership || !access.group) {
    return null;
  }

  const memberships = await db
    .select()
    .from(groupMember)
    .where(and(eq(groupMember.groupRef, groupId), eq(groupMember.deleted, 0)));

  return {
    ownerUserRef: access.group.ownerUserRef,
    membershipsByUserRef: new Map(
      memberships.map((membership) => [membership.userRef, membership])
    ),
  };
}

async function getLocalGroupMemberSearchProfiles(
  db: AnyDatabase
): Promise<GroupMemberSearchProfile[]> {
  const profiles = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.deleted, 0));

  return profiles.map((profile) => ({
    userRef: profile.id,
    profileName: profile.name ?? null,
    profileEmail: profile.email ?? null,
  }));
}

async function searchRemoteGroupMemberProfiles(
  groupId: string,
  searchTerm: string,
  limit: number
): Promise<GroupMemberSearchProfile[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return [];
  }

  const { data, error } = await supabase.rpc("search_group_member_profiles", {
    p_group_id: groupId,
    p_search_term: searchTerm.trim(),
    p_limit: limit,
  });

  if (error) {
    console.warn("Failed to search remote group member profiles", error);
    return [];
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(isRemoteGroupMemberProfileRow).map((profile) => ({
    userRef: profile.id,
    profileName: profile.name,
    profileEmail: profile.email,
  }));
}

export async function getAccessibleGroupIds(
  db: AnyDatabase,
  userId: string,
  includeDeleted = false
): Promise<string[]> {
  const memberships = await db
    .select()
    .from(groupMember)
    .where(and(eq(groupMember.userRef, userId), eq(groupMember.deleted, 0)));
  const membershipGroupIds = memberships.map(
    (membership) => membership.groupRef
  );

  const visibilityConditions = [eq(userGroup.ownerUserRef, userId)];
  if (membershipGroupIds.length > 0) {
    visibilityConditions.push(inArray(userGroup.id, membershipGroupIds));
  }

  const filters = [or(...visibilityConditions)];
  if (!includeDeleted) {
    filters.push(eq(userGroup.deleted, 0));
  }

  const groups = await db
    .select()
    .from(userGroup)
    .where(and(...filters));

  return groups.map((group) => group.id);
}

export async function getGroupAccessForUser(
  db: AnyDatabase,
  groupId: string,
  userId: string
): Promise<GroupAccess> {
  const groups = await db
    .select()
    .from(userGroup)
    .where(eq(userGroup.id, groupId))
    .limit(1);

  const currentGroup = groups[0] ?? null;
  if (!currentGroup || currentGroup.deleted === 1) {
    return {
      role: null,
      canView: false,
      canManageMembership: false,
      canManageSets: false,
      group: currentGroup,
    };
  }

  if (currentGroup.ownerUserRef === userId) {
    return {
      role: "owner",
      canView: true,
      canManageMembership: true,
      canManageSets: true,
      group: currentGroup,
    };
  }

  const membership = await getMembershipRecord(db, groupId, userId);
  if (!membership) {
    return {
      role: null,
      canView: false,
      canManageMembership: false,
      canManageSets: false,
      group: currentGroup,
    };
  }

  const role = membership.role as GroupRole;
  return {
    role,
    canView: true,
    canManageMembership: false,
    canManageSets: role === "admin",
    group: currentGroup,
  };
}

export async function getVisibleGroups(
  db: AnyDatabase,
  userId: string,
  includeDeleted = false
): Promise<GroupWithSummary[]> {
  const accessibleGroupIds = await getAccessibleGroupIds(
    db,
    userId,
    includeDeleted
  );
  if (accessibleGroupIds.length === 0) {
    return [];
  }

  const filters = [inArray(userGroup.id, accessibleGroupIds)];
  if (!includeDeleted) {
    filters.push(eq(userGroup.deleted, 0));
  }

  const groups = await db
    .select()
    .from(userGroup)
    .where(and(...filters));

  return Promise.all(
    groups.map(async (group) => {
      const membership = await getMembershipRecord(db, group.id, userId);
      const members = await db
        .select()
        .from(groupMember)
        .where(
          and(eq(groupMember.groupRef, group.id), eq(groupMember.deleted, 0))
        );

      const currentUserRole =
        group.ownerUserRef === userId
          ? ("owner" as const)
          : ((membership?.role as GroupRole | undefined) ?? null);

      return {
        ...group,
        ownerName: await getUserName(db, group.ownerUserRef),
        memberCount: members.length + 1,
        currentUserRole,
        canManageMembership: currentUserRole === "owner",
        canManageSets:
          currentUserRole === "owner" || currentUserRole === "admin",
      };
    })
  );
}

export async function getGroupById(
  db: AnyDatabase,
  groupId: string,
  userId: string
): Promise<UserGroup | null> {
  const access = await getGroupAccessForUser(db, groupId, userId);
  return access.canView ? access.group : null;
}

export async function createGroup(
  db: AnyDatabase,
  userId: string,
  data: { name: string; description?: string | null }
): Promise<UserGroup> {
  const now = nowIso();
  const newGroup: NewUserGroup = {
    id: generateId(),
    ownerUserRef: userId,
    name: normalizeGroupName(data.name),
    description: normalizeDescription(data.description),
    deleted: 0,
    createdAt: now,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(userGroup).values(newGroup).returning();
  if (result.length === 0) {
    throw new Error("Failed to create group");
  }

  await persistDb();
  return result[0];
}

export async function updateGroup(
  db: AnyDatabase,
  groupId: string,
  userId: string,
  data: { name?: string; description?: string | null }
): Promise<UserGroup | null> {
  const access = await getGroupAccessForUser(db, groupId, userId);
  if (!access.canManageMembership || !access.group) {
    return null;
  }

  const updateData: Partial<NewUserGroup> = {
    syncVersion: (access.group.syncVersion ?? 0) + 1,
    lastModifiedAt: nowIso(),
    deviceId: getLocalDeviceId(),
  };

  if (data.name !== undefined) {
    updateData.name = normalizeGroupName(data.name);
  }
  if (data.description !== undefined) {
    updateData.description = normalizeDescription(data.description);
  }

  const result = await db
    .update(userGroup)
    .set(updateData)
    .where(eq(userGroup.id, groupId))
    .returning();

  await persistDb();
  return result[0] ?? null;
}

export async function deleteGroup(
  db: AnyDatabase,
  groupId: string,
  userId: string
): Promise<boolean> {
  const access = await getGroupAccessForUser(db, groupId, userId);
  if (!access.canManageMembership || !access.group) {
    return false;
  }

  const now = nowIso();
  const groupMemberships = await db
    .select()
    .from(groupMember)
    .where(and(eq(groupMember.groupRef, groupId), eq(groupMember.deleted, 0)));
  const groupSets = await db
    .select()
    .from(tuneSet)
    .where(and(eq(tuneSet.groupRef, groupId), eq(tuneSet.deleted, 0)));
  const setIds = groupSets.map((setRecord) => setRecord.id);
  const groupPrograms = await db
    .select()
    .from(program)
    .where(and(eq(program.groupRef, groupId), eq(program.deleted, 0)));
  const programIds = groupPrograms.map((programRecord) => programRecord.id);
  const activeSetItems =
    setIds.length === 0
      ? []
      : await db
          .select()
          .from(tuneSetItem)
          .where(
            and(
              inArray(tuneSetItem.tuneSetRef, setIds),
              eq(tuneSetItem.deleted, 0)
            )
          );
  const activeProgramItems =
    programIds.length === 0
      ? []
      : await db
          .select()
          .from(programItem)
          .where(
            and(
              inArray(programItem.programRef, programIds),
              eq(programItem.deleted, 0)
            )
          );

  await db
    .update(userGroup)
    .set({
      deleted: 1,
      syncVersion: (access.group.syncVersion ?? 0) + 1,
      lastModifiedAt: now,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(userGroup.id, groupId));

  for (const membership of groupMemberships) {
    await db
      .update(groupMember)
      .set({
        deleted: 1,
        syncVersion: (membership.syncVersion ?? 0) + 1,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(groupMember.id, membership.id));
  }

  if (setIds.length > 0) {
    for (const setRecord of groupSets) {
      await db
        .update(tuneSet)
        .set({
          deleted: 1,
          syncVersion: (setRecord.syncVersion ?? 0) + 1,
          lastModifiedAt: now,
          deviceId: getLocalDeviceId(),
        })
        .where(eq(tuneSet.id, setRecord.id));
    }

    for (const setItem of activeSetItems) {
      await db
        .update(tuneSetItem)
        .set({
          deleted: 1,
          syncVersion: (setItem.syncVersion ?? 0) + 1,
          lastModifiedAt: now,
          deviceId: getLocalDeviceId(),
        })
        .where(eq(tuneSetItem.id, setItem.id));
    }
  }

  if (programIds.length > 0) {
    for (const programRecord of groupPrograms) {
      await db
        .update(program)
        .set({
          deleted: 1,
          syncVersion: (programRecord.syncVersion ?? 0) + 1,
          lastModifiedAt: now,
          deviceId: getLocalDeviceId(),
        })
        .where(eq(program.id, programRecord.id));
    }

    for (const item of activeProgramItems) {
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
  }

  await persistDb();
  return true;
}

export async function getGroupMembers(
  db: AnyDatabase,
  groupId: string,
  userId: string,
  includeDeleted = false
): Promise<GroupMemberWithProfile[]> {
  const access = await getGroupAccessForUser(db, groupId, userId);
  if (!access.canView || !access.group) {
    return [];
  }

  const filters = [eq(groupMember.groupRef, groupId)];
  if (!includeDeleted) {
    filters.push(eq(groupMember.deleted, 0));
  }

  const memberships = await db
    .select()
    .from(groupMember)
    .where(and(...filters))
    .orderBy(groupMember.joinedAt);

  const localProfileRecords = new Map<
    string,
    { name: string | null; email: string | null } | null
  >();
  const getLocalProfile = async (targetUserId: string) => {
    if (!localProfileRecords.has(targetUserId)) {
      localProfileRecords.set(
        targetUserId,
        await getUserProfileRecord(db, targetUserId)
      );
    }
    return localProfileRecords.get(targetUserId) ?? null;
  };

  const missingProfileUserRefs = new Set<string>();
  const ownerLocalProfile = await getLocalProfile(access.group.ownerUserRef);
  if (!ownerLocalProfile?.name && !ownerLocalProfile?.email) {
    missingProfileUserRefs.add(access.group.ownerUserRef);
  }

  for (const membership of memberships) {
    if (membership.userRef === access.group.ownerUserRef) {
      continue;
    }
    const localProfile = await getLocalProfile(membership.userRef);
    if (!localProfile?.name && !localProfile?.email) {
      missingProfileUserRefs.add(membership.userRef);
    }
  }

  const remoteProfileMap =
    missingProfileUserRefs.size > 0
      ? await getRemoteGroupMemberProfileMap(groupId)
      : new Map<string, GroupMemberSearchProfile>();

  const getMergedProfile = async (targetUserId: string) => {
    const localProfile = await getLocalProfile(targetUserId);
    const remoteProfile = remoteProfileMap.get(targetUserId);
    return {
      name: localProfile?.name ?? remoteProfile?.profileName ?? null,
      email: localProfile?.email ?? remoteProfile?.profileEmail ?? null,
    };
  };

  const members: GroupMemberWithProfile[] = [
    {
      membershipId: null,
      groupRef: groupId,
      userRef: access.group.ownerUserRef,
      role: "owner",
      effectiveRole: "owner",
      isOwner: true,
      deleted: 0,
      joinedAt: access.group.createdAt,
      lastModifiedAt: access.group.lastModifiedAt,
      profileName: (await getMergedProfile(access.group.ownerUserRef)).name,
      profileEmail: (await getMergedProfile(access.group.ownerUserRef)).email,
    },
  ];

  for (const membership of memberships) {
    if (membership.userRef === access.group.ownerUserRef) {
      continue;
    }

    const role = membership.role as GroupRole;
    const profile = await getMergedProfile(membership.userRef);
    members.push({
      membershipId: membership.id,
      groupRef: membership.groupRef,
      userRef: membership.userRef,
      role,
      effectiveRole: role,
      isOwner: false,
      deleted: membership.deleted,
      joinedAt: membership.joinedAt,
      lastModifiedAt: membership.lastModifiedAt,
      profileName: profile.name,
      profileEmail: profile.email,
    });
  }

  return members;
}

export async function searchAvailableGroupMembers(
  db: AnyDatabase,
  groupId: string,
  actingUserId: string,
  searchTerm: string,
  limit = 8
): Promise<GroupMemberCandidate[]> {
  const context = await getGroupMemberSearchContext(db, groupId, actingUserId);
  if (!context) {
    return [];
  }
  const localProfiles = await getLocalGroupMemberSearchProfiles(db);
  return filterAndSortGroupMemberCandidates(
    localProfiles,
    searchTerm,
    context,
    limit
  );
}

export async function searchGroupMemberCandidates(
  db: AnyDatabase,
  groupId: string,
  actingUserId: string,
  searchTerm: string,
  limit = 8
): Promise<GroupMemberCandidate[]> {
  const context = await getGroupMemberSearchContext(db, groupId, actingUserId);
  if (!context) {
    return [];
  }

  const localProfiles = await getLocalGroupMemberSearchProfiles(db);
  const remoteProfiles = await searchRemoteGroupMemberProfiles(
    groupId,
    searchTerm,
    limit
  );

  return filterAndSortGroupMemberCandidates(
    [...localProfiles, ...remoteProfiles],
    searchTerm,
    context,
    limit
  );
}

export async function addGroupMember(
  db: AnyDatabase,
  groupId: string,
  actingUserId: string,
  memberUserId: string,
  role: Exclude<GroupRole, "owner"> = "member"
): Promise<GroupMemberRow> {
  const access = await getGroupAccessForUser(db, groupId, actingUserId);
  if (!access.canManageMembership || !access.group) {
    throw new Error("Only the group owner can manage memberships");
  }
  if (memberUserId === access.group.ownerUserRef) {
    throw new Error("Group owner is already part of the group");
  }

  const now = nowIso();
  const existing = await db
    .select()
    .from(groupMember)
    .where(
      and(
        eq(groupMember.groupRef, groupId),
        eq(groupMember.userRef, memberUserId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    const result = await db
      .update(groupMember)
      .set({
        role,
        deleted: 0,
        syncVersion: (current.syncVersion ?? 0) + 1,
        lastModifiedAt: now,
        deviceId: getLocalDeviceId(),
      })
      .where(eq(groupMember.id, current.id))
      .returning();
    await persistDb();
    return result[0];
  }

  const newMembership: NewGroupMember = {
    id: generateId(),
    groupRef: groupId,
    userRef: memberUserId,
    role,
    deleted: 0,
    joinedAt: now,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: getLocalDeviceId(),
  };

  const result = await db.insert(groupMember).values(newMembership).returning();
  await persistDb();
  return result[0];
}

export async function updateGroupMemberRole(
  db: AnyDatabase,
  groupId: string,
  membershipId: string,
  actingUserId: string,
  role: Exclude<GroupRole, "owner">
): Promise<GroupMemberRow | null> {
  const access = await getGroupAccessForUser(db, groupId, actingUserId);
  if (!access.canManageMembership) {
    throw new Error("Only the group owner can manage memberships");
  }

  const memberships = await db
    .select()
    .from(groupMember)
    .where(
      and(eq(groupMember.id, membershipId), eq(groupMember.groupRef, groupId))
    )
    .limit(1);

  if (memberships.length === 0 || memberships[0].deleted === 1) {
    return null;
  }

  const now = nowIso();
  const result = await db
    .update(groupMember)
    .set({
      role,
      syncVersion: (memberships[0].syncVersion ?? 0) + 1,
      lastModifiedAt: now,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(groupMember.id, membershipId))
    .returning();

  await persistDb();
  return result[0] ?? null;
}

export async function removeGroupMember(
  db: AnyDatabase,
  groupId: string,
  membershipId: string,
  actingUserId: string
): Promise<boolean> {
  const access = await getGroupAccessForUser(db, groupId, actingUserId);
  if (!access.canManageMembership || !access.group) {
    throw new Error("Only the group owner can manage memberships");
  }

  const memberships = await db
    .select()
    .from(groupMember)
    .where(
      and(eq(groupMember.id, membershipId), eq(groupMember.groupRef, groupId))
    )
    .limit(1);

  if (memberships.length === 0 || memberships[0].deleted === 1) {
    return false;
  }
  if (memberships[0].userRef === access.group.ownerUserRef) {
    throw new Error("Cannot remove the group owner");
  }

  const now = nowIso();
  await db
    .update(groupMember)
    .set({
      deleted: 1,
      syncVersion: (memberships[0].syncVersion ?? 0) + 1,
      lastModifiedAt: now,
      deviceId: getLocalDeviceId(),
    })
    .where(eq(groupMember.id, membershipId));

  await persistDb();
  return true;
}
