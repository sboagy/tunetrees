/** Read-only local Postgres comparison; no schema changes, fixtures or user data writes. */
import assert from "node:assert/strict";
import postgres from "postgres";
import {
  expectedHistoryIds,
  historyOrderFixtures,
} from "../tests/fixtures/practice-history-order.ts";

const sql = postgres(
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  { max: 1 }
);
try {
  // Verify the deployed local view, not just the independent fixture query below.
  // Keep this read-only so the check is safe alongside a running local E2E setup.
  const [view] = await sql`
    SELECT pg_get_viewdef('public.practice_list_joined'::regclass, true) AS definition
  `;
  assert.match(
    view.definition,
    /ORDER BY pr\.tune_ref,\s+pr\.repertoire_ref,\s+pr\.practiced DESC NULLS LAST,\s+pr\.last_modified_at DESC NULLS LAST,\s+pr\.id DESC/i,
    "practice_list_joined must select the latest event with canonical NULL and tie ordering"
  );
  const rows = await sql`
    SELECT id FROM jsonb_to_recordset(${sql.json(
      historyOrderFixtures.map((row) => ({
        id: row.id,
        practiced: row.practiced,
        last_modified_at: row.lastModifiedAt,
      }))
    )}::jsonb) AS pr(id text, practiced timestamptz, last_modified_at timestamptz)
    ORDER BY practiced DESC NULLS LAST, last_modified_at DESC NULLS LAST, id DESC
  `;
  assert.deepEqual(
    rows.map((row) => row.id),
    expectedHistoryIds
  );
  console.log(
    "Postgres practice view ordering is canonical and matches the shared SQLite/JavaScript fixtures."
  );
} finally {
  await sql.end();
}
