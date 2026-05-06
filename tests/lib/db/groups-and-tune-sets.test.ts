import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addGroupMember,
  createGroup,
  getGroupById,
  getGroupMembers,
  getVisibleGroups,
  removeGroupMember,
  searchAvailableGroupMembers,
  searchGroupMemberCandidates,
  updateGroupMemberRole,
} from "../../../src/lib/db/queries/groups";
import {
  addTuneSetToSetlist,
  addTuneToSetlist,
  createSetlist,
  getSetlistById,
  getSetlistItems,
  getVisibleSetlists,
  removeSetlistItem,
  reorderSetlistItems,
  updateSetlist,
} from "../../../src/lib/db/queries/setlists";
import {
  addTuneToTuneSet,
  createTuneSet,
  createTuneSetFromTunes,
  getTuneSetById,
  getTuneSetItems,
  getVisibleTuneSets,
  removeTuneFromTuneSet,
  reorderTuneSetItems,
  updateTuneSet,
} from "../../../src/lib/db/queries/tune-sets";
import { applyMigrations } from "../../../src/lib/services/test-schema-loader";
import { supabase } from "../../../src/lib/supabase/client";

vi.mock("../../../src/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock("../../../src/lib/db/client-sqlite", () => ({
  persistDb: vi.fn(() => Promise.resolve()),
}));

const OWNER_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_ID = "00000000-0000-0000-0000-000000000002";
const MEMBER_ID = "00000000-0000-0000-0000-000000000003";
const OTHER_ID = "00000000-0000-0000-0000-000000000004";
const REMOTE_ID = "00000000-0000-0000-0000-000000000005";
const PUBLIC_TUNE_ID = "00000000-0000-0000-0000-000000000010";
const PRIVATE_TUNE_ID = "00000000-0000-0000-0000-000000000011";

let db: BetterSQLite3Database;
let sqlite: InstanceType<typeof Database>;

function seedUser(
  id: string,
  name: string,
  email = `${name.toLowerCase()}@example.com`
) {
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO user_profile (id, name, email, deleted, sync_version, last_modified_at, device_id)
       VALUES (?, ?, ?, 0, 1, ?, 'test')`
    )
    .run(id, name, email, new Date().toISOString());
}

function seedTune(id: string, title: string, privateFor: string | null = null) {
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO tune (id, title, private_for, deleted, sync_version, last_modified_at, device_id)
       VALUES (?, ?, ?, 0, 1, ?, 'test')`
    )
    .run(id, title, privateFor, new Date().toISOString());
}

beforeEach(() => {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: [],
    error: null,
  } as never);

  sqlite = new Database(":memory:");
  db = drizzle(sqlite) as BetterSQLite3Database;
  applyMigrations(db);

  seedUser(OWNER_ID, "Owner");
  seedUser(ADMIN_ID, "Admin");
  seedUser(MEMBER_ID, "Member");
  seedUser(OTHER_ID, "Other");
  seedTune(PUBLIC_TUNE_ID, "Public Tune", null);
  seedTune(PRIVATE_TUNE_ID, "Private Tune", OWNER_ID);
});

