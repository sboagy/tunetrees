/**
 * Practice Record Queries
 *
 * Functions to manage practice records for tunes.
 *
 * @module lib/db/queries/practice-records
 */

import { and, desc, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { practiceRecord } from "../schema";

/**
 * Get all practice records for a tune in a repertoire
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune UUID
 * @param repertoireId - Repertoire UUID
 * @returns Array of practice records, ordered by date (newest first)
 */
export async function getPracticeRecordsForTune(
  db: SqliteDatabase,
  tuneId: string,
  repertoireId: string
) {
  return await db
    .select()
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.repertoireRef, repertoireId)
      )
    )
    .orderBy(desc(practiceRecord.practiced));
}

/**
 * Create a new practice record
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire UUID
 * @param tuneId - Tune UUID
 * @param data - Initial practice data
 * @returns The created practice record ID
 */
export async function createPracticeRecord(
  db: SqliteDatabase,
  repertoireId: string,
  tuneId: string,
  data: {
    practiced?: string | null;
    quality?: number | null;
  }
): Promise<string> {
  const now = new Date().toISOString();
  const id = generateId();

  await db.insert(practiceRecord).values({
    id,
    repertoireRef: repertoireId,
    tuneRef: tuneId,
    practiced: data.practiced || now,
    quality: data.quality ?? 3,
    easiness: 2.5,
    difficulty: 0.3,
    stability: 1,
    interval: 1,
    step: 0,
    repetitions: 0,
    lapses: 0,
    elapsedDays: 0,
    state: 0, // New
    due: now,
    backupPracticed: null,
    goal: "recall",
    technique: null,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: "local",
  });

  // CRITICAL: Persist to IndexedDB immediately to prevent data loss on refresh
  const { persistDb } = await import("../client-sqlite");
  await persistDb();

  return id;
}

/**
 * Update a practice record
 *
 * @param db - SQLite database instance
 * @param recordId - Practice record UUID
 * @param data - Fields to update
 */
export async function updatePracticeRecord(
  db: SqliteDatabase,
  recordId: string,
  data: Partial<{
    practiced: string | null;
    quality: number | null;
    due: string | null;
    difficulty: number | null;
    stability: number | null;
    step: number | null;
    state: number | null;
    repetitions: number | null;
    easiness: number | null;
    interval: number | null;
  }>
): Promise<void> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    lastModifiedAt: now,
  };

  if (data.practiced !== undefined) updateData.practiced = data.practiced;
  if (data.quality !== undefined) updateData.quality = data.quality;
  if (data.due !== undefined) updateData.due = data.due;
  if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
  if (data.stability !== undefined) updateData.stability = data.stability;
  if (data.step !== undefined) updateData.step = data.step;
  if (data.state !== undefined) updateData.state = data.state;
  if (data.repetitions !== undefined) updateData.repetitions = data.repetitions;
  if (data.easiness !== undefined) updateData.easiness = data.easiness;
  if (data.interval !== undefined) updateData.interval = data.interval;

  await db
    .update(practiceRecord)
    .set(updateData)
    .where(eq(practiceRecord.id, recordId));

  // CRITICAL: Persist to IndexedDB immediately to prevent data loss on refresh
  const { persistDb } = await import("../client-sqlite");
  await persistDb();
}

/**
 * Delete a practice record (hard delete)
 *
 * @param db - SQLite database instance
 * @param recordId - Practice record UUID
 */
export async function deletePracticeRecord(
  db: SqliteDatabase,
  recordId: string
): Promise<void> {
  await db.delete(practiceRecord).where(eq(practiceRecord.id, recordId));

  // CRITICAL: Persist to IndexedDB immediately to prevent data loss on refresh
  const { persistDb } = await import("../client-sqlite");
  await persistDb();
}

/**
 * Get a single practice record by ID
 *
 * @param db - SQLite database instance
 * @param recordId - Practice record UUID
 * @returns The practice record or null
 */
export async function getPracticeRecordById(
  db: SqliteDatabase,
  recordId: string
) {
  const result = await db
    .select()
    .from(practiceRecord)
    .where(eq(practiceRecord.id, recordId))
    .limit(1);

  return result?.[0] || null;
}
