import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const COLS = [
  "id",
  "user_ref",
  "playlist_ref",
  "mode",
  "queue_date",
  "window_start_utc",
  "window_end_utc",
  "tune_ref",
  "bucket",
  "order_index",
  "snapshot_coalesced_ts",
  "scheduled_snapshot",
  "latest_due_snapshot",
  "acceptable_delinquency_window_snapshot",
  "tz_offset_minutes_snapshot",
  "generated_at",
  "completed_at",
  "exposures_required",
  "exposures_completed",
  "outcome",
  "active",
  "sync_version",
  "last_modified_at",
  "device_id",
] as const;

type ColName = (typeof COLS)[number];

const NUMERIC_COLS: ReadonlySet<ColName> = new Set([
  "bucket",
  "order_index",
  "acceptable_delinquency_window_snapshot",
  "tz_offset_minutes_snapshot",
  "exposures_required",
  "exposures_completed",
  "sync_version",
]);

const BOOLEAN_COLS: ReadonlySet<ColName> = new Set(["active"]);

function usage(): never {
  // eslint-disable-next-line no-console
  console.error(
    "Usage: tsx scripts/generate-daily-practice-queue-restore-sql.ts <input.csv> <output.sql>"
  );
  process.exit(2);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === ",") {
      fields.push(current);
      current = "";
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    current += ch;
  }

  fields.push(current);
  return fields;
}

function isNullToken(value: string): boolean {
  const v = value.trim();
  return v === "" || v.toUpperCase() === "NULL";
}

function sqlEscapeText(value: string): string {
  return value.replace(/'/g, "''");
}

function toSqlBooleanLiteral(raw: string): "TRUE" | "FALSE" {
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "t" || v === "yes" || v === "y") {
    return "TRUE";
  }
  if (v === "0" || v === "false" || v === "f" || v === "no" || v === "n") {
    return "FALSE";
  }
  throw new Error(`Invalid boolean value: '${raw}'`);
}

function toSqlLiteral(col: ColName, raw: string): string {
  if (isNullToken(raw)) return "NULL";

  const value = raw.trim();

  if (BOOLEAN_COLS.has(col)) {
    return toSqlBooleanLiteral(value);
  }

  if (NUMERIC_COLS.has(col)) {
    if (!/^[-+]?\d+$/.test(value)) {
      throw new Error(`Invalid integer value for ${col}: '${raw}'`);
    }
    return value;
  }

  return `'${sqlEscapeText(value)}'`;
}

function looksLikeHeader(fields: string[]): boolean {
  if (fields.length !== COLS.length) return false;
  return fields.every((v, idx) => v.trim() === COLS[idx]);
}

function buildRow(rawFields: string[]): string {
  if (rawFields.length !== COLS.length) {
    throw new Error(
      `Expected ${COLS.length} columns, got ${rawFields.length}: ${rawFields.join(",")}`
    );
  }

  const coerced = [...rawFields];

  // Defaults for NOT NULL / common defaults.
  // exposures_completed defaults to 0.
  if (isNullToken(coerced[18] ?? "")) {
    coerced[18] = "0";
  }
  // active defaults to true.
  if (isNullToken(coerced[20] ?? "")) {
    coerced[20] = "1";
  }
  // sync_version defaults to 1.
  if (isNullToken(coerced[21] ?? "")) {
    coerced[21] = "1";
  }
  // last_modified_at defaults to generated_at (or now).
  const generatedAtRaw = coerced[15] ?? "";
  if (isNullToken(coerced[22] ?? "")) {
    coerced[22] = !isNullToken(generatedAtRaw) ? generatedAtRaw : new Date().toISOString();
  }
  // snapshot_coalesced_ts is NOT NULL; fall back to generated_at.
  if (isNullToken(coerced[10] ?? "")) {
    coerced[10] = !isNullToken(generatedAtRaw) ? generatedAtRaw : new Date().toISOString();
  }

  const literals = coerced.map((v, idx) => toSqlLiteral(COLS[idx], v));
  return `(${literals.join(", ")})`;
}

function main(): void {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) usage();

  const csvPath = path.resolve(process.cwd(), inputPath);
  const outPath = path.resolve(process.cwd(), outputPath);

  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  const rows: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseCsvLine(lines[i]);

    if (i === 0 && looksLikeHeader(parsed)) {
      continue;
    }

    rows.push(buildRow(parsed));
  }

  const CHUNK_SIZE = 300;

  const statements: string[] = [];
  statements.push("BEGIN;");

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    statements.push(
      `INSERT INTO public.daily_practice_queue (\n  ${COLS.join(",\n  ")}\n) VALUES\n  ${chunk.join(",\n  ")}\nON CONFLICT DO NOTHING;`
    );
  }

  statements.push("COMMIT;");

  const header = `-- Generated by scripts/generate-daily-practice-queue-restore-sql.ts\n-- Source: ${path.basename(
    csvPath
  )}\n-- Rows: ${rows.length}\n\n`;

  writeFileSync(outPath, `${header + statements.join("\n\n")}\n`, "utf-8");

  // eslint-disable-next-line no-console
  console.log(`[daily_practice_queue] Wrote ${rows.length} rows to ${outPath}`);
}

main();