describe("group query helpers", () => {
  it("creates groups and exposes owner/member visibility with effective roles", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Session Band",
      description: "Weekly rehearsal",
    });

    await addGroupMember(db as never, group.id, OWNER_ID, MEMBER_ID, "member");

    const ownerGroups = await getVisibleGroups(db as never, OWNER_ID);
    expect(ownerGroups).toHaveLength(1);
    expect(ownerGroups[0].currentUserRole).toBe("owner");
    expect(ownerGroups[0].canManageMembership).toBe(true);
    expect(ownerGroups[0].memberCount).toBe(2);

    const memberGroups = await getVisibleGroups(db as never, MEMBER_ID);
    expect(memberGroups).toHaveLength(1);
    expect(memberGroups[0].currentUserRole).toBe("member");
    expect(memberGroups[0].canManageMembership).toBe(false);
    expect(memberGroups[0].canManageSets).toBe(false);
  });

  it("lists the synthetic owner row and restricts membership changes to the owner", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Quartet",
    });

    const adminMembership = await addGroupMember(
      db as never,
      group.id,
      OWNER_ID,
      ADMIN_ID,
      "admin"
    );

    const members = await getGroupMembers(db as never, group.id, OWNER_ID);
    expect(members.map((member) => member.userRef)).toEqual([
      OWNER_ID,
      ADMIN_ID,
    ]);
    expect(members[0].effectiveRole).toBe("owner");
    expect(members[1].effectiveRole).toBe("admin");
    expect(members[1].profileEmail).toBe("admin@example.com");

    await expect(
      addGroupMember(db as never, group.id, MEMBER_ID, OTHER_ID, "member")
    ).rejects.toThrow(/only the group owner/i);

    const updated = await updateGroupMemberRole(
      db as never,
      group.id,
      adminMembership.id,
      OWNER_ID,
      "member"
    );
    expect(updated?.role).toBe("member");

    const removed = await removeGroupMember(
      db as never,
      group.id,
      adminMembership.id,
      OWNER_ID
    );
    expect(removed).toBe(true);

    const remainingMembers = await getGroupMembers(
      db as never,
      group.id,
      OWNER_ID
    );
    expect(remainingMembers.map((member) => member.userRef)).toEqual([
      OWNER_ID,
    ]);
  });

  it("rejects attempts to add the owner as a member and revives removed memberships on re-add", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Revive Test",
    });

    await expect(
      addGroupMember(db as never, group.id, OWNER_ID, OWNER_ID, "member")
    ).rejects.toThrow(/group owner is already part of the group/i);

    const membership = await addGroupMember(
      db as never,
      group.id,
      OWNER_ID,
      MEMBER_ID,
      "member"
    );

    const removed = await removeGroupMember(
      db as never,
      group.id,
      membership.id,
      OWNER_ID
    );
    expect(removed).toBe(true);

    const revived = await addGroupMember(
      db as never,
      group.id,
      OWNER_ID,
      MEMBER_ID,
      "admin"
    );
    expect(revived.id).toBe(membership.id);
    expect(revived.deleted).toBe(0);
    expect(revived.role).toBe("admin");

    const members = await getGroupMembers(db as never, group.id, OWNER_ID);
    expect(members.map((member) => member.userRef)).toEqual([
      OWNER_ID,
      MEMBER_ID,
    ]);
    expect(members[1].effectiveRole).toBe("admin");
  });

  it("returns null or false for missing/deleted memberships and blocks owner removal", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Edge Cases",
    });

    const membership = await addGroupMember(
      db as never,
      group.id,
      OWNER_ID,
      MEMBER_ID,
      "member"
    );

    await expect(
      removeGroupMember(db as never, group.id, membership.id, MEMBER_ID)
    ).rejects.toThrow(/only the group owner/i);

    const ownerMembership = await addGroupMember(
      db as never,
      group.id,
      OWNER_ID,
      OTHER_ID,
      "member"
    );
    sqlite
      .prepare("UPDATE group_member SET user_ref = ? WHERE id = ?")
      .run(OWNER_ID, ownerMembership.id);

    await expect(
      removeGroupMember(db as never, group.id, ownerMembership.id, OWNER_ID)
    ).rejects.toThrow(/cannot remove the group owner/i);

    expect(
      await updateGroupMemberRole(
        db as never,
        group.id,
        "00000000-0000-0000-0000-00000000ffff",
        OWNER_ID,
        "admin"
      )
    ).toBeNull();

    expect(
      await removeGroupMember(
        db as never,
        group.id,
        "00000000-0000-0000-0000-00000000ffff",
        OWNER_ID
      )
    ).toBe(false);

    await removeGroupMember(db as never, group.id, membership.id, OWNER_ID);

    expect(
      await updateGroupMemberRole(
        db as never,
        group.id,
        membership.id,
        OWNER_ID,
        "admin"
      )
    ).toBeNull();

    expect(
      await removeGroupMember(db as never, group.id, membership.id, OWNER_ID)
    ).toBe(false);
  });

  it("hydrates missing member profile fields from the secure remote member-profile lookup", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Remote Names",
    });

    await addGroupMember(db as never, group.id, OWNER_ID, MEMBER_ID, "member");
    sqlite
      .prepare("UPDATE user_profile SET name = NULL, email = NULL WHERE id = ?")
      .run(MEMBER_ID);

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [
        {
          id: MEMBER_ID,
          name: "Member Remote",
          email: "member.remote@example.com",
        },
      ],
      error: null,
    } as never);

    const members = await getGroupMembers(db as never, group.id, OWNER_ID);
    expect(supabase.rpc).toHaveBeenCalledWith("get_group_member_profiles", {
      p_group_id: group.id,
    });
    expect(members[1].profileName).toBe("Member Remote");
    expect(members[1].profileEmail).toBe("member.remote@example.com");
  });

  it("searches local profiles for membership management and marks existing members", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Quintet",
    });

    await addGroupMember(db as never, group.id, OWNER_ID, MEMBER_ID, "member");

    const candidates = await searchAvailableGroupMembers(
      db as never,
      group.id,
      OWNER_ID,
      "o"
    );
    expect(candidates).toEqual([]);

    const broaderCandidates = await searchAvailableGroupMembers(
      db as never,
      group.id,
      OWNER_ID,
      "er"
    );
    expect(broaderCandidates.map((candidate) => candidate.userRef)).toEqual([
      OTHER_ID,
      MEMBER_ID,
      OWNER_ID,
    ]);
    expect(broaderCandidates.map((candidate) => candidate.canAdd)).toEqual([
      true,
      false,
      false,
    ]);
    expect(
      broaderCandidates.map((candidate) => candidate.effectiveRole)
    ).toEqual(["member", "member", "owner"]);
    expect(broaderCandidates[1].membershipId).not.toBeNull();
    expect(broaderCandidates[0].profileEmail).toBe("other@example.com");
  });

  it("merges secure remote directory matches without widening local profile sync", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Gig Band",
    });

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          id: REMOTE_ID,
          name: "Alice Remote",
          email: "alice@example.com",
        },
      ],
      error: null,
    } as never);

    const candidates = await searchGroupMemberCandidates(
      db as never,
      group.id,
      OWNER_ID,
      "alice"
    );

    expect(supabase.rpc).toHaveBeenCalledWith("search_group_member_profiles", {
      p_group_id: group.id,
      p_search_term: "alice",
      p_limit: 8,
    });
    expect(candidates).toEqual([
      expect.objectContaining({
        userRef: REMOTE_ID,
        profileName: "Alice Remote",
        profileEmail: "alice@example.com",
        membershipId: null,
        effectiveRole: "member",
        isOwner: false,
        canAdd: true,
      }),
    ]);
  });
});

