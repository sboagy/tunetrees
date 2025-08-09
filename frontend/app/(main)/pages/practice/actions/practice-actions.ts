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
  createPlaylistTune,
  createPracticeRecord,
  deleteTune,
  getAllGenres,
  getTuneTypesByGenre,
  updatePracticeRecord,
  updateTuneInPlaylistFromTuneOverview,
  getTunesOnlyIntoOverview,
  intersectPlaylistTunes,
  getRepertoireTunesOverview,
  getScheduledTunesOverview,
  getTuneStaged,
  // getTuneStaged NOT wrapped (server component uses it directly)
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
} from "../types";

export async function createReferenceAction(reference: IReferenceData) {
  return createReference(reference);
}
export async function deleteReferenceAction(referenceId: number) {
  return deleteReference(referenceId);
}
export async function updateReferenceAction(
  referenceId: number,
  referenceUpdate: Partial<IReferenceData>,
) {
  return updateReference(referenceId, referenceUpdate);
}
export async function getReferencesAction(
  tuneRef: number,
  userRef: number | null,
) {
  return getReferences(tuneRef, userRef);
}

export async function createEmptyTuneAction(
  tune: Partial<ITuneOverview>,
  playlistRef?: number,
) {
  return createEmptyTune(tune, playlistRef);
}
export async function getInstrumentByIdAction(instrumentId: number) {
  return getInstrumentById(instrumentId);
}
export async function getPlaylistByIdAction(playlistId: number) {
  return getPlaylistById(playlistId);
}
export async function getPlaylistTuneOverviewAction(
  userId: number,
  playlistId: number,
  tuneId: number,
) {
  return getPlaylistTuneOverview(userId, playlistId, tuneId);
}
export async function queryReferencesAction(url: string) {
  return queryReferences(url);
}
export async function searchTunesByTitleAction(title: string, limit = 10) {
  return searchTunesByTitle(title, limit);
}

// --------------------------
// Additional wrappers
// --------------------------

export async function updatePlaylistTunesAction(
  tuneIds: number[],
  playlistId: number,
  update: Partial<IPlaylistTune>,
) {
  return updatePlaylistTunes(tuneIds, playlistId, update);
}
export async function updateTunesAction(
  tuneIds: number[],
  update: Partial<ITuneOverview>,
) {
  return updateTunes(tuneIds, update);
}

export async function createNoteAction(note: INote) {
  return createNote(note);
}
export async function deleteNoteAction(noteId: number) {
  return deleteNote(noteId);
}
export async function getNotesAction(
  tuneRef: number,
  playlistRef: number,
  userRef: number,
  displayPublic: boolean,
) {
  return getNotes(tuneRef, playlistRef, userRef, displayPublic);
}
export async function updateNoteAction(noteId: number, note: Partial<INote>) {
  return updateNote(noteId, note);
}

export async function createPlaylistTuneAction(playlistTune: IPlaylistTune) {
  return createPlaylistTune(playlistTune);
}
export async function createPracticeRecordAction(
  tuneId: number,
  playlistId: number,
  practiceRecord: Partial<IPracticeRecord>,
) {
  return createPracticeRecord(tuneId, playlistId, practiceRecord);
}
export async function deleteTuneAction(tuneId: number) {
  return deleteTune(tuneId);
}
export async function getAllGenresAction(): Promise<IGenre[]> {
  return getAllGenres();
}
export async function getTuneTypesByGenreAction(
  genreId: string,
): Promise<ITuneType[]> {
  return getTuneTypesByGenre(genreId);
}
export async function updatePracticeRecordAction(
  tuneId: number,
  playlistId: number,
  practiceRecord: Partial<IPracticeRecord>,
) {
  return updatePracticeRecord(tuneId, playlistId, practiceRecord);
}
export async function updateTuneInPlaylistFromTuneOverviewAction(
  userId: number,
  playlistId: number,
  tuneId: number,
  saveAsOverride: boolean,
  dataLocal: Partial<ITuneOverview>,
) {
  return updateTuneInPlaylistFromTuneOverview(
    userId,
    playlistId,
    tuneId,
    saveAsOverride,
    dataLocal,
  );
}

export async function getTunesOnlyIntoOverviewAction(showDeleted: boolean) {
  return getTunesOnlyIntoOverview(showDeleted);
}
export async function intersectPlaylistTunesAction(
  tuneIds: number[],
  playlistId: number,
) {
  return intersectPlaylistTunes(tuneIds, playlistId);
}
export async function getRepertoireTunesOverviewAction(
  userId: number,
  playlistId: number,
  showDeleted: boolean,
  sortingState: import("@tanstack/react-table").SortingState | null,
) {
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
  acceptableDelinquencyWindow: number,
) {
  return getScheduledTunesOverview(
    userId,
    playlistId,
    sitdownDate ?? new Date(0),
    showDeleted,
    acceptableDelinquencyWindow,
  );
}

export async function getTuneStagedAction(
  userId: string | number,
  playlistId: string | number,
  tuneId: string | number,
) {
  return getTuneStaged(String(userId), String(playlistId), String(tuneId));
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
