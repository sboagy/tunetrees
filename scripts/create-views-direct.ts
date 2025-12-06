/**
 * Create Database Views in Supabase
 *
 * This script creates the 3 essential database views using direct PostgreSQL connection.
 */

import { config } from "dotenv";
import postgres from "postgres";

// Load environment variables
config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Missing environment variable: DATABASE_URL");
  console.error(
    "   Add DATABASE_URL to .env.local with your Supabase connection string",
  );
  console.error(
    "   Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres",
  );
  process.exit(1);
}

const sql = postgres(connectionString);

const views = [
  {
    name: "view_playlist_joined",
    sql: `
CREATE VIEW view_playlist_joined AS
SELECT
  p.playlist_id,
  p.user_ref,
  p.deleted AS playlist_deleted,
  p.instrument_ref,
  i.private_to_user,
  i.instrument,
  i.description,
  i.genre_default,
  i.deleted AS instrument_deleted
FROM
  playlist p
  JOIN instrument i ON p.instrument_ref = i.id
    `,
  },
  {
    name: "practice_list_joined",
    sql: `
CREATE VIEW practice_list_joined AS
SELECT
  tune.id AS id,
  COALESCE(tune_override.title, tune.title) AS title,
  COALESCE(tune_override.type, tune.type) AS type,
  COALESCE(tune_override.structure, tune.structure) AS structure,
  COALESCE(tune_override.mode, tune.mode) AS mode,
  COALESCE(tune_override.incipit, tune.incipit) AS incipit,
  COALESCE(tune_override.genre, tune.genre) AS genre,
  tune.deleted,
  tune.private_for,
  playlist_tune.learned AS learned,
  playlist_tune.goal,
  playlist_tune.scheduled,
  practice_record.state AS latest_state,
  practice_record.practiced AS latest_practiced,
  practice_record.quality AS latest_quality,
  practice_record.easiness AS latest_easiness,
  practice_record.difficulty AS latest_difficulty,
  practice_record.interval AS latest_interval,
  practice_record.stability AS latest_stability,
  practice_record.step AS latest_step,
  practice_record.repetitions AS latest_repetitions,
  practice_record.due AS latest_due,
  practice_record.goal AS latest_goal,
  practice_record.technique AS latest_technique,
  (
    SELECT STRING_AGG(tag.tag_text, ' ')
    FROM tag
    WHERE tag.tune_ref = tune.id
      AND tag.user_ref = playlist.user_ref
  ) AS tags,
  playlist_tune.playlist_ref,
  playlist.user_ref,
  playlist_tune.deleted AS playlist_deleted,
  (
    SELECT STRING_AGG(note.note_text, ' ')
    FROM note
    WHERE note.tune_ref = tune.id
      AND note.user_ref = playlist.user_ref
  ) AS notes,
  (
    SELECT ref.url
    FROM reference ref
    WHERE ref.tune_ref = tune.id
      AND ref.user_ref = playlist.user_ref
      AND ref.favorite = true
    LIMIT 1
  ) AS favorite_url,
  CASE
    WHEN tune_override.user_ref = playlist.user_ref THEN 1
    ELSE 0
  END AS has_override
FROM
  tune
  LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
  LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
  LEFT JOIN (
    SELECT DISTINCT ON (tune_ref, playlist_ref) pr.*
    FROM practice_record pr
    ORDER BY tune_ref, playlist_ref, id DESC
  ) practice_record ON practice_record.tune_ref = tune.id
    AND practice_record.playlist_ref = playlist_tune.playlist_ref
  LEFT JOIN tag ON tag.tune_ref = COALESCE(tune_override.id, tune.id)
WHERE
  (tune_override.user_ref IS NULL OR tune_override.user_ref = playlist.user_ref)
    `,
  },
  {
    name: "practice_list_staged",
    sql: `
CREATE VIEW practice_list_staged AS
SELECT
  tune.id AS id,
  COALESCE(tune_override.title, tune.title) AS title,
  COALESCE(tune_override.type, tune.type) AS type,
  COALESCE(tune_override.structure, tune.structure) AS structure,
  COALESCE(tune_override.mode, tune.mode) AS mode,
  COALESCE(tune_override.incipit, tune.incipit) AS incipit,
  COALESCE(tune_override.genre, tune.genre) AS genre,
  tune.private_for,
  tune.deleted,
  playlist_tune.learned,
  COALESCE(td.goal, COALESCE(pr.goal, 'recall')) AS goal,
  playlist_tune.scheduled AS scheduled,
  playlist.user_ref AS user_ref,
  playlist.playlist_id AS playlist_id,
  instrument.instrument AS instrument,
  playlist_tune.deleted AS playlist_deleted,
  COALESCE(td.state, pr.state) AS latest_state,
  COALESCE(td.practiced, pr.practiced) AS latest_practiced,
  COALESCE(td.quality, pr.quality) AS latest_quality,
  COALESCE(td.easiness, pr.easiness) AS latest_easiness,
  COALESCE(td.difficulty, pr.difficulty) AS latest_difficulty,
  COALESCE(td.stability, pr.stability) AS latest_stability,
  COALESCE(td.interval, pr.interval) AS latest_interval,
  COALESCE(td.step, pr.step) AS latest_step,
  COALESCE(td.repetitions, pr.repetitions) AS latest_repetitions,
  COALESCE(td.due, pr.due) AS latest_due,
  COALESCE(td.backup_practiced, pr.backup_practiced) AS latest_backup_practiced,
  COALESCE(td.goal, pr.goal) AS latest_goal,
  COALESCE(td.technique, pr.technique) AS latest_technique,
  (
    SELECT STRING_AGG(tag.tag_text, ' ')
    FROM tag
    WHERE tag.tune_ref = tune.id
      AND tag.user_ref = playlist.user_ref
  ) AS tags,
  td.purpose AS purpose,
  td.note_private AS note_private,
  td.note_public AS note_public,
  td.recall_eval AS recall_eval,
  (
    SELECT STRING_AGG(note.note_text, ' ')
    FROM note
    WHERE note.tune_ref = tune.id
      AND note.user_ref = playlist.user_ref
  ) AS notes,
  (
    SELECT ref.url
    FROM reference ref
    WHERE ref.tune_ref = tune.id
      AND ref.user_ref = playlist.user_ref
      AND ref.favorite = true
    LIMIT 1
  ) AS favorite_url,
  CASE
    WHEN tune_override.user_ref = playlist.user_ref THEN 1
    ELSE 0
  END AS has_override,
  CASE
    WHEN td.practiced IS NOT NULL
      OR td.quality IS NOT NULL
      OR td.easiness IS NOT NULL
      OR td.difficulty IS NOT NULL
      OR td.interval IS NOT NULL
      OR td.step IS NOT NULL
      OR td.repetitions IS NOT NULL
      OR td.due IS NOT NULL
      OR td.backup_practiced IS NOT NULL
      OR td.goal IS NOT NULL
      OR td.technique IS NOT NULL
      OR td.stability IS NOT NULL THEN 1
    ELSE 0
  END AS has_staged
FROM
  tune
  LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
  LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
  LEFT JOIN instrument ON instrument.id = playlist.instrument_ref
  LEFT JOIN (
    SELECT DISTINCT ON (tune_ref, playlist_ref) pr.*
    FROM practice_record pr
    ORDER BY tune_ref, playlist_ref, id DESC
  ) pr ON pr.tune_ref = tune.id
    AND pr.playlist_ref = playlist_tune.playlist_ref
  LEFT JOIN tag ON tag.tune_ref = tune.id
  LEFT JOIN table_transient_data td ON td.tune_id = tune.id
    AND td.playlist_id = playlist_tune.playlist_ref
WHERE
  (tune_override.user_ref IS NULL OR tune_override.user_ref = playlist.user_ref)
    `,
  },
];