describe("tune set query helpers", () => {
  it("supports personal tune set CRUD and ordered tune membership", async () => {
    const set = await createTuneSet(db as never, OWNER_ID, {
      name: "Warmups",
      setKind: "practice_set",
    });

    await addTuneToTuneSet(db as never, set.id, PUBLIC_TUNE_ID, OWNER_ID);
    await addTuneToTuneSet(db as never, set.id, PRIVATE_TUNE_ID, OWNER_ID);

    const visibleSets = await getVisibleTuneSets(db as never, OWNER_ID, {
      setKind: "practice_set",
    });
    expect(visibleSets).toHaveLength(1);
    expect(visibleSets[0].tuneCount).toBe(2);
    expect(visibleSets[0].canManage).toBe(true);

    const items = await getTuneSetItems(db as never, set.id, OWNER_ID);
    expect(items.map((item) => item.tuneRef)).toEqual([
      PUBLIC_TUNE_ID,
      PRIVATE_TUNE_ID,
    ]);
    expect(items.map((item) => item.position)).toEqual([0, 1]);

    await reorderTuneSetItems(
      db as never,
      set.id,
      [items[1].id, items[0].id],
      OWNER_ID
    );
    const reordered = await getTuneSetItems(db as never, set.id, OWNER_ID);
    expect(reordered.map((item) => item.tuneRef)).toEqual([
      PRIVATE_TUNE_ID,
      PUBLIC_TUNE_ID,
    ]);
    expect(reordered.map((item) => item.position)).toEqual([0, 1]);

    const updatedSet = await updateTuneSet(db as never, set.id, OWNER_ID, {
      name: "Warmups Updated",
      description: "Short practice list",
    });
    expect(updatedSet?.name).toBe("Warmups Updated");
    expect(updatedSet?.description).toBe("Short practice list");

    const removed = await removeTuneFromTuneSet(
      db as never,
      set.id,
      PUBLIC_TUNE_ID,
      OWNER_ID
    );
    expect(removed).toBe(true);
    const remainingItems = await getTuneSetItems(db as never, set.id, OWNER_ID);
    expect(remainingItems).toHaveLength(1);
    expect(remainingItems[0].tuneRef).toBe(PRIVATE_TUNE_ID);
  });

  it("creates a personal tune set from an ordered tune selection", async () => {
    const createdSet = await createTuneSetFromTunes(db as never, OWNER_ID, {
      name: "Opening Set",
      tuneIds: [PRIVATE_TUNE_ID, PUBLIC_TUNE_ID],
    });

    expect(createdSet.ownerUserRef).toBe(OWNER_ID);
    expect(createdSet.groupRef).toBeNull();
    expect(createdSet.name).toBe("Opening Set");

    const items = await getTuneSetItems(db as never, createdSet.id, OWNER_ID);
    expect(items.map((item) => item.tuneRef)).toEqual([
      PRIVATE_TUNE_ID,
      PUBLIC_TUNE_ID,
    ]);
    expect(items.map((item) => item.position)).toEqual([0, 1]);
  });

  it("allows owner/admin Setlist management while keeping members read-only", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Ceili Band",
    });
    await addGroupMember(db as never, group.id, OWNER_ID, ADMIN_ID, "admin");
    await addGroupMember(db as never, group.id, OWNER_ID, MEMBER_ID, "member");

    const createdSetlist = await createSetlist(db as never, OWNER_ID, {
      name: "Setlist 1",
      groupRef: group.id,
    });

    await addTuneToSetlist(
      db as never,
      createdSetlist.id,
      PUBLIC_TUNE_ID,
      ADMIN_ID
    );
    const adminUpdated = await updateSetlist(
      db as never,
      createdSetlist.id,
      ADMIN_ID,
      {
        name: "Setlist 1 Updated",
      }
    );
    expect(adminUpdated?.name).toBe("Setlist 1 Updated");

    const memberVisible = await getVisibleSetlists(db as never, MEMBER_ID, {
      groupId: group.id,
    });
    expect(memberVisible).toHaveLength(1);
    expect(memberVisible[0].canManage).toBe(false);

    await expect(
      updateSetlist(db as never, createdSetlist.id, MEMBER_ID, { name: "Nope" })
    ).rejects.toThrow(/permission/i);
    await expect(
      addTuneToSetlist(
        db as never,
        createdSetlist.id,
        PRIVATE_TUNE_ID,
        MEMBER_ID
      )
    ).rejects.toThrow(/permission/i);
  });

  it("can build a Setlist from mixed Tune and Tune Set items", async () => {
    const personalSet = await createTuneSet(db as never, OWNER_ID, {
      name: "Personal Favorites",
      setKind: "practice_set",
    });
    await addTuneToTuneSet(
      db as never,
      personalSet.id,
      PUBLIC_TUNE_ID,
      OWNER_ID
    );

    const group = await createGroup(db as never, OWNER_ID, {
      name: "Festival Set",
    });
    const createdSetlist = await createSetlist(db as never, OWNER_ID, {
      groupRef: group.id,
      name: "Festival Opening Setlist",
    });

    await addTuneToSetlist(
      db as never,
      createdSetlist.id,
      PUBLIC_TUNE_ID,
      OWNER_ID
    );
    await addTuneSetToSetlist(
      db as never,
      createdSetlist.id,
      personalSet.id,
      OWNER_ID
    );
    await addTuneToSetlist(
      db as never,
      createdSetlist.id,
      PUBLIC_TUNE_ID,
      OWNER_ID
    );

    const setlistItems = await getSetlistItems(
      db as never,
      createdSetlist.id,
      OWNER_ID
    );
    expect(setlistItems.map((item) => item.itemKind)).toEqual([
      "tune",
      "tune_set",
      "tune",
    ]);
    expect(setlistItems[0].tune?.title).toBe("Public Tune");
    expect(setlistItems[1].tuneSet?.name).toBe("Personal Favorites");
    expect(setlistItems[2].tune?.title).toBe("Public Tune");
  });

  it("touches the parent Setlist when Setlist items change", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Festival Set",
    });
    const personalSet = await createTuneSet(db as never, OWNER_ID, {
      name: "Personal Favorites",
      setKind: "practice_set",
    });
    const originalTuneSet = await getTuneSetById(
      db as never,
      personalSet.id,
      OWNER_ID
    );
    const createdSetlist = await createSetlist(db as never, OWNER_ID, {
      groupRef: group.id,
      name: "Festival Opening Setlist",
    });

    const originalSetlist = await getSetlistById(
      db as never,
      createdSetlist.id,
      OWNER_ID
    );
    const originalGroup = await getGroupById(db as never, group.id, OWNER_ID);
    expect(originalSetlist).not.toBeNull();
    expect(originalGroup).not.toBeNull();
    expect(originalTuneSet).not.toBeNull();

    await addTuneToSetlist(
      db as never,
      createdSetlist.id,
      PUBLIC_TUNE_ID,
      OWNER_ID
    );

    const afterAdd = await getSetlistById(
      db as never,
      createdSetlist.id,
      OWNER_ID
    );
    const afterAddGroup = await getGroupById(db as never, group.id, OWNER_ID);
    expect(afterAdd?.syncVersion).toBeGreaterThan(originalSetlist!.syncVersion);
    expect(afterAddGroup?.syncVersion).toBeGreaterThan(
      originalGroup!.syncVersion
    );

    await addTuneSetToSetlist(
      db as never,
      createdSetlist.id,
      personalSet.id,
      OWNER_ID
    );

    const afterSetAdd = await getTuneSetById(
      db as never,
      personalSet.id,
      OWNER_ID
    );
    expect(afterSetAdd?.syncVersion).toBeGreaterThan(
      originalTuneSet!.syncVersion
    );

    const items = await getSetlistItems(
      db as never,
      createdSetlist.id,
      OWNER_ID
    );
    await reorderSetlistItems(
      db as never,
      createdSetlist.id,
      items.map((item) => item.id),
      OWNER_ID
    );

    const afterReorder = await getSetlistById(
      db as never,
      createdSetlist.id,
      OWNER_ID
    );
    const afterReorderGroup = await getGroupById(
      db as never,
      group.id,
      OWNER_ID
    );
    expect(afterReorder?.syncVersion).toBeGreaterThan(afterAdd!.syncVersion);
    expect(afterReorderGroup?.syncVersion).toBeGreaterThan(
      afterAddGroup!.syncVersion
    );

    await removeSetlistItem(
      db as never,
      createdSetlist.id,
      items[0].id,
      OWNER_ID
    );

    const afterRemove = await getSetlistById(
      db as never,
      createdSetlist.id,
      OWNER_ID
    );
    const afterRemoveGroup = await getGroupById(
      db as never,
      group.id,
      OWNER_ID
    );
    expect(afterRemove?.syncVersion).toBeGreaterThan(afterReorder!.syncVersion);
    expect(afterRemoveGroup?.syncVersion).toBeGreaterThan(
      afterReorderGroup!.syncVersion
    );
  });

  it("blocks adding a Tune Set with private tunes to a Setlist", async () => {
    const personalSet = await createTuneSet(db as never, OWNER_ID, {
      name: "Private Favorites",
      setKind: "practice_set",
    });
    await addTuneToTuneSet(
      db as never,
      personalSet.id,
      PRIVATE_TUNE_ID,
      OWNER_ID
    );

    const group = await createGroup(db as never, OWNER_ID, {
      name: "Festival Set",
    });
    const createdSetlist = await createSetlist(db as never, OWNER_ID, {
      groupRef: group.id,
      name: "Festival Opening Setlist",
    });

    await expect(
      addTuneSetToSetlist(
        db as never,
        createdSetlist.id,
        personalSet.id,
        OWNER_ID
      )
    ).rejects.toThrow(
      /only tune sets containing public tunes can be added to a setlist/i
    );
  });
});
