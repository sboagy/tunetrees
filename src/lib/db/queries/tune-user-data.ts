/**
 * Tune User-Specific Data Queries
 *
 * Functions to manage user-specific fields for tunes:
 * - playlist_tune.learned (when user learned the tune in a playlist)
 * - practice_record fields (latest practice data: practiced, quality, FSRS/SM2 fields)
 * - notes (private notes about the tune)
 *
 * These fields are separate from the base tune data to support:
 * - User-specific overrides without modifying public tunes
 * - Per-playlist tracking (same tune in multiple playlists)
 * - Historical practice records
 *
 * @module lib/db/queries/tune-user-data
 */

import { and, desc, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { note, playlistTune, practiceRecord } from "../schema";

/**
 * Update the learned date for a tune in a specific playlist
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist UUID
 * @param tuneId - Tune UUID
 * @param learnedDate - ISO 8601 timestamp when tune was learned (null to clear)
 */
export async function updatePlaylistTuneLearned(
  db: SqliteDatabase,
  playlistId: string,
  tuneId: string,
  learnedDate: string | null
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .update(playlistTune)
    .set({
      learned: learnedDate,
      lastModifiedAt: now,
    })
    .where(
      and(
        eq(playlistTune.playlistRef, playlistId),
        eq(playlistTune.tuneRef, tuneId)
      )
    );

  // Sync is handled automatically by SQL triggers populating sync_outbox
}

/**
 * Update or create a practice record with user-specific fields
 *
 * This updates the LATEST practice record for a tune in a playlist.
 * Creates a new record if none exists.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist UUID
 * @param tuneId - Tune UUID
 * @param data - Practice data to update
 */
export async function upsertPracticeRecord(
  db: SqliteDatabase,
  playlistId: string,
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

  // Get the latest practice record for this tune/playlist combination
  const existing = await db
    .select()
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.playlistRef, playlistId)
      )
    )
    .orderBy(desc(practiceRecord.practiced), desc(practiceRecord.lastModifiedAt))
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
      playlistRef: playlistId,
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
 * @param playlistId - Optional playlist UUID for context
 * @returns Note ID
 */
export async function getOrCreatePrivateNote(
  db: SqliteDatabase,
  tuneId: string,
  userId: string,
  playlistId?: string
): Promise<string> {
  // Look for existing private note
  const existing = await db
    .select()
    .from(note)
    .where(
      and(
        eq(note.tuneRef, tuneId),
        eq(note.userRef, userId),
        eq(note.public, 0),
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
      playlistRef: playlistId || null,
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
 * - playlist_tune (learned date)
 * - practice_record (latest practice data)
 * - note (private notes)
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune UUID
 * @param userId - User UUID
 * @param playlistId - Playlist UUID
 * @returns Complete tune data for editor
 */
export async function getTuneEditorData(
  db: SqliteDatabase,
  tuneId: string,
  userId: string,
  playlistId: string
): Promise<any> {
  // Get base tune data (with overrides applied)
  const { getTuneForUserById } = await import("./tunes");
  const tune = await getTuneForUserById(db, tuneId, userId);

  if (!tune) {
    return null;
  }

  // Get playlist_tune data (learned date)
  const playlistTuneData = await db
    .select()
    .from(playlistTune)
    .where(
      and(
        eq(playlistTune.tuneRef, tuneId),
        eq(playlistTune.playlistRef, playlistId)
      )
    )
    .limit(1);

  // Get latest practice record
  const latestPractice = await db
    .select()
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.playlistRef, playlistId)
      )
    )
    .orderBy(desc(practiceRecord.practiced), desc(practiceRecord.lastModifiedAt))
    .limit(1);

  // Get private notes
  const notes = await db
    .select()
    .from(note)
    .where(
      and(
        eq(note.tuneRef, tuneId),
        eq(note.userRef, userId),
        eq(note.public, 0),
        eq(note.deleted, 0)
      )
    )
    .orderBy(desc(note.createdDate))
    .limit(1);

  // Merge all data
  const result: any = {
    ...tune,
    learned: playlistTuneData?.[0]?.learned || null,
  };

  if (latestPractice && latestPractice.length > 0) {
    const pr = latestPractice[0];
    result.practiced = pr.practiced;
    result.quality = pr.quality;
    result.difficulty = pr.difficulty;
    result.stability = pr.stability;
    result.step = pr.step;
    result.state = pr.state;
    result.repetitions = pr.repetitions;
    result.due = pr.due;
    result.easiness = pr.easiness;
    result.interval = pr.interval;
  }

  if (notes && notes.length > 0) {
    result.notes_private = notes[0].noteText;
  }

  return result;
}
