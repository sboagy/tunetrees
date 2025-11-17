/**
 * Tune Override Query Helpers
 *
 * Functions for managing tune overrides (user-specific edits to public tunes).
 * When a user edits a public tune (not private_for them), changes are stored
 * in tune_override table instead of modifying the tune table directly.
 *
 * @module lib/db/queries/tune-overrides
 */

import { and, eq } from "drizzle-orm";
import { queueSync } from "../../sync";
import { generateId } from "../../utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import * as schema from "../schema";

/**
 * Input for creating or updating a tune override
 */
export interface TuneOverrideInput {
  title?: string;
  type?: string;
  structure?: string;
  genre?: string;
  mode?: string;
  incipit?: string;
}

/**
 * Get device ID (browser fingerprint or generate one)
 */
function getDeviceId(): string {
  if (typeof window !== "undefined") {
    let deviceId = localStorage.getItem("tunetrees_device_id");
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("tunetrees_device_id", deviceId);
    }
    return deviceId;
  }
  return "server";
}

/**
 * Get or create a tune override for a user
 * Returns existing override if found, otherwise creates a new one
 * If initial values are provided, they are used when creating a new override
 */
export async function getOrCreateTuneOverride(
  db: SqliteDatabase,
  tuneId: string,
  userId: string,
  initialValues?: TuneOverrideInput
): Promise<{ id: string; isNew: boolean }> {
  // Check if override already exists
  const existing = await db
    .select()
    .from(schema.tuneOverride)
    .where(
      and(
        eq(schema.tuneOverride.tuneRef, tuneId),
        eq(schema.tuneOverride.userRef, userId),
        eq(schema.tuneOverride.deleted, 0)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0].id, isNew: false };
  }

  // Create new override with initial values if provided
  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  const overrideId = generateId();

  const insertValues = {
    id: overrideId,
    tuneRef: tuneId,
    userRef: userId,
    title: initialValues?.title || null,
    type: initialValues?.type || null,
    structure: initialValues?.structure || null,
    genre: initialValues?.genre || null,
    mode: initialValues?.mode || null,
    incipit: initialValues?.incipit || null,
    deleted: 0,
    syncVersion: 0,
    lastModifiedAt: now,
    deviceId: deviceId,
  };

  await db.insert(schema.tuneOverride).values(insertValues);

  // Queue for sync to Supabase - include only non-NULL override fields
  const syncData: any = {
    id: overrideId,
    tuneRef: tuneId,
    userRef: userId,
    deleted: 0,
    syncVersion: 0,
    lastModifiedAt: now,
    deviceId: deviceId,
  };

  // Only include non-NULL override fields in sync data
  if (insertValues.title !== null) syncData.title = insertValues.title;
  if (insertValues.type !== null) syncData.type = insertValues.type;
  if (insertValues.structure !== null)
    syncData.structure = insertValues.structure;
  if (insertValues.genre !== null) syncData.genre = insertValues.genre;
  if (insertValues.mode !== null) syncData.mode = insertValues.mode;
  if (insertValues.incipit !== null) syncData.incipit = insertValues.incipit;

  await queueSync(db, "tune_override", "insert", syncData);

  return { id: overrideId, isNew: true };
}

/**
 * Update a tune override
 * Only updates fields that are provided in the input
 */
export async function updateTuneOverride(
  db: SqliteDatabase,
  overrideId: string,
  input: TuneOverrideInput
): Promise<void> {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  // Build update object with only provided fields
  const updateData: any = {
    lastModifiedAt: now,
    deviceId: deviceId,
  };

  if (input.title !== undefined) updateData.title = input.title || null;
  if (input.type !== undefined) updateData.type = input.type || null;
  if (input.structure !== undefined)
    updateData.structure = input.structure || null;
  if (input.genre !== undefined) updateData.genre = input.genre || null;
  if (input.mode !== undefined) updateData.mode = input.mode || null;
  if (input.incipit !== undefined) updateData.incipit = input.incipit || null;

  await db
    .update(schema.tuneOverride)
    .set(updateData)
    .where(eq(schema.tuneOverride.id, overrideId));

  // Fetch the current record from SQLite to get all current override values
  const currentRecord = await db
    .select()
    .from(schema.tuneOverride)
    .where(eq(schema.tuneOverride.id, overrideId))
    .limit(1);

  if (currentRecord.length === 0) {
    throw new Error(`tune_override ${overrideId} not found after update`);
  }

  // Queue for sync to Supabase - only include fields that are NOT NULL
  // This prevents overwriting existing overrides with NULL values
  const syncData: any = {
    id: overrideId,
    tuneRef: currentRecord[0].tuneRef,
    userRef: currentRecord[0].userRef,
    lastModifiedAt: currentRecord[0].lastModifiedAt,
    deviceId: currentRecord[0].deviceId,
    deleted: currentRecord[0].deleted,
    syncVersion: currentRecord[0].syncVersion,
  };

  // Only include override fields that are NOT NULL
  if (currentRecord[0].title !== null) syncData.title = currentRecord[0].title;
  if (currentRecord[0].type !== null) syncData.type = currentRecord[0].type;
  if (currentRecord[0].structure !== null)
    syncData.structure = currentRecord[0].structure;
  if (currentRecord[0].genre !== null) syncData.genre = currentRecord[0].genre;
  if (currentRecord[0].mode !== null) syncData.mode = currentRecord[0].mode;
  if (currentRecord[0].incipit !== null)
    syncData.incipit = currentRecord[0].incipit;

  await queueSync(db, "tune_override", "update", syncData);
}

/**
 * Get tune override for a specific tune and user
 */
export async function getTuneOverride(
  db: SqliteDatabase,
  tuneId: string,
  userId: string
) {
  const result = await db
    .select()
    .from(schema.tuneOverride)
    .where(
      and(
        eq(schema.tuneOverride.tuneRef, tuneId),
        eq(schema.tuneOverride.userRef, userId),
        eq(schema.tuneOverride.deleted, 0)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Delete a tune override (soft delete)
 */
export async function deleteTuneOverride(
  db: SqliteDatabase,
  overrideId: string
): Promise<void> {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  await db
    .update(schema.tuneOverride)
    .set({
      deleted: 1,
      lastModifiedAt: now,
      deviceId: deviceId,
    })
    .where(eq(schema.tuneOverride.id, overrideId));

  // Queue for sync to Supabase
  await queueSync(db, "tune_override", "delete", { id: overrideId });
}
