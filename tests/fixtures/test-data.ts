/**
 * Test Data Fixtures with Hardcoded UUIDs
 *
 * These UUIDs are used across test suites for reproducible testing.
 * Format: 00000000-0000-4000-8000-{category}{index}
 *
 * Categories:
 * - 000000000xxx: Users
 * - 0000000010xx: Playlists
 * - 0000000100xx: Test-specific tunes (not catalog tunes)
 * - 0000001000xx: Reference data (genres, instruments, tune types)
 * - 0000010000xx: Practice records
 * - 0000100000xx: Notes/Tags/References
 *
 * Note: For CATALOG tunes (from production tune table), see catalog-tune-ids.ts
 * which maps integer IDs to UUIDs (e.g., 3497 → 00000000-0000-4000-8000-000000003497)
 */

// Import catalog tune IDs from central mapping
import {
  CATALOG_TUNE_43_ID,
  CATALOG_TUNE_54_ID,
  CATALOG_TUNE_55_ID,
  CATALOG_TUNE_66_ID,
  CATALOG_TUNE_70_ID,
  CATALOG_TUNE_72_ID,
  CATALOG_TUNE_113_ID,
  CATALOG_TUNE_ID_MAP,
  CATALOG_TUNE_MORRISON_ID,
  type CatalogTuneId,
  getCatalogTuneUuid,
} from "../../src/lib/db/catalog-tune-ids.js";

// Re-export catalog tune mappings for convenience
export {
  CATALOG_TUNE_ID_MAP,
  getCatalogTuneUuid,
  CATALOG_TUNE_43_ID,
  CATALOG_TUNE_54_ID,
  CATALOG_TUNE_55_ID,
  CATALOG_TUNE_66_ID,
  CATALOG_TUNE_70_ID,
  CATALOG_TUNE_72_ID,
  CATALOG_TUNE_MORRISON_ID,
  type CatalogTuneId,
};

// Alias for backwards compatibility with existing tests
export const TEST_TUNE_MORRISON_ID = CATALOG_TUNE_MORRISON_ID;

// ============================================================
// USERS
// ============================================================

// Playwright E2E Test Users (matching e2e/helpers/test-users.ts)
export const TEST_USER_ALICE_ID = "00000000-0000-4000-8000-000000009001";
export const TEST_USER_ALICE_EMAIL = "alice.test@tunetrees.test";
export const TEST_USER_ALICE_NAME = "Alice Test";

export const TEST_USER_BOB_ID = "00000000-0000-4000-8000-000000009002";
export const TEST_USER_BOB_EMAIL = "bob.test@tunetrees.test";
export const TEST_USER_BOB_NAME = "Bob Test";

export const TEST_USER_CAROL_ID = "00000000-0000-4000-8000-000000009003";
export const TEST_USER_CAROL_EMAIL = "carol.test@tunetrees.test";
export const TEST_USER_CAROL_NAME = "Carol Test";

export const TEST_USER_DAVE_ID = "00000000-0000-4000-8000-000000009004";
export const TEST_USER_DAVE_EMAIL = "dave.test@tunetrees.test";
export const TEST_USER_DAVE_NAME = "Dave Test";

export const TEST_USER_EVE_ID = "00000000-0000-4000-8000-000000009005";
export const TEST_USER_EVE_EMAIL = "eve.test@tunetrees.test";
export const TEST_USER_EVE_NAME = "Eve Test";

export const TEST_USER_FRANK_ID = "00000000-0000-4000-8000-000000009006";
export const TEST_USER_FRANK_EMAIL = "frank.test@tunetrees.test";
export const TEST_USER_FRANK_NAME = "Frank Test";

export const TEST_USER_GRACE_ID = "00000000-0000-4000-8000-000000009007";
export const TEST_USER_GRACE_EMAIL = "grace.test@tunetrees.test";
export const TEST_USER_GRACE_NAME = "Grace Test";

export const TEST_USER_HENRY_ID = "00000000-0000-4000-8000-000000009008";
export const TEST_USER_HENRY_EMAIL = "henry.test@tunetrees.test";
export const TEST_USER_HENRY_NAME = "Henry Test";

