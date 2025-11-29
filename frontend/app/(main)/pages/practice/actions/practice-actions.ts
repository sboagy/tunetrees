"use server";

// Server action wrappers around queries.ts to prevent client components
// from importing that large server module directly.

import {
  createReference,
  deleteReference,
  updateReference,
  getReferences,
  createEmptyTune,
  getInstrumentById,
  getPlaylistById,
  getPlaylistTuneOverview,
  queryReferences,
  searchTunesByTitle,
  // Newly wrapped queries
  updatePlaylistTunes,
  updateTunes,
  createNote,
  deleteNote,
  getNotes,
  updateNote,
  reorderNotes,
  reorderReferences,
  createPlaylistTune,
  createPracticeRecord,
  deleteTune,
  getAllGenres,
  getTuneTypesByGenre,
  updatePracticeRecord,
  upsertPracticeRecord,
  updateTuneInPlaylistFromTuneOverview,
  getTunesOnlyIntoOverview,
  intersectPlaylistTunes,
  getRepertoireTunesOverview,
  getScheduledTunesOverview,
  getTuneStaged,
  // getTuneStaged NOT wrapped (server component uses it directly)
  getPracticeQueue,
  getPracticeQueueEntries,
  refillPracticeQueue,
  addTunesToPracticeQueue,
} from "../queries";
import type {
  IReferenceData,
  ITuneOverview,
  ITune,
  IInstrument,
  IPlaylist,
  ITheSessionTuneSummary,
  INote,
  IPlaylistTune,
  IPracticeRecord,
  IGenre,
  ITuneType,
  IPracticeQueueEntry,
} from "../types";

export async function createReferenceAction(
  reference: IReferenceData,
): ReturnType<typeof createReference> {
  return createReference(reference);
}
export async function deleteReferenceAction(
  referenceId: number,
): ReturnType<typeof deleteReference> {
  return deleteReference(referenceId);
}
export async function updateReferenceAction(
  referenceId: number,
  referenceUpdate: Partial<IReferenceData>,
): ReturnType<typeof updateReference> {
  return updateReference(referenceId, referenceUpdate);
}
export async function getReferencesAction(
  tuneRef: number,
  userRef: number | null,
): ReturnType<typeof getReferences> {
  return getReferences(tuneRef, userRef);
}

export async function createEmptyTuneAction(
  tune: Partial<ITuneOverview>,
  playlistRef?: number,
): ReturnType<typeof createEmptyTune> {
  return createEmptyTune(tune, playlistRef);
}
export async function getInstrumentByIdAction(
  instrumentId: number,
): ReturnType<typeof getInstrumentById> {
  return getInstrumentById(instrumentId);
}
export async function getPlaylistByIdAction(
  playlistId: number,
): ReturnType<typeof getPlaylistById> {
  return getPlaylistById(playlistId);
}
export async function getPlaylistTuneOverviewAction(
  userId: number,
  playlistId: number,
  tuneId: number,
): ReturnType<typeof getPlaylistTuneOverview> {
  return getPlaylistTuneOverview(userId, playlistId, tuneId);
}
export async function queryReferencesAction(
  url: string,
): ReturnType<typeof queryReferences> {
  return queryReferences(url);
}
export async function searchTunesByTitleAction(
  title: string,
  limit = 10,
): ReturnType<typeof searchTunesByTitle> {
  return searchTunesByTitle(title, limit);
}

// --------------------------
// Additional wrappers
// --------------------------

export async function updatePlaylistTunesAction(
  tuneIds: number[],
  playlistId: number,
  update: Partial<IPlaylistTune>,
): ReturnType<typeof updatePlaylistTunes> {
  return updatePlaylistTunes(tuneIds, playlistId, update);
}
export async function updateTunesAction(
  tuneIds: number[],
  update: Partial<ITuneOverview>,
): ReturnType<typeof updateTunes> {
  return updateTunes(tuneIds, update);
}

export async function createNoteAction(
  note: INote,
): ReturnType<typeof createNote> {
  return createNote(note);
}
export async function deleteNoteAction(
  noteId: number,
): ReturnType<typeof deleteNote> {
  return deleteNote(noteId);
}
export async function getNotesAction(
  tuneRef: number,
  playlistRef: number,
  userRef: number,
  displayPublic: boolean,
): ReturnType<typeof getNotes> {
  return getNotes(tuneRef, playlistRef, userRef, displayPublic);
}
export async function updateNoteAction(
  noteId: number,
  note: Partial<INote>,
): ReturnType<typeof updateNote> {
  return updateNote(noteId, note);
}

export async function reorderNotesAction(
  noteIds: number[],
): ReturnType<typeof reorderNotes> {
  return reorderNotes(noteIds);
}

export async function reorderReferencesAction(
  referenceIds: number[],
): ReturnType<typeof reorderReferences> {
  return reorderReferences(referenceIds);
}

