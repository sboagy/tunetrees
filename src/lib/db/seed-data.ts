/**
 * Seed Data for Local SQLite Database
 *
 * Provides initial test data for development and testing.
 * In production, this would be replaced by initial sync from Supabase.
 *
 * @module lib/db/seed-data
 */

import type { Database as SqlJsDatabase } from "sql.js";

/**
 * Seed the database with test data
 *
 * Creates:
 * - Test user
 * - Sample genres and tune types (reference data)
 * - Sample tunes
 * - Test playlist
 * - Playlist-tune relationships
 *
 * @param db - SQL.js database instance
 */
export function seedDatabase(db: SqlJsDatabase, userId: string): void {
  console.log("🌱 Seeding database with test data...");

  try {
    const now = new Date().toISOString();

    // Seed reference data first
    // seedReferenceData(db);

    // Create user_profile entry
    // Note: We need to insert and get the auto-generated ID
    db.run(
      `
      INSERT OR IGNORE INTO user_profile (
        supabase_user_id, 
        email, 
        name, 
        sync_version, 
        last_modified_at
      ) 
      VALUES (?, 'test@example.com', 'Test User', 1, ?)
    `,
      [userId, now]
    );

    // After eliminating user_profile.id, userId IS the user identifier (supabase_user_id PK)
    // Verify user_profile exists
    const userProfileResult = db.exec(
      `SELECT supabase_user_id FROM user_profile WHERE supabase_user_id = ?`,
      [userId]
    );

    if (
      !userProfileResult ||
      userProfileResult.length === 0 ||
      !userProfileResult[0].values.length
    ) {
      throw new Error("Failed to create user_profile entry");
    }

    const userProfileId = userProfileResult[0].values[0][0] as number;

    // Create playlist (note: instrument_ref is INTEGER, not TEXT)
    // For now, we'll leave instrument_ref as NULL since we don't have instrument data
    db.run(
      `
      INSERT OR IGNORE INTO playlist (
        playlist_id, 
        user_ref, 
        instrument_ref,
        sync_version, 
        last_modified_at
      ) 
      VALUES (1, ?, NULL, 1, ?)
    `,
      [userProfileId, now]
    );

    // Create sample tunes
    const tunes = [
      {
        id: 1,
        title: "The Banish Misfortune",
        type: "jig",
        mode: "Dmixolydian",
        structure: "AABB",
        incipit: "D2E FGA | B2A AFD",
        genre: "irish", // Use genre ID, not name
      },
      {
        id: 2,
        title: "The Kesh Jig",
        type: "jig",
        mode: "Gmajor",
        structure: "AABB",
        incipit: "G3 GAB | d2d dBd",
        genre: "irish",
      },
      {
        id: 3,
        title: "The Silver Spear",
        type: "reel",
        mode: "Dmajor",
        structure: "AABB",
        incipit: "A2d d2e | f2e dcA",
        genre: "irish",
      },
      {
        id: 4,
        title: "The Merry Blacksmith",
        type: "reel",
        mode: "Dmajor",
        structure: "AABB",
        incipit: "D2F AFA | d2e fed",
        genre: "scottish",
      },
      {
        id: 5,
        title: "The Cooley's Reel",
        type: "reel",
        mode: "Eminor",
        structure: "AABB",
        incipit: "E2B B2A | B2c d2B",
        genre: "irish",
      },
    ];

    for (const tune of tunes) {
      db.run(
        `
        INSERT OR IGNORE INTO tune (
          id, 
          title, 
          type, 
          mode, 
          structure, 
          incipit, 
          genre,
          deleted, 
          sync_version,
          last_modified_at
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
      `,
        [
          tune.id,
          tune.title,
          tune.type,
          tune.mode,
          tune.structure,
          tune.incipit,
          tune.genre, // Now using genre ID
          now,
        ]
      );

      // Add to playlist
      db.run(
        `
        INSERT OR IGNORE INTO playlist_tune (
          playlist_ref, 
          tune_ref, 
          deleted, 
          sync_version,
          last_modified_at
        ) 
        VALUES (1, ?, 0, 1, ?)
      `,
        [tune.id, now]
      );
    }

    console.log(`✅ Seeded ${tunes.length} tunes`);
  } catch (error) {
    console.error("❌ Failed to seed database:", error);
    throw error;
  }
}

// /**
//  * Seed reference data (genres, tune types, etc.)
//  * This provides the lookup tables that tunes reference
//  */
// function seedReferenceData(db: SqlJsDatabase): void {
//   console.log("🌱 Seeding reference data...");

//   // Seed genres
//   const genres = [
//     { id: "irish", name: "Irish Traditional" },
//     { id: "scottish", name: "Scottish Traditional" },
//     { id: "bluegrass", name: "Bluegrass" },
//     { id: "old-time", name: "Old Time" },
//     { id: "french", name: "French/Quebecois" },
//   ];

//   for (const genre of genres) {
//     db.run(`INSERT OR IGNORE INTO genre (id, name) VALUES (?, ?)`, [
//       genre.id,
//       genre.name,
//     ]);
//   }

//   // Seed tune types
//   const tuneTypes = [
//     { id: "jig", name: "Jig" },
//     { id: "reel", name: "Reel" },
//     { id: "hornpipe", name: "Hornpipe" },
//     { id: "strathspey", name: "Strathspey" },
//     { id: "march", name: "March" },
//     { id: "waltz", name: "Waltz" },
//     { id: "polka", name: "Polka" },
//     { id: "air", name: "Air" },
//   ];

//   for (const tuneType of tuneTypes) {
//     db.run(`INSERT OR IGNORE INTO tune_type (id, name) VALUES (?, ?)`, [
//       tuneType.id,
//       tuneType.name,
//     ]);
//   }

//   console.log(
//     `✅ Seeded ${genres.length} genres and ${tuneTypes.length} tune types`
//   );
// }
