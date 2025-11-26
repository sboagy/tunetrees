/**
 * Create Database Views in Supabase
 *
 * This script creates the 3 essential database views extracted from SQLite
 * and converted to PostgreSQL syntax.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables:");
  console.error("   VITE_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error(
    "   SUPABASE_SERVICE_ROLE_KEY:",
    supabaseServiceKey ? "✓" : "✗"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VIEW_PLAYLIST_JOINED = /* sql */ `
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
`;

const PRACTICE_LIST_JOINED = /* sql */ `
CREATE VIEW practice_list_joined as
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
        SELECT
            STRING_AGG(tag.tag_text, ' ')
        FROM
            tag
        WHERE
            tag.tune_ref = tune.id
            AND tag.user_ref = playlist.user_ref
    ) AS tags,
    playlist_tune.playlist_ref,
    playlist.user_ref,
    playlist_tune.deleted as playlist_deleted,
    (
        SELECT
            STRING_AGG(note.note_text, ' ')
        FROM
            note
        WHERE
            note.tune_ref = tune.id
            AND note.user_ref = playlist.user_ref
    ) AS notes,
    (
        SELECT
            ref.url
        FROM
            reference ref
        WHERE
            ref.tune_ref = tune.id
            AND ref.user_ref = playlist.user_ref
            AND ref.favorite = true
        LIMIT
            1
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
    LEFT JOIN (SELECT DISTINCT ON (tune_ref, playlist_ref) pr.* FROM practice_record pr ORDER BY tune_ref, playlist_ref, id DESC) practice_record ON practice_record.tune_ref = tune.id
        AND practice_record.playlist_ref = playlist_tune.playlist_ref
    LEFT JOIN tag ON tag.tune_ref = COALESCE(tune_override.id, tune.id)
WHERE
    (
        tune_override.user_ref IS NULL
        OR tune_override.user_ref = playlist.user_ref
    )
`;

const PRACTICE_LIST_STAGED = /* sql */ `
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
                SELECT
                        STRING_AGG(tag.tag_text, ' ')
                FROM
                        tag
                WHERE
                        tag.tune_ref = tune.id
                        AND tag.user_ref = playlist.user_ref
        ) AS tags,
        td.purpose AS purpose,
        td.note_private AS note_private,
        td.note_public AS note_public,
        td.recall_eval AS recall_eval,
        (
                SELECT
                        STRING_AGG(note.note_text, ' ')
                FROM
                        note
                WHERE
                        note.tune_ref = tune.id
                        AND note.user_ref = playlist.user_ref
        ) AS notes,
        (
                SELECT
                        ref.url
                FROM
                        reference ref
                WHERE
                        ref.tune_ref = tune.id
                        AND ref.user_ref = playlist.user_ref
                        AND ref.favorite = true
                LIMIT
                        1
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
        LEFT JOIN (SELECT DISTINCT ON (tune_ref, playlist_ref) pr.* FROM practice_record pr ORDER BY tune_ref, playlist_ref, id DESC) pr ON pr.tune_ref = tune.id
                AND pr.playlist_ref = playlist_tune.playlist_ref
        LEFT JOIN tag ON tag.tune_ref = tune.id
        LEFT JOIN table_transient_data td ON td.tune_id = tune.id
        AND td.playlist_id = playlist_tune.playlist_ref
WHERE
        (
                tune_override.user_ref IS NULL
                OR tune_override.user_ref = playlist.user_ref
        )
`;

async function createViews() {
  console.log("\n🔨 Creating Database Views in Supabase");
  console.log("=".repeat(60));

  // First, try to create the exec_sql helper function
  console.log("\n📝 Step 1: Creating exec_sql helper function...");
  const execSqlFunction = /* sql */ `
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
  `.trim();

  try {
    // Use the postgres driver directly for DDL operations
    const { error: funcError } = await supabase.rpc("exec_sql", {
      sql: execSqlFunction,
    });

    if (funcError?.message.includes("Could not find the function")) {
      // Function doesn't exist, we need to create it via raw SQL
      // We'll use a workaround: create views directly via postgres connection
      console.log(
        "⚠️  exec_sql function doesn't exist. Creating views via direct SQL..."
      );

      const views = [
        { name: "view_playlist_joined", sql: VIEW_PLAYLIST_JOINED },
        { name: "practice_list_joined", sql: PRACTICE_LIST_JOINED },
        { name: "practice_list_staged", sql: PRACTICE_LIST_STAGED },
      ];

      let created = 0;
      let errors = 0;

      for (const view of views) {
        try {
          // Try direct query execution (this works for some Supabase configurations)
          const dropSql = /* sql */ `DROP VIEW IF EXISTS ${view.name} CASCADE;`;
          await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseServiceKey!,
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ query: dropSql }),
          });

          const createResult = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseServiceKey!,
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ query: view.sql }),
          });

          if (!createResult.ok) {
            throw new Error(
              `HTTP ${createResult.status}: ${await createResult.text()}`
            );
          }

          console.log(`✅ Created view: ${view.name}`);
          created++;
        } catch (error: any) {
          console.error(
            `❌ Error creating view ${view.name}:`,
            error?.message || error
          );
          errors++;
        }
      }

      console.log(`\n${"=".repeat(60)}`);
      console.log(
        `✅ View creation complete: ${created} created, ${errors} failed`
      );

      if (errors > 0) {
        console.log(
          "\n⚠️  Manual SQL needed. Copy this to Supabase SQL Editor:"
        );
        for (const view of views) {
          console.log(`\n-- ${view.name}`);
          console.log(`DROP VIEW IF EXISTS ${view.name} CASCADE;`);
          console.log(view.sql);
        }
      }
      return;
    }

    console.log("✅ exec_sql helper function ready");
  } catch (error: any) {
    console.log("⚠️  Could not create helper function:", error?.message);
  }

  console.log("\n📝 Step 2: Creating views...");

  const views = [
    { name: "view_playlist_joined", sql: VIEW_PLAYLIST_JOINED },
    { name: "practice_list_joined", sql: PRACTICE_LIST_JOINED },
    { name: "practice_list_staged", sql: PRACTICE_LIST_STAGED },
  ];

  let created = 0;
  let errors = 0;

  for (const view of views) {
    try {
      // Drop view if exists
      const dropSql = /* sql */ `DROP VIEW IF EXISTS ${view.name} CASCADE;`;
      const { error: dropError } = await supabase.rpc("exec_sql", {
        sql: dropSql,
      });

      if (dropError && !dropError.message.includes("does not exist")) {
        console.log(`⚠️  Could not drop ${view.name}: ${dropError.message}`);
      }

      // Create view
      const { error: createError } = await supabase.rpc("exec_sql", {
        sql: view.sql,
      });

      if (createError) {
        throw createError;
      }

      console.log(`✅ Created view: ${view.name}`);
      created++;
    } catch (error: any) {
      console.error(
        `❌ Error creating view ${view.name}:`,
        error?.message || error
      );
      errors++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `✅ View creation complete: ${created} created, ${errors} failed`
  );

  if (errors > 0) {
    console.log("\n⚠️  Manual SQL needed. Copy this to Supabase SQL Editor:");
    for (const view of views) {
      console.log(`\n-- ${view.name}`);
      console.log(`DROP VIEW IF EXISTS ${view.name} CASCADE;`);
      console.log(view.sql);
    }
  }
}

createViews().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
