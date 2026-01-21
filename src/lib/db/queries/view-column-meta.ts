import { sql } from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";

export async function getViewColumnDescriptions(
  db: SqliteDatabase,
  viewName: string
): Promise<Record<string, string>> {
  const rows = await db.all<{
    column_name: string;
    description: string;
  }>(sql`
    SELECT column_name, description
    FROM view_column_meta
    WHERE view_name = ${viewName}
  `);

  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.column_name && row.description) {
      result[row.column_name] = row.description;
    }
  }
  return result;
}
