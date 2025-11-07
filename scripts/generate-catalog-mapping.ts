/**
 * Generate complete catalog tune ID mapping: Integer IDs → UUIDv7s
 *
 * Reads all catalog tunes from tunetrees_production_manual.sqlite3 and generates
 * a complete mapping file with real UUIDv7s for stable migration.
 */

import { writeFileSync } from "node:fs";
import BetterSqlite3 from "better-sqlite3";
import { generateId } from "../src/lib/utils/uuid.js";

const sqlite = new BetterSqlite3("tunetrees_production_manual.sqlite3", {
  readonly: true,
});

interface Tune {
  id: number;
  title: string;
  type: string | null;
  private_for: number | null;
}

// Get all catalog tunes (non-deleted, non-private)
const catalogTunes = sqlite
  .prepare(
    "SELECT id, title, type, private_for FROM tune WHERE deleted = 0 AND private_for IS NULL ORDER BY id"
  )
  .all() as Tune[];

console.log(`Found ${catalogTunes.length} catalog tunes`);

// Generate UUIDv7 for each tune
const mappings: Array<{
  id: number;
  uuid: string;
  title: string;
  type: string | null;
}> = [];

for (const tune of catalogTunes) {
  const uuid = generateId();
  mappings.push({
    id: tune.id,
    uuid,
    title: tune.title,
    type: tune.type,
  });
}

// Generate TypeScript file content
const fileContent = `/**
 * Catalog Tune ID Mapping: Integer IDs → UUIDs
 *
 * This file provides the authoritative mapping from legacy integer tune IDs
 * (from irishtune.info) to UUIDv7 primary keys.
 *
 * Used by:
 * 1. Migration scripts - ensures stable UUIDs for catalog tunes across migrations
 * 2. Test fixtures - for referencing specific catalog tunes
 * 3. Future imports - maintains UUID stability when re-importing
 *
 * All UUIDs are real UUIDv7s (time-ordered with timestamp prefix).
 * Generated once and never changed to ensure data stability.
 * 
 * GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated on: ${new Date().toISOString()}
 * Total catalog tunes: ${mappings.length}
 */

/**
 * Complete mapping of catalog tune integer IDs to UUIDs
 * Legacy ID → UUIDv7 (generated via generateId())
 */
export const CATALOG_TUNE_ID_MAP: Record<number, string> = {
${mappings
  .map(
    (m) =>
      `  ${m.id}: "${m.uuid}", // ${m.title}${m.type ? ` (${m.type})` : ""}`
  )
  .join("\n")}
};

/**
 * Helper function to get UUID for a catalog tune ID
 * Returns undefined if not in map (caller should generate new UUIDv7)
 */
export function getCatalogTuneUuid(intId: number): string | undefined {
  return CATALOG_TUNE_ID_MAP[intId];
}

/**
 * Named constants for commonly used catalog tunes in tests
 */
export const CATALOG_TUNE_43_ID = CATALOG_TUNE_ID_MAP[43]!; // Abbey Reel
export const CATALOG_TUNE_54_ID = CATALOG_TUNE_ID_MAP[54]!; // Alasdruim's March (Rolling Wave 2)
export const CATALOG_TUNE_55_ID = CATALOG_TUNE_ID_MAP[55]!; // Alexander's
export const CATALOG_TUNE_66_ID = CATALOG_TUNE_ID_MAP[66]!; // An Chóisir
export const CATALOG_TUNE_70_ID = CATALOG_TUNE_ID_MAP[70]!; // An Sean Duine
export const CATALOG_TUNE_72_ID = CATALOG_TUNE_ID_MAP[72]!; // Anderson's Reel
export const CATALOG_TUNE_MORRISON_ID = CATALOG_TUNE_ID_MAP[3497]!; // Morrison's Jig

/**
 * Type-safe lookup for catalog tune UUIDs
 */
export type CatalogTuneId = keyof typeof CATALOG_TUNE_ID_MAP;
`;

// Write to file
const outputPath = "src/lib/db/catalog-tune-ids.ts";
writeFileSync(outputPath, fileContent);

console.log(
  `✅ Generated ${outputPath} with ${mappings.length} catalog tune mappings`
);
console.log(
  `   First tune: ${mappings[0].id} → ${mappings[0].uuid} (${mappings[0].title})`
);
console.log(
  `   Last tune:  ${mappings[mappings.length - 1].id} → ${
    mappings[mappings.length - 1].uuid
  } (${mappings[mappings.length - 1].title})`
);

sqlite.close();