async function createViews() {
  console.log("\n🔨 Creating Database Views in Supabase (Direct PostgreSQL)");
  console.log("=".repeat(60));

  let created = 0;
  let errors = 0;

  for (const view of views) {
    try {
      // Drop view if exists
      console.log(`\n📝 Processing: ${view.name}`);
      await sql.unsafe(`DROP VIEW IF EXISTS ${view.name} CASCADE`);
      console.log(`   ✓ Dropped existing view (if any)`);

      // Create view
      await sql.unsafe(view.sql);
      console.log(`   ✅ Created view: ${view.name}`);
      created++;
    } catch (error: any) {
      console.error(
        `   ❌ Error creating view ${view.name}:`,
        error?.message || error,
      );
      errors++;
    }
  }

  // Verify views exist
  console.log("\n📊 Verifying created views...");
  try {
    const result = await sql`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      AND table_name IN ('view_playlist_joined', 'practice_list_joined', 'practice_list_staged')
      ORDER BY table_name
    `;

    console.log(`   Found ${result.length} view(s):`);
    for (const row of result) {
      console.log(`   - ${row.table_name}`);
    }
  } catch (error: any) {
    console.error("   ⚠️  Could not verify views:", error?.message);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `✅ View creation complete: ${created} created, ${errors} failed`,
  );

  await sql.end();
}

createViews().catch(async (error) => {
  console.error("\n❌ Fatal error:", error);
  await sql.end();
  process.exit(1);
});
