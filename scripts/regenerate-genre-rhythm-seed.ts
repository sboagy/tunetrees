import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

type GenreTuneTypeRow = {
  genre_id: string;
  tune_type_id: string;
  default_bpm: number | null;
};

type RhythmPatternRow = {
  genre_id: string;
  tune_type_id: string;
  name: string;
  part_target: string | null;
  abc_string: string;
  is_default: boolean | null;
  premium_audio_url: string | null;
  sample_kit: string | null;
  pattern_type: string | null;
  tune_id: string | null;
  user_id: string | null;
};

const DEFAULT_LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const OUTPUT_PATH = path.join(
  process.cwd(),
  "supabase/seeds/genre_tune_tempo_and_rhythms.sql"
);

function sqlLiteral(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${value.replaceAll("'", "''")}'`;
}

function formatGenreTuneType(rows: GenreTuneTypeRow[]): string {
  const valueLines = rows.map(
    (row) =>
      `            (${sqlLiteral(row.genre_id)}, ${sqlLiteral(row.tune_type_id)}, ${sqlLiteral(row.default_bpm)})`
  );

  return [
    "UPDATE public.genre_tune_type",
    "SET",
    "    default_bpm = v.bpm",
    "FROM",
    "    (",
    "        VALUES",
    valueLines.join(",\n"),
    "    ) AS v (genre, tune_type, bpm)",
    "WHERE",
    "    genre_tune_type.genre_id = v.genre",
    "    AND genre_tune_type.tune_type_id = v.tune_type;",
  ].join("\n");
}

function formatRhythmPatterns(rows: RhythmPatternRow[]): string {
  const valueLines = rows.map(
    (row) =>
      `    (${sqlLiteral(row.genre_id)}, ${sqlLiteral(row.tune_type_id)}, ${sqlLiteral(row.name)}, ${sqlLiteral(row.part_target)}, ${sqlLiteral(row.abc_string)}, ${sqlLiteral(row.is_default)}, ${sqlLiteral(row.premium_audio_url)}, ${sqlLiteral(row.sample_kit)}, ${sqlLiteral(row.pattern_type)})`
  );

  return [
    "INSERT INTO",
    "    public.rhythm_patterns (",
    "        genre_id,",
    "        tune_type_id,",
    "        name,",
    "        part_target,",
    "        abc_string,",
    "        is_default,",
    "        premium_audio_url,",
    "        sample_kit,",
    "        pattern_type",
    "    )",
    "VALUES",
    `${valueLines.join(",\n")};`,
  ].join("\n");
}

async function main(): Promise<void> {
  const databaseUrl =
    process.env.SUPABASE_LOCAL_DB_URL ??
    process.env.DATABASE_URL ??
    DEFAULT_LOCAL_DB_URL;

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    const genreTuneTypeRows = await sql<GenreTuneTypeRow[]>`
      SELECT genre_id, tune_type_id, default_bpm
      FROM public.genre_tune_type
      ORDER BY genre_id, tune_type_id
    `;

    const rhythmPatternRows = await sql<RhythmPatternRow[]>`
      SELECT
        genre_id,
        tune_type_id,
        name,
        part_target,
        abc_string,
        is_default,
        premium_audio_url,
        sample_kit,
        pattern_type,
        tune_id,
        user_id
      FROM public.rhythm_patterns
      ORDER BY genre_id, tune_type_id, name, COALESCE(part_target, ''), abc_string
    `;

    const overrideRows = rhythmPatternRows.filter(
      (row) => row.tune_id !== null || row.user_id !== null
    );
    if (overrideRows.length > 0) {
      throw new Error(
        `Refusing to regenerate seed file with ${overrideRows.length} tune- or user-specific rhythm_patterns rows. Remove those overrides or extend the script before regenerating.`
      );
    }

    const output = [
      formatGenreTuneType(genreTuneTypeRows),
      "",
      formatRhythmPatterns(rhythmPatternRows),
      "",
    ].join("\n");

    mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, output, "utf8");

    console.log(
      `[seed] Wrote ${genreTuneTypeRows.length} genre_tune_type rows and ${rhythmPatternRows.length} rhythm_patterns rows to ${path.relative(process.cwd(), OUTPUT_PATH)}`
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("[seed] Failed to regenerate genre/rhythm seed file:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
