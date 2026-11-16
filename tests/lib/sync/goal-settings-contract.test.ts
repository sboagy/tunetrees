import { getAdapter } from "@oosync/sync/adapters";
import {
  buildRowIdForOutbox,
  parseOutboxRowId,
  SYNCABLE_TABLES,
} from "@sync-schema/table-meta";
import { describe, expect, it } from "vitest";
import { ensureSyncRuntimeConfigured } from "../../../src/lib/sync/runtime-config";
import { WORKER_SYNC_CONFIG } from "../../../worker/src/generated/worker-config.generated";

ensureSyncRuntimeConfigured();

describe("goal settings sync contract", () => {
  it("orders users and goals before settings for offline creation", () => {
    expect(SYNCABLE_TABLES.indexOf("user_profile")).toBeLessThan(
      SYNCABLE_TABLES.indexOf("goal_user_settings")
    );
    expect(SYNCABLE_TABLES.indexOf("goal")).toBeLessThan(
      SYNCABLE_TABLES.indexOf("goal_user_settings")
    );
  });

  it("binds the actual Drizzle ownership properties and preserves tombstones", () => {
    expect(WORKER_SYNC_CONFIG.push.tableRules.goal).toMatchObject({
      bindAuthUserIdProps: ["privateFor"],
      denyDelete: true,
    });
    expect(WORKER_SYNC_CONFIG.push.tableRules.goal_user_settings).toMatchObject(
      { bindAuthUserIdProps: ["userId"], denyDelete: true }
    );
    expect(WORKER_SYNC_CONFIG.pull.tableRules.goal_user_settings).toEqual({
      kind: "eqUserId",
      column: "user_id",
    });
  });

  it.each(["practice_record", "repertoire_tune"] as const)(
    "keeps %s scoped to repertoire ownership despite its goal reference",
    (table) => {
      expect(WORKER_SYNC_CONFIG.pull.tableRules[table]).toEqual({
        kind: "inCollection",
        column: "repertoire_ref",
        collection: "repertoireIds",
      });
    }
  );

  it("round trips settings through sync adapters without changing JSON TEXT", () => {
    const adapter = getAdapter("goal_user_settings");
    const local = {
      userId: "owner",
      goalId: "goal",
      overrides:
        '{"description":"Intent: é","intervals":[0.1,0.3333333333333333]}',
      deleted: 0,
    };
    expect(adapter.primaryKey).toEqual(["user_id", "goal_id"]);
    const remote = adapter.toRemote(local);
    expect(remote).toEqual({
      user_id: "owner",
      goal_id: "goal",
      overrides: local.overrides,
      deleted: false,
    });
    expect(adapter.toLocal(remote)).toEqual(local);
  });

  it("retains both identities in an outbox row ID", () => {
    const identity = { user_id: "owner", goal_id: "goal" };
    const rowId = buildRowIdForOutbox("goal_user_settings", identity);
    expect(parseOutboxRowId("goal_user_settings", rowId)).toEqual(identity);
  });
});
