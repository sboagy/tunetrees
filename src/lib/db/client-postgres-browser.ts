/**
 * PostgreSQL Database Client (Browser-Compatible)
 *
 * This module provides a browser-compatible Drizzle ORM client for Supabase.
 * Unlike client-postgres.ts (which uses Node.js postgres package),
 * this uses Supabase JS client which works in browsers.
 *
 * @module client-postgres-browser
 */

import { drizzle } from "drizzle-orm/postgres-js";
import * as relations from "../../../drizzle/migrations/postgres/relations";
import * as schema from "../../../drizzle/migrations/postgres/schema";
import { supabase } from "../supabase/client";

/**
 * Browser-compatible Drizzle client using Supabase
 *
 * This wraps the Supabase JS client with Drizzle ORM for type-safe queries.
 * Works in the browser (no Node.js dependencies).
 *
 * @example
 * ```typescript
 * import { db } from '@/lib/db/client-postgres-browser';
 * import { tune } from '@/drizzle/schema';
 * import { eq } from 'drizzle-orm';
 *
 * // Type-safe queries in the browser
 * const tunes = await db.select().from(tune).where(eq(tune.userId, userId));
 * ```
 */
export const db = drizzle(supabase as any, {
  schema: { ...schema, ...relations },
});

/**
 * Export schema for convenient imports
 */
export { schema, relations };

/**
 * Type exports
 */
export type Database = typeof db;
export type Schema = typeof schema;
