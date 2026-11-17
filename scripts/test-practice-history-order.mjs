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
    "Postgres canonical practice ordering matches the shared SQLite/JavaScript fixtures."
  );
} finally {
  await sql.end();
}
