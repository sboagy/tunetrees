/**
 * PostgreSQL Database Client (Supabase)
 *
 * This module provides a Drizzle ORM client for interacting with Supabase PostgreSQL.
 * Used for cloud storage and real-time sync.
 *
 * @module client-postgres
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as relations from "../../../drizzle/migrations/postgres/relations";
// Use the latest schema from drizzle-kit pull
import * as schema from "../../../drizzle/migrations/postgres/schema";

/**
 * PostgreSQL connection instance
 *
 * Configuration:
 * - max: 1 connection (browser environment, no connection pooling needed)
 * - idle_timeout: 20 seconds (close idle connections quickly)
 * - connect_timeout: 10 seconds (fail fast if Supabase unreachable)
 */
const connectionString = import.meta.env.VITE_SUPABASE_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "VITE_SUPABASE_DATABASE_URL environment variable is required. " +
      "Please add it to your .env file with your Supabase connection string."
  );
}

// Create PostgreSQL connection
const client = postgres(connectionString, {
  max: 1, // Single connection for browser
  idle_timeout: 20,
  connect_timeout: 10,
});

/**
 * Drizzle ORM instance for PostgreSQL (Supabase)
 *
 * Features:
 * - Type-safe queries with full TypeScript support
 * - Automatic schema validation
 * - Relationship queries via relations
 * - Prepared statements for performance
 *
 * @example
 * ```typescript
 * import { db } from '@/lib/db/client-postgres';
 * import { userProfile } from '@/drizzle/schema-postgres';
 * import { eq } from 'drizzle-orm';
 *
 * // Select user by Supabase UUID
 * const user = await db
 *   .select()
 *   .from(userProfile)
 *   .where(eq(userProfile.supabaseUserId, userId))
 *   .limit(1);
 * ```
 */
export const db = drizzle(client, {
  schema: { ...schema, ...relations },
});

/**
 * Close the PostgreSQL connection
 *
 * Should be called when shutting down the application
 * or when no longer needed (e.g., in tests).
 */
export async function closeConnection() {
  await client.end();
}

/**
 * Export schema for convenient imports
 */
export { schema, relations };

/**
 * Type exports for use throughout the application
 */
export type Database = typeof db;
export type Schema = typeof schema;
