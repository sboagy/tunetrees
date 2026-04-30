import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addGroupMember,
  createGroup,
  getGroupMembers,
  getVisibleGroups,
  removeGroupMember,
  updateGroupMemberRole,
} from "../../../src/lib/db/queries/groups";
import {
  addTuneToTuneSet,
  cloneTuneSetToGroupSetlist,
  createTuneSet,
  createTuneSetFromTunes,
  getTuneSetItems,
  getVisibleTuneSets,
  removeTuneFromTuneSet,
  reorderTuneSetItems,
  updateTuneSet,
} from "../../../src/lib/db/queries/tune-sets";
import { applyMigrations } from "../../../src/lib/services/test-schema-loader";

vi.mock("../../../src/lib/db/client-sqlite", () => ({
  persistDb: vi.fn(() => Promise.resolve()),
}));

const OWNER_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_ID = "00000000-0000-0000-0000-000000000002";
const MEMBER_ID = "00000000-0000-0000-0000-000000000003";
const OTHER_ID = "00000000-0000-0000-0000-000000000004";
const PUBLIC_TUNE_ID = "00000000-0000-0000-0000-000000000010";
const PRIVATE_TUNE_ID = "00000000-0000-0000-0000-000000000011";

let db: BetterSQLite3Database;
let sqlite: InstanceType<typeof Database>;

function seedUser(id: string, name: string) {
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO user_profile (id, name, deleted, sync_version, last_modified_at, device_id)
       VALUES (?, ?, 0, 1, ?, 'test')`
    )
    .run(id, name, new Date().toISOString());
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

  it("allows owner/admin group setlist management while keeping members read-only", async () => {
    const group = await createGroup(db as never, OWNER_ID, {
      name: "Ceili Band",
    });
    await addGroupMember(db as never, group.id, OWNER_ID, ADMIN_ID, "admin");
    await addGroupMember(db as never, group.id, OWNER_ID, MEMBER_ID, "member");

    const set = await createTuneSet(db as never, OWNER_ID, {
      name: "Set 1",
      groupRef: group.id,
      setKind: "group_setlist",
    });

    await addTuneToTuneSet(db as never, set.id, PUBLIC_TUNE_ID, ADMIN_ID);
    const adminUpdated = await updateTuneSet(db as never, set.id, ADMIN_ID, {
      name: "Set 1 Updated",
    });
    expect(adminUpdated?.name).toBe("Set 1 Updated");

    const memberVisible = await getVisibleTuneSets(db as never, MEMBER_ID, {
      setKind: "group_setlist",
    });
    expect(memberVisible).toHaveLength(1);
    expect(memberVisible[0].canManage).toBe(false);

    await expect(
      updateTuneSet(db as never, set.id, MEMBER_ID, { name: "Nope" })
    ).rejects.toThrow(/permission/i);
    await expect(
      addTuneToTuneSet(db as never, set.id, PRIVATE_TUNE_ID, MEMBER_ID)
    ).rejects.toThrow(/permission/i);
  });

  it("can clone a visible personal tune set into a managed group setlist", async () => {
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
    await addTuneToTuneSet(
      db as never,
      personalSet.id,
      PRIVATE_TUNE_ID,
      OWNER_ID
    );

    const group = await createGroup(db as never, OWNER_ID, {
      name: "Festival Set",
    });
    const cloned = await cloneTuneSetToGroupSetlist(
      db as never,
      personalSet.id,
      group.id,
      OWNER_ID,
      { name: "Festival Opening Set" }
    );

    const clonedItems = await getTuneSetItems(db as never, cloned.id, OWNER_ID);
    expect(cloned.name).toBe("Festival Opening Set");
    expect(cloned.groupRef).toBe(group.id);
    expect(clonedItems.map((item) => item.tuneRef)).toEqual([
      PUBLIC_TUNE_ID,
      PRIVATE_TUNE_ID,
    ]);
  });
});
