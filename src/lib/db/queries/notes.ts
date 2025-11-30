import { and, asc, desc, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils/uuid";
import { queueSync } from "../../sync";
import type { SqliteDatabase } from "../client-sqlite";
import * as schema from "../schema";
import type { Note } from "../types";

export interface CreateNoteData {
  tuneRef: string; // UUID
  noteText: string;
  userRef?: string; // UUID
  playlistRef?: string; // UUID
  public?: boolean;
  favorite?: boolean;
}

export interface UpdateNoteData {
  noteText?: string;
  public?: boolean;
  favorite?: boolean;
  displayOrder?: number;
}

/**
 * Get all notes for a specific tune
 * Returns only non-deleted notes, ordered by display order then creation date
 */
export async function getNotesByTune(
  db: SqliteDatabase,
  tuneId: string // UUID
): Promise<Note[]> {
  return await db
    .select()
    .from(schema.note)
    .where(and(eq(schema.note.tuneRef, tuneId), eq(schema.note.deleted, 0)))
    .orderBy(asc(schema.note.displayOrder), desc(schema.note.createdDate))
    .all();
}

/**
 * Get all notes for a specific playlist
 */
export async function getNotesByPlaylist(
  db: SqliteDatabase,
  playlistId: string // UUID
): Promise<Note[]> {
  return await db
    .select()
    .from(schema.note)
    .where(
      and(eq(schema.note.playlistRef, playlistId), eq(schema.note.deleted, 0))
    )
    .orderBy(asc(schema.note.displayOrder), desc(schema.note.createdDate))
    .all();
}

/**
 * Get a single note by ID
 */
export async function getNoteById(
  db: SqliteDatabase,
  noteId: string // UUID
): Promise<Note | undefined> {
  const notes = await db
    .select()
    .from(schema.note)
    .where(and(eq(schema.note.id, noteId), eq(schema.note.deleted, 0)))
    .all();

  return notes[0];
}

/**
 * Create a new note
 * Returns the created note with its ID
 */
export async function createNote(
  db: SqliteDatabase,
  data: CreateNoteData
): Promise<Note> {
  const now = new Date().toISOString();

  const result = await db
    .insert(schema.note)
    .values({
      id: generateId(), // Generate UUID
      tuneRef: data.tuneRef,
      noteText: data.noteText,
      userRef: data.userRef || null,
      playlistRef: data.playlistRef || null,
      createdDate: now,
      public: data.public ? 1 : 0,
      favorite: data.favorite ? 1 : 0,
      deleted: 0,
      lastModifiedAt: now,
      syncVersion: 1,
    })
    .returning()
    .get();

  // Queue for sync to Supabase
  await queueSync(db, "note", "insert", result);

  return result as Note;
}

/**
 * Update an existing note
 * Only updates provided fields
 */
export async function updateNote(
  db: SqliteDatabase,
  noteId: string, // UUID
  data: UpdateNoteData
): Promise<Note | undefined> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    lastModifiedAt: now,
  };

  if (data.noteText !== undefined) {
    updateData.noteText = data.noteText;
  }

  if (data.public !== undefined) {
    updateData.public = data.public ? 1 : 0;
  }

  if (data.favorite !== undefined) {
    updateData.favorite = data.favorite ? 1 : 0;
  }

  if (data.displayOrder !== undefined) {
    updateData.displayOrder = data.displayOrder;
  }

  const result = await db
    .update(schema.note)
    .set(updateData)
    .where(eq(schema.note.id, noteId))
    .returning()
    .get();

  // Queue for sync to Supabase
  if (result) {
    await queueSync(db, "note", "update", result);
  }

  return result as Note | undefined;
}

/**
 * Update display order for multiple notes
 * Takes an array of note IDs in the desired order and updates their display_order
 *
 * Note: Uses sequential updates which is acceptable for typical note counts (1-5 per tune).
 * For very large lists, consider using a transaction wrapper for better performance.
 */
export async function updateNoteOrder(
  db: SqliteDatabase,
  noteIds: string[] // UUIDs in desired order
): Promise<void> {
  const now = new Date().toISOString();

  // Update each note's display_order based on its index in the array
  for (let i = 0; i < noteIds.length; i++) {
    const result = await db
      .update(schema.note)
      .set({
        displayOrder: i,
        lastModifiedAt: now,
      })
      .where(eq(schema.note.id, noteIds[i]))
      .returning()
      .get();

    // Queue each update for sync to Supabase
    if (result) {
      await queueSync(db, "note", "update", result);
    }
  }
}

/**
 * Soft delete a note
 * Sets deleted = 1 instead of removing from database
 */
export async function deleteNote(
  db: SqliteDatabase,
  noteId: string // UUID
): Promise<boolean> {
  const now = new Date().toISOString();

  const result = await db
    .update(schema.note)
    .set({
      deleted: 1,
      lastModifiedAt: now,
    })
    .where(eq(schema.note.id, noteId))
    .returning()
    .get();

  // Queue soft delete for sync to Supabase
  if (result) {
    await queueSync(db, "note", "update", result);
  }

  return result !== undefined;
}

/**
 * Permanently delete a note (hard delete)
 * Use with caution - this cannot be undone
 */
export async function permanentlyDeleteNote(
  db: SqliteDatabase,
  noteId: string // UUID
): Promise<boolean> {
  const result = await db
    .delete(schema.note)
    .where(eq(schema.note.id, noteId))
    .returning()
    .get();

  return result !== undefined;
}