export const TEST_USER_IRIS_ID = "00000000-0000-4000-8000-000000009009";
export const TEST_USER_IRIS_EMAIL = "iris.test@tunetrees.test";
export const TEST_USER_IRIS_NAME = "Iris Test";

// ============================================================
// PRIVATE TUNES (Per-User)
// ============================================================

// Alice's Private Tunes
export const TEST_USER_ALICE_PRIVATE_TUNE_1_ID =
  "00000000-0000-4000-8000-000000029001";
export const TEST_USER_ALICE_PRIVATE_TUNE_2_ID =
  "00000000-0000-4000-8000-000000039001";

// Bob's Private Tunes
export const TEST_USER_BOB_PRIVATE_TUNE_1_ID =
  "00000000-0000-4000-8000-000000029002";
export const TEST_USER_BOB_PRIVATE_TUNE_2_ID =
  "00000000-0000-4000-8000-000000039002";

// Carol's Private Tunes
export const TEST_USER_CAROL_PRIVATE_TUNE_1_ID =
  "00000000-0000-4000-8000-000000029003";
export const TEST_USER_CAROL_PRIVATE_TUNE_2_ID =
  "00000000-0000-4000-8000-000000039003";

// Dave's Private Tunes
export const TEST_USER_DAVE_PRIVATE_TUNE_1_ID =
  "00000000-0000-4000-8000-000000029004";
export const TEST_USER_DAVE_PRIVATE_TUNE_2_ID =
  "00000000-0000-4000-8000-000000039004";

// Eve's Private Tunes
export const TEST_USER_EVE_PRIVATE_TUNE_1_ID =
  "00000000-0000-4000-8000-000000029005";
export const TEST_USER_EVE_PRIVATE_TUNE_2_ID =
  "00000000-0000-4000-8000-000000039005";

// Frank's Private Tunes
export const TEST_USER_FRANK_PRIVATE_TUNE_1_ID =
  "00000000-0000-4000-8000-000000029006";
export const TEST_USER_FRANK_PRIVATE_TUNE_2_ID =
  "00000000-0000-4000-8000-000000039006";

// Grace's Private Tunes
export const TEST_USER_GRACE_PRIVATE_TUNE_1_ID =
  "00000000-0000-4000-8000-000000029007";
export const TEST_USER_GRACE_PRIVATE_TUNE_2_ID =
  "00000000-0000-4000-8000-000000039007";

// Henry's Private Tunes
export const TEST_USER_HENRY_PRIVATE_TUNE_1_ID =
  "00000000-0000-4000-8000-000000029008";
export const TEST_USER_HENRY_PRIVATE_TUNE_2_ID =
  "00000000-0000-4000-8000-000000039008";

// Iris's Private Tunes
export const TEST_USER_IRIS_PRIVATE_TUNE_1_ID =
  "00000000-0000-4000-8000-000000029009";
export const TEST_USER_IRIS_PRIVATE_TUNE_2_ID =
  "00000000-0000-4000-8000-000000039009";

// ============================================================
// REFERENCE DATA (Genres, Instruments, Tune Types)
// ============================================================

// Genres
export const TEST_GENRE_IRISH_ID = "00000000-0000-4000-8000-000000001000";
export const TEST_GENRE_IRISH_NAME = "Irish Traditional";

export const TEST_GENRE_SCOTTISH_ID = "00000000-0000-4000-8000-000000001001";
export const TEST_GENRE_SCOTTISH_NAME = "Scottish Traditional";

export const TEST_GENRE_ENGLISH_ID = "00000000-0000-4000-8000-000000001002";
export const TEST_GENRE_ENGLISH_NAME = "English Traditional";

// Instruments
export const TEST_INSTRUMENT_FIDDLE_ID = "00000000-0000-4000-8000-000000001100";
export const TEST_INSTRUMENT_FIDDLE_NAME = "Fiddle";

export const TEST_INSTRUMENT_FLUTE_ID = "00000000-0000-4000-8000-000000001101";
export const TEST_INSTRUMENT_FLUTE_NAME = "Flute";

