/**
 * Database Schema for TuneTrees
 *
 * This file re-exports the SQLite schema from drizzle/schema-sqlite.ts
 * to maintain backward compatibility with existing imports.
 *
 * @module lib/db/schema
 */

// Re-export everything from the generated SQLite schema
export * from "../../../drizzle/schema-sqlite";

import {
  repertoire as repertoire,
  repertoireTune as repertoireTune,
} from "../../../drizzle/schema-sqlite";

export { repertoire, repertoireTune };
