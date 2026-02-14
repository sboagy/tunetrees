/**
 * Tune User-Specific Data Queries
 *
 * Functions to manage user-specific fields for tunes:
 * - repertoire_tune.learned (when user learned the tune in a repertoire)
 * - practice_record fields (latest practice data: practiced, quality, FSRS/SM2 fields)
 * - notes (private notes about the tune)
 *
 * These fields are separate from the base tune data to support:
 * - User-specific overrides without modifying public tunes
 * - Per-repertoire tracking (same tune in multiple repertoires)
 * - Historical practice records
 *
 * @module lib/db/queries/tune-user-data
 */

import { and, desc, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import {
  note,
  repertoireTune as repertoireTune,
  practiceRecord,
} from "../schema";

/**
 * Update the learned date for a tune in a specific repertoire
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire UUID
 * @param tuneId - Tune UUID
 * @param learnedDate - ISO 8601 timestamp when tune was learned (null to clear)
 */
export async function updateRepertoireTuneLearned(
  db: SqliteDatabase,
  repertoireId: string,
  tuneId: string,
  learnedDate: string | null
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .update(repertoireTune)
    .set({
      learned: learnedDate,
      lastModifiedAt: now,
    })
    .where(
      and(
        eq(repertoireTune.repertoireRef, repertoireId),
        eq(repertoireTune.tuneRef, tuneId)
      )
    );

  // Sync is handled automatically by SQL triggers populating sync_outbox
}

/**
 * Update repertoire_tune fields (learned, goal, scheduled)
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire UUID
 * @param tuneId - Tune UUID
 * @param data - Fields to update
 */
export async function updateRepertoireTuneFields(
  db: SqliteDatabase,
  repertoireId: string,
  tuneId: string,
  data: {
    learned?: string | null;
    goal?: string | null;
    scheduled?: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    lastModifiedAt: now,
  };

  if (data.learned !== undefined) {
    updateData.learned = data.learned;
  }
  if (data.goal !== undefined) {
    updateData.goal = data.goal;
  }
  if (data.scheduled !== undefined) {
    updateData.scheduled = data.scheduled;
  }

  await db
    .update(repertoireTune)
    .set(updateData)
    .where(
      and(
        eq(repertoireTune.repertoireRef, repertoireId),
        eq(repertoireTune.tuneRef, tuneId)
      )
    );

  // Sync is handled automatically by SQL triggers populating sync_outbox
}

/**
 * Update or create a practice record with user-specific fields
 *
 * This updates the LATEST practice record for a tune in a repertoire.
 * Creates a new record if none exists.
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire UUID
 * @param tuneId - Tune UUID
 * @param data - Practice data to update
 */
export async function upsertPracticeRecord(
  db: SqliteDatabase,
  repertoireId: string,
  tuneId: string,
  data: {
    practiced?: string | null;
    quality?: number | null;
    difficulty?: number | null;
    stability?: number | null;
    step?: number | null;
    state?: number | null;
    repetitions?: number | null;
    due?: string | null;
    easiness?: number | null;
    interval?: number | null;
  }
): Promise<void> {
  const now = new Date().toISOString();

  // Get the latest practice record for this tune/repertoire combination
  const existing = await db
    .select()
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.repertoireRef, repertoireId)
      )
    )
    .orderBy(
      desc(practiceRecord.practiced),
      desc(practiceRecord.lastModifiedAt)
    )
    .limit(1);

  if (existing && existing.length > 0) {
    // Update existing record
    const updateData: any = {
      lastModifiedAt: now,
    };

    // Only update fields that are provided
    if (data.practiced !== undefined) updateData.practiced = data.practiced;
    if (data.quality !== undefined) updateData.quality = data.quality;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.stability !== undefined) updateData.stability = data.stability;
    if (data.step !== undefined) updateData.step = data.step;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.repetitions !== undefined)
      updateData.repetitions = data.repetitions;
    if (data.due !== undefined) updateData.due = data.due;
    if (data.easiness !== undefined) updateData.easiness = data.easiness;
    if (data.interval !== undefined) updateData.interval = data.interval;

    await db
      .update(practiceRecord)
      .set(updateData)
      .where(eq(practiceRecord.id, existing[0].id));
  } else {
    // Create new practice record
    await db.insert(practiceRecord).values({
      id: generateId(),
      repertoireRef: repertoireId,
      tuneRef: tuneId,
      practiced: data.practiced || null,
      quality: data.quality || null,
      easiness: data.easiness || null,
      difficulty: data.difficulty || null,
      stability: data.stability || null,
      interval: data.interval || null,
      step: data.step || null,
      repetitions: data.repetitions || null,
      lapses: 0,
      elapsedDays: 0,
      state: data.state || 0, // State 0 = New
      due: data.due || null,
      backupPracticed: null,
      goal: "recall",
      technique: null,
      syncVersion: 1,
      lastModifiedAt: now,
      deviceId: "local",
    });
  }

  // Sync is handled automatically by SQL triggers populating sync_outbox
}