export const TEST_INSTRUMENT_MANDOLIN_ID =
  "00000000-0000-4000-8000-000000001102";
export const TEST_INSTRUMENT_MANDOLIN_NAME = "Mandolin";

// Tune Types
export const TEST_TUNE_TYPE_REEL_ID = "00000000-0000-4000-8000-000000001200";
export const TEST_TUNE_TYPE_REEL_NAME = "Reel";

export const TEST_TUNE_TYPE_JIG_ID = "00000000-0000-4000-8000-000000001201";
export const TEST_TUNE_TYPE_JIG_NAME = "Jig";

export const TEST_TUNE_TYPE_HORNPIPE_ID =
  "00000000-0000-4000-8000-000000001202";
export const TEST_TUNE_TYPE_HORNPIPE_NAME = "Hornpipe";

export const TEST_TUNE_TYPE_WALTZ_ID = "00000000-0000-4000-8000-000000001203";
export const TEST_TUNE_TYPE_WALTZ_NAME = "Waltz";

// ============================================================
// PLAYLISTS
// ============================================================

// ============================================================
// PLAYLISTS
// ============================================================

export const TEST_PLAYLIST_IRISH_FIDDLE_ID =
  "00000000-0000-4000-8000-000000001010";
export const TEST_PLAYLIST_IRISH_FIDDLE_NAME = "Irish Fiddle Tunes";

export const TEST_PLAYLIST_SCOTTISH_FLUTE_ID =
  "00000000-0000-4000-8000-000000001011";
export const TEST_PLAYLIST_SCOTTISH_FLUTE_NAME = "Scottish Flute Tunes";

export const TEST_PLAYLIST_ENGLISH_MANDOLIN_ID =
  "00000000-0000-4000-8000-000000001012";
export const TEST_PLAYLIST_ENGLISH_MANDOLIN_NAME = "English Mandolin Tunes";

// Playwright E2E Test User Playlists (matching e2e/helpers/test-users.ts)
export const TEST_PLAYLIST_ALICE_ID = "00000000-0000-4000-8000-000000019001";
export const TEST_PLAYLIST_BOB_ID = "00000000-0000-4000-8000-000000019002";
export const TEST_PLAYLIST_DAVE_ID = "00000000-0000-4000-8000-000000019004";
export const TEST_PLAYLIST_EVE_ID = "00000000-0000-4000-8000-000000019005";
export const TEST_PLAYLIST_FRANK_ID = "00000000-0000-4000-8000-000000019006";
export const TEST_PLAYLIST_GRACE_ID = "00000000-0000-4000-8000-000000019007";
export const TEST_PLAYLIST_HENRY_ID = "00000000-0000-4000-8000-000000019008";
export const TEST_PLAYLIST_IRIS_ID = "00000000-0000-4000-8000-000000019009";

// ============================================================
// TUNES
// ============================================================

// DEPRECATED: Use private tune IDs or catalog tune IDs instead
// These aliases point to Alice's private tunes for backwards compatibility
export const TEST_TUNE_BANISH_ID = CATALOG_TUNE_113_ID; // "Banish Misfortune"
export const TEST_TUNE_BANISH_TITLE = "Banish Misfortune";
export const TEST_TUNE_BANISH_TYPE = "JigD";
export const TEST_TUNE_BANISH_MODE = "D Mixolydian";

// For tests that need different tunes, use catalog tunes
export const TEST_TUNE_KESH_ID = CATALOG_TUNE_43_ID; // "The Kesh" from catalog
export const TEST_TUNE_KESH_TITLE = "The Kesh";
export const TEST_TUNE_KESH_TYPE = "ReelD";
export const TEST_TUNE_KESH_MODE = "D Major";

export const TEST_TUNE_MASONS_ID = CATALOG_TUNE_54_ID; // "The Mason's Apron" from catalog
export const TEST_TUNE_MASONS_TITLE = "The Mason's Apron";
export const TEST_TUNE_MASONS_TYPE = "ReelA";
export const TEST_TUNE_MASONS_MODE = "A Major";

