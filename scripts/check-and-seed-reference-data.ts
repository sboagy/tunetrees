/**
 * Check and Seed Reference Data in Supabase
 *
 * This script:
 * 1. Checks if reference data tables (genre, tune_type, etc.) have data in Supabase
 * 2. Seeds them with defaults if empty
 *
 * Run with: tsx scripts/check-and-seed-reference-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role to bypass RLS

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables:");
  console.error("   VITE_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error(
    "   SUPABASE_SERVICE_ROLE_KEY:",
    supabaseServiceKey ? "✓" : "✗",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Reference data for genres
 */
const GENRES = [
  {
    id: "irish",
    name: "Irish",
    region: "Ireland",
    description: "Traditional Irish music",
  },
  {
    id: "scottish",
    name: "Scottish",
    region: "Scotland",
    description: "Traditional Scottish music",
  },
  {
    id: "bluegrass",
    name: "Bluegrass",
    region: "USA",
    description: "American bluegrass music",
  },
  {
    id: "old-time",
    name: "Old Time",
    region: "USA",
    description: "Traditional American old-time music",
  },
  {
    id: "french",
    name: "French",
    region: "France/Quebec",
    description: "French traditional and Quebecois music",
  },
  {
    id: "klezmer",
    name: "Klezmer",
    region: "Eastern Europe",
    description: "Jewish traditional music",
  },
  {
    id: "scandinavian",
    name: "Scandinavian",
    region: "Scandinavia",
    description: "Nordic traditional music",
  },
  { id: "other", name: "Other", region: null, description: "Other genres" },
];

/**
 * Reference data for tune types
 */
const TUNE_TYPES = [
  // Irish
  {
    id: "jig",
    name: "Jig",
    rhythm: "6/8",
    description: "Irish jig in 6/8 time",
  },
  {
    id: "reel",
    name: "Reel",
    rhythm: "4/4",
    description: "Irish/Scottish reel in 4/4 time",
  },
  {
    id: "hornpipe",
    name: "Hornpipe",
    rhythm: "4/4",
    description: "Hornpipe with dotted rhythm",
  },
  {
    id: "slip-jig",
    name: "Slip Jig",
    rhythm: "9/8",
    description: "Slip jig in 9/8 time",
  },
  {
    id: "polka",
    name: "Polka",
    rhythm: "2/4",
    description: "Polka in 2/4 time",
  },
  {
    id: "slide",
    name: "Slide",
    rhythm: "12/8",
    description: "Irish slide in 12/8 time",
  },
  {
    id: "barndance",
    name: "Barndance",
    rhythm: "4/4",
    description: "Barndance tune",
  },
  {
    id: "mazurka",
    name: "Mazurka",
    rhythm: "3/4",
    description: "Mazurka in 3/4 time",
  },
  {
    id: "waltz",
    name: "Waltz",
    rhythm: "3/4",
    description: "Waltz in 3/4 time",
  },

  // Scottish
  {
    id: "strathspey",
    name: "Strathspey",
    rhythm: "4/4",
    description: "Scottish strathspey with dotted rhythm",
  },
  { id: "march", name: "March", rhythm: "4/4", description: "Scottish march" },

  // French/Quebec
  {
    id: "bourree",
    name: "Bourrée",
    rhythm: "2/4",
    description: "French bourrée",
  },
  {
    id: "gavotte",
    name: "Gavotte",
    rhythm: "4/4",
    description: "French gavotte",
  },

  // Scandinavian
  {
    id: "polska",
    name: "Polska",
    rhythm: "3/4",
    description: "Scandinavian polska",
  },
  {
    id: "schottische",
    name: "Schottische",
    rhythm: "4/4",
    description: "Schottische dance tune",
  },

  // Other
  { id: "air", name: "Air", rhythm: null, description: "Slow air or melody" },
  { id: "song", name: "Song", rhythm: null, description: "Song tune" },
  { id: "other", name: "Other", rhythm: null, description: "Other tune types" },
];

/**
 * Reference data for genre-tune_type relationships
 */
