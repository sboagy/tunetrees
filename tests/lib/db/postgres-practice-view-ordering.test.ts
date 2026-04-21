import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "..", "..", "..");

type SqlExpectation = {
  label: string;
  filePath: string;
  expected: string;
};

const expectations: SqlExpectation[] = [
  {
    label: "sql_scripts practice_list_joined uses timestamp ordering",
    filePath: path.join(
      projectRoot,
      "sql_scripts",
      "view_practice_list_joined.sql"
    ),
    expected:
      "ORDER BY pr.tune_ref, pr.repertoire_ref, pr.practiced DESC NULLS LAST, pr.last_modified_at DESC NULLS LAST, pr.id DESC",
  },
  {
    label: "sql_scripts practice_list_staged uses timestamp ordering",
    filePath: path.join(
      projectRoot,
      "sql_scripts",
      "view_practice_list_staged.sql"
    ),
    expected:
      "ORDER BY pr_1.tune_ref, pr_1.repertoire_ref, pr_1.practiced DESC NULLS LAST, pr_1.last_modified_at DESC NULLS LAST, pr_1.id DESC",
  },
  {
    label: "create-views helper uses timestamp ordering for joined view",
    filePath: path.join(projectRoot, "scripts", "create-views.ts"),
    expected:
      "ORDER BY tune_ref, playlist_ref, practiced DESC NULLS LAST, last_modified_at DESC NULLS LAST, id DESC) practice_record ON",
  },
  {
    label: "create-views helper uses timestamp ordering for staged view",
    filePath: path.join(projectRoot, "scripts", "create-views.ts"),
    expected:
      "ORDER BY tune_ref, playlist_ref, practiced DESC NULLS LAST, last_modified_at DESC NULLS LAST, id DESC) pr ON",
  },
  {
    label: "create-views-direct helper uses timestamp ordering",
    filePath: path.join(projectRoot, "scripts", "create-views-direct.ts"),
    expected:
      "ORDER BY tune_ref, playlist_ref, practiced DESC NULLS LAST, last_modified_at DESC NULLS LAST, id DESC",
  },
  {
    label:
      "migration helper rewrites joined latest-record selection by timestamp",
    filePath: path.join(
      projectRoot,
      "scripts",
      "migrate-production-to-supabase.ts"
    ),
    expected:
      "(SELECT DISTINCT ON (tune_ref, playlist_ref) pr.* FROM practice_record pr ORDER BY tune_ref, playlist_ref, practiced DESC NULLS LAST, last_modified_at DESC NULLS LAST, id DESC) practice_record ON",
  },
  {
    label:
      "migration helper rewrites staged latest-record selection by timestamp",
    filePath: path.join(
      projectRoot,
      "scripts",
      "migrate-production-to-supabase.ts"
    ),
    expected:
      "(SELECT DISTINCT ON (tune_ref, playlist_ref) pr.* FROM practice_record pr ORDER BY tune_ref, playlist_ref, practiced DESC NULLS LAST, last_modified_at DESC NULLS LAST, id DESC) pr ON",
  },
  {
    label: "drizzle Postgres snapshot joined view uses timestamp ordering",
    filePath: path.join(
      projectRoot,
      "drizzle",
      "migrations",
      "postgres",
      "schema.ts"
    ),
    expected:
      "ORDER BY pr.tune_ref, pr.playlist_ref, pr.practiced DESC NULLS LAST, pr.last_modified_at DESC NULLS LAST, pr.id DESC",
  },
  {
    label: "drizzle Postgres snapshot staged view uses timestamp ordering",
    filePath: path.join(
      projectRoot,
      "drizzle",
      "migrations",
      "postgres",
      "schema.ts"
    ),
    expected:
      "ORDER BY pr_1.tune_ref, pr_1.playlist_ref, pr_1.practiced DESC NULLS LAST, pr_1.last_modified_at DESC NULLS LAST, pr_1.id DESC",
  },
  {
    label: "Supabase baseline joined view uses timestamp ordering",
    filePath: path.join(
      projectRoot,
      "supabase",
      "migrations",
      "20260217000000_baseline_schema.sql"
    ),
    expected:
      'ORDER BY "pr"."tune_ref", "pr"."repertoire_ref", "pr"."practiced" DESC NULLS LAST, "pr"."last_modified_at" DESC NULLS LAST, "pr"."id" DESC',
  },
  {
    label: "Supabase baseline staged view uses timestamp ordering",
    filePath: path.join(
      projectRoot,
      "supabase",
      "migrations",
      "20260217000000_baseline_schema.sql"
    ),
    expected:
      'ORDER BY "pr_1"."tune_ref", "pr_1"."repertoire_ref", "pr_1"."practiced" DESC NULLS LAST, "pr_1"."last_modified_at" DESC NULLS LAST, "pr_1"."id" DESC',
  },
];

function normalizeWhitespace(contents: string): string {
  return contents.replace(/\s+/g, " ").trim();
}

describe("Postgres practice view ordering", () => {
  for (const expectation of expectations) {
    it(expectation.label, () => {
      const contents = fs.readFileSync(expectation.filePath, "utf8");
      expect(normalizeWhitespace(contents)).toContain(expectation.expected);
    });
  }
});