// Jigs
export const TEST_TUNE_SWALLOWTAIL_ID = CATALOG_TUNE_55_ID; // "Swallowtail Jig" from catalog
export const TEST_TUNE_SWALLOWTAIL_TITLE = "Swallowtail Jig";
export const TEST_TUNE_SWALLOWTAIL_TYPE = "JigE";
export const TEST_TUNE_SWALLOWTAIL_MODE = "E Minor";

// Morrison's Jig uses catalog tune ID (re-exported above as TEST_TUNE_MORRISON_ID)
export const TEST_TUNE_MORRISON_TITLE = "Morrison's Jig";
export const TEST_TUNE_MORRISON_TYPE = "JigE";
export const TEST_TUNE_MORRISON_MODE = "E Dorian";

// Hornpipes
export const TEST_TUNE_HARVEST_HOME_ID = CATALOG_TUNE_66_ID; // "Harvest Home" from catalog
export const TEST_TUNE_HARVEST_HOME_TITLE = "Harvest Home";
export const TEST_TUNE_HARVEST_HOME_TYPE = TEST_TUNE_TYPE_HORNPIPE_ID;
export const TEST_TUNE_HARVEST_HOME_MODE = "D Major";

// ============================================================
// PRACTICE RECORDS
// ============================================================

export const TEST_PRACTICE_RECORD_1_ID = "00000000-0000-4000-8000-000000010001";
export const TEST_PRACTICE_RECORD_2_ID = "00000000-0000-4000-8000-000000010002";
export const TEST_PRACTICE_RECORD_3_ID = "00000000-0000-4000-8000-000000010003";

// ============================================================
// DAILY PRACTICE QUEUE
// ============================================================

export const TEST_QUEUE_ITEM_1_ID = "00000000-0000-4000-8000-000000020001";
export const TEST_QUEUE_ITEM_2_ID = "00000000-0000-4000-8000-000000020002";
export const TEST_QUEUE_ITEM_3_ID = "00000000-0000-4000-8000-000000020003";

// ============================================================
// NOTES
// ============================================================

export const TEST_NOTE_1_ID = "00000000-0000-4000-8000-000000100001";
export const TEST_NOTE_2_ID = "00000000-0000-4000-8000-000000100002";

// ============================================================
// TAGS
// ============================================================

export const TEST_TAG_LEARNING_ID = "00000000-0000-4000-8000-000000100101";
export const TEST_TAG_LEARNING_NAME = "learning";

export const TEST_TAG_FAVORITE_ID = "00000000-0000-4000-8000-000000100102";
export const TEST_TAG_FAVORITE_NAME = "favorite";

export const TEST_TAG_SESSION_ID = "00000000-0000-4000-8000-000000100103";
export const TEST_TAG_SESSION_NAME = "session";

// ============================================================
// REFERENCES (External links/resources)
// ============================================================

export const TEST_REFERENCE_1_ID = "00000000-0000-4000-8000-000000100201";
export const TEST_REFERENCE_2_ID = "00000000-0000-4000-8000-000000100202";

// ============================================================
// TAB STATE
// ============================================================

export const TEST_TAB_STATE_ID = "00000000-0000-4000-8000-000000100301";

// ============================================================
// PLAYLIST_TUNE (Junction Table)
// ============================================================

export const TEST_PLAYLIST_TUNE_1_ID = "00000000-0000-4000-8000-000000030001";
export const TEST_PLAYLIST_TUNE_2_ID = "00000000-0000-4000-8000-000000030002";
export const TEST_PLAYLIST_TUNE_3_ID = "00000000-0000-4000-8000-000000030003";

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate a test UUID with a specific index
 * @param category - Category prefix (e.g., "0001" for playlists)
 * @param index - Index within category (e.g., 10 for 10th playlist)
 */
export function generateTestUUID(category: string, index: number): string {
  const indexStr = index.toString().padStart(4, "0");
  const suffix = category + indexStr;
  return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
}

/**
 * Check if a UUID is a test UUID (matches our pattern)
 */
export function isTestUUID(uuid: string): boolean {
  return uuid.startsWith("00000000-0000-4000-8000-");
}

/**
 * Get private tune IDs for a specific test user
 * @param userId - Test user UUID
 * @returns Object with privateTune1Id and privateTune2Id
 */