const GENRE_TUNE_TYPE = [
  // Irish
  { genre_id: "irish", tune_type_id: "jig" },
  { genre_id: "irish", tune_type_id: "reel" },
  { genre_id: "irish", tune_type_id: "hornpipe" },
  { genre_id: "irish", tune_type_id: "slip-jig" },
  { genre_id: "irish", tune_type_id: "polka" },
  { genre_id: "irish", tune_type_id: "slide" },
  { genre_id: "irish", tune_type_id: "barndance" },
  { genre_id: "irish", tune_type_id: "mazurka" },
  { genre_id: "irish", tune_type_id: "waltz" },
  { genre_id: "irish", tune_type_id: "air" },

  // Scottish
  { genre_id: "scottish", tune_type_id: "reel" },
  { genre_id: "scottish", tune_type_id: "strathspey" },
  { genre_id: "scottish", tune_type_id: "jig" },
  { genre_id: "scottish", tune_type_id: "march" },
  { genre_id: "scottish", tune_type_id: "hornpipe" },
  { genre_id: "scottish", tune_type_id: "air" },

  // Bluegrass/Old-time
  { genre_id: "bluegrass", tune_type_id: "reel" },
  { genre_id: "bluegrass", tune_type_id: "jig" },
  { genre_id: "bluegrass", tune_type_id: "waltz" },
  { genre_id: "old-time", tune_type_id: "reel" },
  { genre_id: "old-time", tune_type_id: "jig" },
  { genre_id: "old-time", tune_type_id: "waltz" },

  // French/Quebec
  { genre_id: "french", tune_type_id: "bourree" },
  { genre_id: "french", tune_type_id: "gavotte" },
  { genre_id: "french", tune_type_id: "waltz" },
  { genre_id: "french", tune_type_id: "reel" },

  // Scandinavian
  { genre_id: "scandinavian", tune_type_id: "polska" },
  { genre_id: "scandinavian", tune_type_id: "schottische" },
  { genre_id: "scandinavian", tune_type_id: "waltz" },

  // Klezmer
  { genre_id: "klezmer", tune_type_id: "other" },

  // Other
  { genre_id: "other", tune_type_id: "other" },
];

async function checkTable(tableName: string): Promise<number> {
  const { error } = await supabase.from(tableName).select("*").limit(1);

  if (error) {
    console.error(`❌ Error checking ${tableName}:`, error.message);
    return -1;
  }

  const { count, error: countError } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error(`❌ Error counting ${tableName}:`, countError.message);
    return -1;
  }

  return count || 0;
}

async function seedGenres(): Promise<void> {
  console.log("\n📊 Seeding genres...");

  for (const genre of GENRES) {
    const { error } = await supabase
      .from("genre")
      .upsert(genre, { onConflict: "id" });

    if (error) {
      console.error(`  ❌ Failed to insert genre ${genre.id}:`, error.message);
    } else {
      console.log(`  ✅ ${genre.name}`);
    }
  }

  console.log(`✅ Seeded ${GENRES.length} genres`);
}

async function seedTuneTypes(): Promise<void> {
  console.log("\n📊 Seeding tune types...");

  for (const tuneType of TUNE_TYPES) {
    const { error } = await supabase
      .from("tune_type")
      .upsert(tuneType, { onConflict: "id" });

    if (error) {
      console.error(
        `  ❌ Failed to insert tune type ${tuneType.id}:`,
        error.message,
      );
    } else {
      console.log(`  ✅ ${tuneType.name}`);
    }
  }

  console.log(`✅ Seeded ${TUNE_TYPES.length} tune types`);
}

async function seedGenreTuneTypes(): Promise<void> {
  console.log("\n📊 Seeding genre-tune_type relationships...");

  const { error } = await supabase
    .from("genre_tune_type")
    .upsert(GENRE_TUNE_TYPE, { onConflict: "genre_id,tune_type_id" });

  if (error) {
    console.error(`  ❌ Failed to insert genre_tune_type:`, error.message);
  } else {
    console.log(`  ✅ Created ${GENRE_TUNE_TYPE.length} relationships`);
  }

  console.log(
    `✅ Seeded ${GENRE_TUNE_TYPE.length} genre-tune_type relationships`,
  );
}

async function main() {
  console.log("🔍 Checking Supabase reference data...\n");

  // Check genre table
  const genreCount = await checkTable("genre");
  console.log(`📋 genre: ${genreCount} rows`);

  // Check tune_type table
  const tuneTypeCount = await checkTable("tune_type");
  console.log(`📋 tune_type: ${tuneTypeCount} rows`);

  // Check genre_tune_type table
  const genreTuneTypeCount = await checkTable("genre_tune_type");
  console.log(`📋 genre_tune_type: ${genreTuneTypeCount} rows`);

  // Check instrument table
  const instrumentCount = await checkTable("instrument");
  console.log(`📋 instrument: ${instrumentCount} rows`);

  // Seed if needed
  if (genreCount === 0) {
    await seedGenres();
  } else {
    console.log("\n✅ Genres already populated");
  }

  if (tuneTypeCount === 0) {
    await seedTuneTypes();
  } else {
    console.log("\n✅ Tune types already populated");
  }

  if (genreTuneTypeCount === 0) {
    await seedGenreTuneTypes();
  } else {
    console.log("\n✅ Genre-tune_type relationships already populated");
  }

  if (instrumentCount === 0) {
    console.log(
      "\n⚠️  Instrument table is empty - this should be seeded separately",
    );
  } else {
    console.log(`\n✅ Instrument table has ${instrumentCount} rows`);
  }

  console.log("\n✅ Reference data check complete!");
}

main().catch(console.error);
