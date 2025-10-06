/**
 * Tune Query Helpers (Simplified)
 *
 * Basic query functions for tune operations.
 * More complex queries will be added as needed.
 *
 * @module lib/db/queries/tunes
 */

import { and, asc, eq, isNull, or } from "drizzle-orm";
import { queueSync } from "../../sync";
import type { SqliteDatabase } from "../client-sqlite";
import * as schema from "../schema";
import type { CreateTuneInput, Tune } from "../types";

/**
 * Get a single tune by ID
 */
export async function getTuneById(
  db: SqliteDatabase,
  tuneId: number,
): Promise<Tune | null> {
  const result = await db
    .select()
    .from(schema.tune)
    .where(and(eq(schema.tune.id, tuneId), eq(schema.tune.deleted, false)))
    .limit(1);

  return result[0] || null;
}

/**
 * Get all non-deleted tunes (public tunes)
 * For MVP - will add user filtering later with proper user ID mapping
 */
export async function getAllTunes(db: SqliteDatabase): Promise<Tune[]> {
  return await db
    .select()
    .from(schema.tune)
    .where(
      and(eq(schema.tune.deleted, false), isNull(schema.tune.privateFor)),
    )
    .orderBy(asc(schema.tune.title));
}

/**
 * Get all tunes for a user (includes public and user's private tunes)
 * @param userId - Supabase Auth user UUID
 */
export async function getTunesForUser(
  db: SqliteDatabase,
  userId: string,
): Promise<Tune[]> {
  const userCondition = or(
    isNull(schema.tune.privateFor),
    eq(schema.tune.privateFor, userId),
  );

  if (!userCondition) {
    return [];
  }

  return await db
    .select()
    .from(schema.tune)
    .where(and(eq(schema.tune.deleted, false), userCondition))
    .orderBy(asc(schema.tune.title));
}

/**
 * Create a new tune
 */
export async function createTune(
  db: SqliteDatabase,
  input: CreateTuneInput,
): Promise<Tune> {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  const [tune] = await db
    .insert(schema.tune)
    .values({
      title: input.title,
      type: input.type || null,
      mode: input.mode || null,
      structure: input.structure || null,
      incipit: input.incipit || null,
      genre: input.genre ? parseInt(input.genre, 10) : null,
      privateFor: input.privateFor || null,
      deleted: false,
      sync_version: 0,
      last_modified_at: now,
      device_id: deviceId,
    })
    .returning();

  // Queue for sync to Supabase
  await queueSync(db, "tune", tune.id, "insert", tune);

  return tune;
}

/**
 * Update an existing tune
 */
export async function updateTune(
  db: SqliteDatabase,
  tuneId: number,
  input: Partial<CreateTuneInput>,
): Promise<Tune> {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  // Build update object with only provided fields
  const updateData: Partial<Tune> = {
    last_modified_at: now,
    device_id: deviceId,
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.type !== undefined) updateData.type = input.type || null;
  if (input.mode !== undefined) updateData.mode = input.mode || null;
  if (input.structure !== undefined)
    updateData.structure = input.structure || null;
  if (input.incipit !== undefined) updateData.incipit = input.incipit || null;
  if (input.genre !== undefined)
    updateData.genre = input.genre
      ? parseInt(input.genre, 10)
      : null;
  if (input.privateFor !== undefined)
    updateData.privateFor = input.privateFor || null;

  const [tune] = await db
    .update(schema.tune)
    .set(updateData)
    .where(eq(schema.tune.id, tuneId))
    .returning();

  // Queue for sync to Supabase
  await queueSync(db, "tune", tune.id, "update", tune);

  return tune;
}

/**
 * Delete a tune (soft delete)
 */
export async function deleteTune(
  db: SqliteDatabase,
  tuneId: number,
): Promise<void> {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  await db
    .update(schema.tune)
    .set({
      deleted: true,
      last_modified_at: now,
      device_id: deviceId,
    })
    .where(eq(schema.tune.id, tuneId));

  // Queue for sync to Supabase
  await queueSync(db, "tune", tuneId, "delete");
}

/**
 * Get device ID (browser fingerprint or generate one)
 */
function getDeviceId(): string {
  if (typeof window !== "undefined") {
    let deviceId = localStorage.getItem("tunetrees_device_id");
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      localStorage.setItem("tunetrees_device_id", deviceId);
    }
    return deviceId;
  }
  return "server";
}