export function getPrivateTuneIds(userId: string): {
  privateTune1Id: string;
  privateTune2Id: string;
} {
  const tuneMap: Record<
    string,
    { privateTune1Id: string; privateTune2Id: string }
  > = {
    [TEST_USER_ALICE_ID]: {
      privateTune1Id: TEST_USER_ALICE_PRIVATE_TUNE_1_ID,
      privateTune2Id: TEST_USER_ALICE_PRIVATE_TUNE_2_ID,
    },
    [TEST_USER_BOB_ID]: {
      privateTune1Id: TEST_USER_BOB_PRIVATE_TUNE_1_ID,
      privateTune2Id: TEST_USER_BOB_PRIVATE_TUNE_2_ID,
    },
    [TEST_USER_CAROL_ID]: {
      privateTune1Id: TEST_USER_CAROL_PRIVATE_TUNE_1_ID,
      privateTune2Id: TEST_USER_CAROL_PRIVATE_TUNE_2_ID,
    },
    [TEST_USER_DAVE_ID]: {
      privateTune1Id: TEST_USER_DAVE_PRIVATE_TUNE_1_ID,
      privateTune2Id: TEST_USER_DAVE_PRIVATE_TUNE_2_ID,
    },
    [TEST_USER_EVE_ID]: {
      privateTune1Id: TEST_USER_EVE_PRIVATE_TUNE_1_ID,
      privateTune2Id: TEST_USER_EVE_PRIVATE_TUNE_2_ID,
    },
    [TEST_USER_FRANK_ID]: {
      privateTune1Id: TEST_USER_FRANK_PRIVATE_TUNE_1_ID,
      privateTune2Id: TEST_USER_FRANK_PRIVATE_TUNE_2_ID,
    },
    [TEST_USER_GRACE_ID]: {
      privateTune1Id: TEST_USER_GRACE_PRIVATE_TUNE_1_ID,
      privateTune2Id: TEST_USER_GRACE_PRIVATE_TUNE_2_ID,
    },
    [TEST_USER_HENRY_ID]: {
      privateTune1Id: TEST_USER_HENRY_PRIVATE_TUNE_1_ID,
      privateTune2Id: TEST_USER_HENRY_PRIVATE_TUNE_2_ID,
    },
    [TEST_USER_IRIS_ID]: {
      privateTune1Id: TEST_USER_IRIS_PRIVATE_TUNE_1_ID,
      privateTune2Id: TEST_USER_IRIS_PRIVATE_TUNE_2_ID,
    },
  };

  const tunes = tuneMap[userId];
  if (!tunes) {
    throw new Error(`No private tunes found for user ID: ${userId}`);
  }
  return tunes;
}

// ============================================================
// TEST DATA OBJECTS
// ============================================================

export const TEST_GENRE_IRISH = {
  id: TEST_GENRE_IRISH_ID,
  name: TEST_GENRE_IRISH_NAME,
};

export const TEST_GENRE_SCOTTISH = {
  id: TEST_GENRE_SCOTTISH_ID,
  name: TEST_GENRE_SCOTTISH_NAME,
};

export const TEST_INSTRUMENT_FIDDLE = {
  id: TEST_INSTRUMENT_FIDDLE_ID,
  name: TEST_INSTRUMENT_FIDDLE_NAME,
};

export const TEST_INSTRUMENT_FLUTE = {
  id: TEST_INSTRUMENT_FLUTE_ID,
  name: TEST_INSTRUMENT_FLUTE_NAME,
};

export const TEST_TUNE_TYPE_REEL = {
  id: TEST_TUNE_TYPE_REEL_ID,
  name: TEST_TUNE_TYPE_REEL_NAME,
};

export const TEST_TUNE_TYPE_JIG = {
  id: TEST_TUNE_TYPE_JIG_ID,
  name: TEST_TUNE_TYPE_JIG_NAME,
};