export async function createPlaylistTuneAction(
  playlistTune: IPlaylistTune,
): ReturnType<typeof createPlaylistTune> {
  return createPlaylistTune(playlistTune);
}
export async function createPracticeRecordAction(
  tuneId: number,
  playlistId: number,
  practiceRecord: Partial<IPracticeRecord>,
): ReturnType<typeof createPracticeRecord> {
  return createPracticeRecord(tuneId, playlistId, practiceRecord);
}
export async function deleteTuneAction(
  tuneId: number,
): ReturnType<typeof deleteTune> {
  return deleteTune(tuneId);
}
export async function getAllGenresAction(): ReturnType<typeof getAllGenres> {
  return getAllGenres();
}
export async function getTuneTypesByGenreAction(
  genreId: string,
): ReturnType<typeof getTuneTypesByGenre> {
  return getTuneTypesByGenre(genreId);
}
export async function updatePracticeRecordAction(
  tuneId: number,
  playlistId: number,
  practiceRecord: Partial<IPracticeRecord>,
): ReturnType<typeof updatePracticeRecord> {
  return updatePracticeRecord(tuneId, playlistId, practiceRecord);
}

export async function upsertPracticeRecordAction(
  tuneId: number,
  playlistId: number,
  practiceRecord: Partial<IPracticeRecord>,
): ReturnType<typeof upsertPracticeRecord> {
  return upsertPracticeRecord(tuneId, playlistId, practiceRecord);
}
export async function updateTuneInPlaylistFromTuneOverviewAction(
  userId: number,
  playlistId: number,
  tuneId: number,
  saveAsOverride: boolean,
  dataLocal: Partial<ITuneOverview>,
): ReturnType<typeof updateTuneInPlaylistFromTuneOverview> {
  return updateTuneInPlaylistFromTuneOverview(
    userId,
    playlistId,
    tuneId,
    saveAsOverride,
    dataLocal,
  );
}

export async function getTunesOnlyIntoOverviewAction(
  showDeleted: boolean,
): ReturnType<typeof getTunesOnlyIntoOverview> {
  return getTunesOnlyIntoOverview(showDeleted);
}
export async function intersectPlaylistTunesAction(
  tuneIds: number[],
  playlistId: number,
): ReturnType<typeof intersectPlaylistTunes> {
  return intersectPlaylistTunes(tuneIds, playlistId);
}
export async function getRepertoireTunesOverviewAction(
  userId: number,
  playlistId: number,
  showDeleted: boolean,
  sortingState: import("@tanstack/react-table").SortingState | null,
): ReturnType<typeof getRepertoireTunesOverview> {
  return getRepertoireTunesOverview(
    userId,
    playlistId,
    showDeleted,
    sortingState,
  );
}
export async function getScheduledTunesOverviewAction(
  userId: number,
  playlistId: number,
  sitdownDate: Date | null,
  showDeleted: boolean,
): ReturnType<typeof getScheduledTunesOverview> {
  return getScheduledTunesOverview(
    userId,
    playlistId,
    sitdownDate ?? new Date(0),
    showDeleted,
  );
}

export async function getTuneStagedAction(
  userId: string | number,
  playlistId: string | number,
  tuneId: string | number,
): ReturnType<typeof getTuneStaged> {
  return getTuneStaged(String(userId), String(playlistId), String(tuneId));
}

export async function getPracticeQueueAction(
  userId: number,
  playlistId: number,
  sitdownDate: Date,
  forceRegen = false,
): ReturnType<typeof getPracticeQueue> {
  return getPracticeQueue(userId, playlistId, sitdownDate, forceRegen);
}

/**
 * Normalized variant: always returns a flat array of IPracticeQueueEntry.
 * Keeps existing getPracticeQueueAction (meta wrapper) intact for views that need counts.
 */
export async function getPracticeQueueEntriesAction(
  userId: number,
  playlistId: number,
  sitdownDate: Date,
  forceRegen = false,
): Promise<IPracticeQueueEntry[]> {
  return getPracticeQueueEntries(userId, playlistId, sitdownDate, forceRegen);
}

export async function refillPracticeQueueAction(
  userId: number,
  playlistId: number,
  sitdownDate: Date,
  count = 5,
): ReturnType<typeof refillPracticeQueue> {
  return refillPracticeQueue(userId, playlistId, sitdownDate, count);
}

export async function addTunesToPracticeQueueAction(
  userId: number,
  playlistId: number,
  tuneIds: number[],
  sitdownDate: Date,
): ReturnType<typeof addTunesToPracticeQueue> {
  return addTunesToPracticeQueue(userId, playlistId, tuneIds, sitdownDate);
}

export type {
  IReferenceData,
  ITuneOverview,
  ITune,
  IInstrument,
  IPlaylist,
  ITheSessionTuneSummary,
  INote,
  IPlaylistTune,
  IPracticeRecord,
  IGenre,
  ITuneType,
};