/**
 * Get or create a private note for a tune
 *
 * Returns the first private note for the tune, or creates one if none exists.
 * Multiple notes per tune are supported, but for the editor we use a single note.
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune UUID
 * @param userId - User UUID
 * @param repertoireId - Optional repertoire UUID for context
 * @returns Note ID
 */
export async function getOrCreatePrivateNote(
  db: SqliteDatabase,
  tuneId: string,
  userId: string,
  repertoireId?: string
): Promise<string> {
  // Look for existing private note
  const existing = await db
    .select()
    .from(note)
    .where(
      and(
        eq(note.tuneRef, tuneId),
        eq(note.userRef, userId),
        eq(note.deleted, 0)
      )
    )
    .orderBy(desc(note.createdDate))
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  // Create new private note
  const now = new Date().toISOString();
  const newNote = await db
    .insert(note)
    .values({
      id: generateId(),
      userRef: userId,
      tuneRef: tuneId,
      repertoireRef: repertoireId || null,
      createdDate: now,
      noteText: "",
      public: 0,
      favorite: 0,
      displayOrder: 0,
      deleted: 0,
      syncVersion: 1,
      lastModifiedAt: now,
      deviceId: "local",
    })
    .returning();

  return newNote[0].id;
}

/**
 * Update a note's text content
 *
 * @param db - SQLite database instance
 * @param noteId - Note UUID
 * @param noteText - New note text content
 */
export async function updateNoteText(
  db: SqliteDatabase,
  noteId: string,
  noteText: string
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .update(note)
    .set({
      noteText,
      lastModifiedAt: now,
    })
    .where(eq(note.id, noteId));

  // Sync is handled automatically by SQL triggers populating sync_outbox
}

/**
 * Get the complete tune data for editing, including user-specific fields
 *
 * Merges data from:
 * - tune (or tune_override)
 * - repertoire_tune (learned, goal, scheduled, current)
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune UUID
 * @param userId - User UUID
 * @param repertoireId - Repertoire UUID
 * @returns Complete tune data for editor
 */
export async function getTuneEditorData(
  db: SqliteDatabase,
  tuneId: string,
  userId: string,
  repertoireId: string
): Promise<any> {
  // Get base tune data (with overrides applied)
  const { getTuneForUserById } = await import("./tunes");
  const tune = await getTuneForUserById(db, tuneId, userId);

  if (!tune) {
    return null;
  }

  // Get repertoire_tune data (learned, goal, scheduled, current)
  const repertoireTuneData = await db
    .select()
    .from(repertoireTune)
    .where(
      and(
        eq(repertoireTune.tuneRef, tuneId),
        eq(repertoireTune.repertoireRef, repertoireId)
      )
    )
    .limit(1);

  // Get latest practice record to fetch latest_due
  const latestPractice = await db
    .select()
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.repertoireRef, repertoireId)
      )
    )
    .orderBy(desc(practiceRecord.id))
    .limit(1);

  // Merge all data
  const result: any = {
    ...tune,
    learned: repertoireTuneData?.[0]?.learned || null,
    goal: repertoireTuneData?.[0]?.goal || "recall",
    scheduled: repertoireTuneData?.[0]?.scheduled || null,
    current: repertoireTuneData?.[0]?.current || null,
    latest_due: latestPractice?.[0]?.due || null,
  };

  return result;
}