export const TEST_TUNE_KESH = {
  id: TEST_TUNE_KESH_ID,
  title: TEST_TUNE_KESH_TITLE,
  type: TEST_TUNE_KESH_TYPE,
  mode: TEST_TUNE_KESH_MODE,
  structure: "AABB",
  userRef: TEST_USER_ALICE_ID,
  currentKey: "D",
  defaultKey: "D",
  privateFor: null as string | null,
};

export const TEST_TUNE_BANISH = {
  id: TEST_TUNE_BANISH_ID,
  title: TEST_TUNE_BANISH_TITLE,
  type: TEST_TUNE_BANISH_TYPE,
  mode: TEST_TUNE_BANISH_MODE,
  structure: "AABB",
  userRef: TEST_USER_ALICE_ID,
  currentKey: "D",
  defaultKey: "D",
  privateFor: null as string | null,
};

export const TEST_PLAYLIST_IRISH_FIDDLE = {
  id: TEST_PLAYLIST_IRISH_FIDDLE_ID,
  name: TEST_PLAYLIST_IRISH_FIDDLE_NAME,
  userRef: TEST_USER_ALICE_ID,
  instrument: TEST_INSTRUMENT_FIDDLE_ID,
  genre: TEST_GENRE_IRISH_ID,
  description: "Irish tunes for fiddle practice",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

// ============================================================
// COLLECTIONS FOR BULK OPERATIONS
// ============================================================

export const ALL_TEST_GENRES = [
  TEST_GENRE_IRISH,
  TEST_GENRE_SCOTTISH,
  { id: TEST_GENRE_ENGLISH_ID, name: TEST_GENRE_ENGLISH_NAME },
];

export const ALL_TEST_INSTRUMENTS = [
  TEST_INSTRUMENT_FIDDLE,
  TEST_INSTRUMENT_FLUTE,
  { id: TEST_INSTRUMENT_MANDOLIN_ID, name: TEST_INSTRUMENT_MANDOLIN_NAME },
];

export const ALL_TEST_TUNE_TYPES = [
  TEST_TUNE_TYPE_REEL,
  TEST_TUNE_TYPE_JIG,
  { id: TEST_TUNE_TYPE_HORNPIPE_ID, name: TEST_TUNE_TYPE_HORNPIPE_NAME },
  { id: TEST_TUNE_TYPE_WALTZ_ID, name: TEST_TUNE_TYPE_WALTZ_NAME },
];

export const ALL_TEST_TUNES = [
  TEST_TUNE_KESH,
  TEST_TUNE_BANISH,
  {
    id: TEST_TUNE_MASONS_ID,
    title: TEST_TUNE_MASONS_TITLE,
    type: TEST_TUNE_MASONS_TYPE,
    mode: TEST_TUNE_MASONS_MODE,
    structure: "AABB",
    userRef: TEST_USER_ALICE_ID,
    currentKey: "A",
    defaultKey: "A",
    privateFor: null as string | null,
  },
  {
    id: TEST_TUNE_SWALLOWTAIL_ID,
    title: TEST_TUNE_SWALLOWTAIL_TITLE,
    type: TEST_TUNE_SWALLOWTAIL_TYPE,
    mode: TEST_TUNE_SWALLOWTAIL_MODE,
    structure: "AABB",
    userRef: TEST_USER_ALICE_ID,
    currentKey: "E",
    defaultKey: "E",
    privateFor: null as string | null,
  },
  {
    id: TEST_TUNE_MORRISON_ID,
    title: TEST_TUNE_MORRISON_TITLE,
    type: TEST_TUNE_MORRISON_TYPE,
    mode: TEST_TUNE_MORRISON_MODE,
    structure: "AABB",
    userRef: TEST_USER_ALICE_ID,
    currentKey: "E",
    defaultKey: "E",
    privateFor: null as string | null,
  },
  {
    id: TEST_TUNE_HARVEST_HOME_ID,
    title: TEST_TUNE_HARVEST_HOME_TITLE,
    type: TEST_TUNE_HARVEST_HOME_TYPE,
    mode: TEST_TUNE_HARVEST_HOME_MODE,
    structure: "AABB",
    userRef: TEST_USER_ALICE_ID,
    currentKey: "D",
    defaultKey: "D",
    privateFor: null as string | null,
  },
];
