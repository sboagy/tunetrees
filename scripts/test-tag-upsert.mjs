import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { getTableColumns, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { findPostgresErrorLike } from "oosync/worker/db-errors.ts";
import { pullRuleProtectedProps } from "oosync/worker/sync-schema.ts";
import { applyUpsert } from "oosync/worker/upsert.ts";
import postgres from "postgres";
import { TABLE_REGISTRY_CORE } from "../shared/generated/sync/table-meta.generated.ts";
import { tag } from "../worker/src/generated/schema-postgres.generated.ts";
import { WORKER_SYNC_CONFIG } from "../worker/src/generated/worker-config.generated.ts";

// Local-only integration test: the temporary table shadows public.tag without
// reading or modifying application rows. Use the consumer's generated contract.
const client = postgres(
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  {
    max: 1,
    prepare: false,
    connect_timeout: 5,
  }
);
const db = drizzle(client);
after(() => client.end({ timeout: 5 }));
const columns = Object.entries(getTableColumns(tag)).map(([prop, col]) => ({
  prop,
  col,
}));
const meta = TABLE_REGISTRY_CORE.tag;
const primary = columns.filter(({ col }) => col.name === meta.primaryKey);
const natural = columns.filter(({ col }) => meta.uniqueKeys.includes(col.name));
const options = {
  ...WORKER_SYNC_CONFIG.push.tableRules.tag.upsert,
  protectedProps: pullRuleProtectedProps(
    WORKER_SYNC_CONFIG.pull.tableRules.tag
  ),
};
const upsert = (tx, data) =>
  applyUpsert(tx, tag, natural, primary, data, options);
async function fixture(run) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`create temporary table tag (
      tag_id uuid primary key, user_ref uuid not null, tune_ref uuid not null,
      tag_text text not null, sync_version integer not null default 1,
      last_modified_at text not null, device_id text,
      unique(user_ref, tune_ref, tag_text)
    ) on commit drop`);
    const original = {
      tagId: randomUUID(),
      userRef: randomUUID(),
      tuneRef: randomUUID(),
      tagText: "old",
      syncVersion: 1,
      lastModifiedAt: "2026-11-28T12:00:00.000Z",
      deviceId: "test-device",
    };
    await upsert(tx, original);
    await run(tx, original);
  });
}

test("tag rename and repeated upload preserve identity and sync fields", async () => {
  await fixture(async (tx, original) => {
    const renamed = {
      ...original,
      tagText: "renamed",
      syncVersion: 2,
      lastModifiedAt: "2026-11-28T12:01:00.000Z",
    };
    await upsert(tx, renamed);
    await upsert(tx, renamed);
    assert.deepEqual(await tx.select().from(tag), [renamed]);
  });
});

for (const property of ["userRef", "tuneRef"]) {
  test(`tag rename cannot change protected ${property}`, async () => {
    await fixture(async (tx, original) => {
      await assert.rejects(
        tx.transaction((attempt) =>
          upsert(attempt, {
            ...original,
            [property]: randomUUID(),
            tagText: "renamed",
          })
        ),
        /protected natural-key/i
      );
      assert.deepEqual(await tx.select().from(tag), [original]);
    });
  });
}

test("renaming into an existing tag rejects the upload without merging identities", async () => {
  await fixture(async (tx, original) => {
    const other = { ...original, tagId: randomUUID(), tagText: "taken" };
    await upsert(tx, other);
    await assert.rejects(
      tx.transaction((attempt) =>
        upsert(attempt, { ...original, tagText: "taken" })
      ),
      (error) => {
        const pgError = findPostgresErrorLike(error);
        assert.equal(pgError?.code, "23505");
        assert.equal(
          pgError?.constraint_name,
          "tag_user_ref_tune_ref_tag_text_key"
        );
        return true;
      }
    );
    const rows = await tx.select().from(tag);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.find((row) => row.tagId === original.tagId),
      original
    );
    assert.deepEqual(
      rows.find((row) => row.tagId === other.tagId),
      other
    );
  });
});
