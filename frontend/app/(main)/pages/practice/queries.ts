"use server";

import { parseParamsWithArrays } from "@/lib/utils";
import type { SortingState } from "@tanstack/react-table";
import axios from "axios";
import { ERROR_TUNE } from "./mocks";
import type {
  IGenre,
  IInstrument,
  INote,
  IPlaylist,
  IPlaylistTune,
  IReferenceData,
  ITTResponseInfo,
  ITune,
  ITuneOverview,
  IViewPlaylistJoined,
} from "./types";

const client = axios.create({
  // baseURL: process.env.TT_API_BASE_URL
  baseURL: process.env.NEXT_PUBLIC_TT_BASE_URL,
});

export async function getScheduledTunesOverview(
  userId: number,
  playlistId: number,
  showDeleted = false,
): Promise<ITuneOverview[]> {
  try {
    // console.log("Environment Variables:", process.env);
    console.log(
      "============> queries.ts:30 ~ In getScheduledTunesOverview: baseURL: %s",
      client.getUri(),
    );
    console.log("user_id: %s, playlist_id: %s", userId, playlistId);
    const response = await client.get<ITuneOverview[]>(
      `/scheduled_tunes_overview/${userId}/${playlistId}`,
      {
        params: { show_playlist_deleted: showDeleted },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error in getPracticeListScheduled: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    return ERROR_TUNE;
  }
}

export async function getRepertoireTunesOverview(
  userId: number,
  playlistId: number,
  showDeleted = false,
  sortingState: SortingState | null = null,
  skip = 0,
  limit = 10000,
): Promise<ITuneOverview[]> {
  try {
    const sortingStateSerialized = sortingState
      ? encodeURIComponent(JSON.stringify(sortingState))
      : null;
    const response = await client.get<ITuneOverview[]>(
      `/repertoire_tunes_overview/${userId}/${playlistId}`,
      {
        params: {
          show_playlist_deleted: showDeleted,
          sorting: sortingStateSerialized,
          skip,
          limit,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error in getRecentlyPracticed: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    return ERROR_TUNE;
  }
}

/**
 * @deprecated This function is deprecated and will be removed in future releases.
 * Please use getPlaylistTune instead.
 */
export async function getTuneStaged(
  user_id: string,
  playlist_id: string,
  tune_id: string,
): Promise<ITuneOverview[]> {
  console.warn(
    "getTuneStaged is deprecated. Please use getPlaylistTune instead.",
  );
  try {
    const response = await client.get<ITuneOverview[]>(
      `/get_tune_staged/${user_id}/${playlist_id}/${tune_id}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error in getTuneStaged: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    return ERROR_TUNE;
  }
}

export async function getTunesOnly(showDeleted = false): Promise<ITune[]> {
  try {
    const response = await client.get<ITune[]>("/tunes", {
      params: { show_deleted: showDeleted },
    });
    return response.data;
  } catch (error) {
    console.error("Error in getTunesOnly: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    throw error;
  }
}

export async function getTunesOnlyIntoOverview(
  showDeleted = false,
): Promise<ITuneOverview[]> {
  try {
    const response = await client.get<ITune[]>("/tunes", {
      params: { show_deleted: showDeleted },
    });

    return response.data.map((tune) => ({
      ...tune,
      user_ref: null,
      playlist_ref: null,
      learned: null,
      practiced: null,
      quality: null,
      easiness: null,
      interval: null,
      repetitions: null,
      review_date: null,
      backup_practiced: null,
      external_ref: null,
      tags: null,
      recall_eval: null,
      notes: null,
      favorite_url: null,
      playlist_deleted: null,
    }));
  } catch (error) {
    console.error("Error in getTunesOnly: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    throw error;
  }
}

/**
 * Update a specific tune in a user's playlist.
 *
 * Note: Good chance this function will be removed in future releases.
 *
 * @param user_id - The ID of the user.
 * @param playlist_ref - The ID of the playlist.
 * @param tune_id - The ID of the tune.
 * @param tune_update - The fields to update (all optional).
 * @returns A promise that resolves to a success or error message.
 */
export async function updateTuneInPlaylistFromTuneOverview(
  user_id: number,
  playlist_ref: number,
  tune_id: number,
  tune_update: Partial<ITuneOverview>,
): Promise<Partial<ITuneOverview> | { detail?: string }> {
  try {
    const dbTune = await getPlaylistTuneOverview(
      user_id,
      playlist_ref,
      tune_id,
    );
    if ("detail" in dbTune) {
      console.error("Error in updatePlaylistTune: ", dbTune.detail);
      return { detail: "Unable to update tune: Tune not found" };
    }
    const tuneUpdateData: Partial<ITune> = {};

    if (dbTune) {
      if (tune_update.title !== dbTune.title)
        tuneUpdateData.title = tune_update.title;
      if (tune_update.type !== dbTune.type)
        tuneUpdateData.type = tune_update.type;
      if (tune_update.structure !== dbTune.structure)
        tuneUpdateData.structure = tune_update.structure;
      if (tune_update.mode !== dbTune.mode)
        tuneUpdateData.mode = tune_update.mode;
      if (tune_update.incipit !== dbTune.incipit)
        tuneUpdateData.incipit = tune_update.incipit;
      if (tune_update.genre !== dbTune.genre)
        tuneUpdateData.genre = tune_update.genre;
    }
    const response = await client.patch<{
      success?: string;
      detail?: string;
    }>("/tune", tuneUpdateData, { params: { tune_ref: tune_id } });

    return response.data;
  } catch (error) {
    console.error("Error in updatePlaylistTune: ", error);
    return { detail: `Unable to update tune: ${(error as Error).message}` };
  }
}

/**
 * Retrieve a specific tune from a user's playlist.
 *
 * @param user_id - The ID of the user.
 * @param playlist_ref - The ID of the playlist.
 * @param tune_id - The ID of the tune.
 * @returns A promise that resolves to the requested PlaylistTune object, or an error message.
 */
export async function getPlaylistTuneOverview(
  user_id: number,
  playlist_ref: number,
  tune_id: number,
): Promise<ITuneOverview | { detail: string }> {
  try {
    const response = await client.get<ITuneOverview | { detail: string }>(
      `/playlist-tune-overview/${user_id}/${playlist_ref}/${tune_id}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error in getPlaylistTune: ", error);
    return { detail: `Unable to fetch tune: ${(error as Error).message}` };
  }
}

/**
 * Fetch references for a specific tune.
 *
 * @param tuneRef - The reference ID of the tune.
 * @param userRef - The user reference ID.
 * @returns A promise that resolves to a list of references.
 */
export async function getReferences(
  tuneRef: number,
  userRef: number | null,
): Promise<IReferenceData[]> {
  try {
    console.log(
      "===> queries.ts:242 ~ In getReferences (server): tuneRef: %s, userRef: %s",
      tuneRef,
      userRef,
    );
    console.log(
      `Request URL: /references?user_ref=${userRef}&tune_ref=${tuneRef}&public=0`,
    );
    const response = await client.get<IReferenceData[]>(
      `/references/${userRef ?? ""}/${tuneRef}`,
      {
        params: {
          public: 0,
        },
      },
    );
    console.log("getReferences response: ", response.data);
    return response.data;
  } catch (error) {
    console.error("Error in getReferences: ", error);
    return [];
  }
}

export async function getReferenceFavorite(
  tuneRef: number,
  userRef: number | null,
): Promise<IReferenceData | null> {
  try {
    console.log(
      "===> queries.ts:271 ~ In getReferenceFavorite (server): tuneRef: %s, userRef: %s",
      tuneRef,
      userRef,
    );
    console.log(
      `Request URL: /references?user_ref=${userRef}&tune_ref=${tuneRef}&public=0`,
    );
    const response = await client.get<IReferenceData[]>(
      `/references?tune_ref=${tuneRef}&user_ref=${userRef}&public=0`,
    );
    const references = response.data;
    const favoriteReference = references.find((ref) => ref.favorite === 1);
    if (favoriteReference) {
      return favoriteReference;
    }
    return references.length > 0 ? references[0] : null;
  } catch (error) {
    console.error("Error in getReferences: ", error);
    return null;
  }
}

/**
 * Update a specific reference.
 *
 * @param referenceId - The ID of the reference.
 * @param referenceUpdate - The fields to update (all optional).
 * @returns A promise that resolves to a success or error message.
 */
export async function updateReference(
  referenceId: number,
  referenceUpdate: Partial<IReferenceData>,
): Promise<IReferenceData | ITTResponseInfo> {
  try {
    const response = await client.patch<IReferenceData | ITTResponseInfo>(
      `/references/${referenceId}`,
      referenceUpdate,
    );
    return response.data;
  } catch (error) {
    console.error("Error in updateReference: ", error);
    return {
      detail: `Unable to update reference: ${(error as Error).message}`,
    };
  }
}

/**
 * Create a new reference.
 *
 * @param reference - The reference data to create.
 * @returns A promise that resolves to an IReferenceData object.
 */
export async function createReference(
  reference: IReferenceData,
): Promise<IReferenceData> {
  try {
    const { isNew, ...referenceWithoutIsNew } = reference;
    console.log("createReference: isNew=", isNew);
    const response = await client.post<IReferenceData>(
      "/references",
      referenceWithoutIsNew,
    );
    return response.data;
  } catch (error) {
    console.error("Error in createReference: ", error);
    throw error;
  }
}

/**
 * Delete a specific reference.
 *
 * @param referenceId - The ID of the reference.
 * @returns A promise that resolves to a success or error message.
 */
export async function deleteReference(
  referenceId: number,
): Promise<ITTResponseInfo> {
  try {
    const response = await client.delete<ITTResponseInfo>(
      `/references/${referenceId}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error in deleteReference: ", error);
    return {
      detail: `Unable to delete reference: ${(error as Error).message}`,
    };
  }
}

/**
 * Retrieve notes for a specific tune.
 *
 * @returns A promise that resolves to a list of notes.
 */
export async function getNotes(
  tuneRef: number,
  playlistRef: number,
  userRef: number,
  displayPublic?: boolean,
): Promise<INote[]> {
  try {
    const response = await client.get<INote[]>(`/notes/${userRef}/${tuneRef}`, {
      params: {
        playlist_ref: playlistRef,
        public: displayPublic ? 1 : 0,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error in getNotes: ", error);
    return [];
  }
}

/**
 * Update a specific note.
 *
 * @param note_id - The ID of the note.
 * @param note_update - The fields to update (all optional).
 * @returns A promise that resolves to a success or error message.
 */
export async function updateNote(
  note_id: number,
  note_update: Partial<INote>,
): Promise<ITTResponseInfo> {
  try {
    const response = await client.patch<ITTResponseInfo>(
      `/notes/${note_id}`,
      note_update,
    );
    return response.data;
  } catch (error) {
    console.error("Error in updateNote: ", error);
    return { detail: `Unable to update note: ${(error as Error).message}` };
  }
}

/**
 * Create a new note for a specific tune.
 *
 * @returns A promise that resolves to a IReferenceData object.
 */
export async function createNote(note: INote): Promise<INote> {
  try {
    const response = await client.post<INote>("/notes", note);
    return response.data;
  } catch (error) {
    console.error("Error in createNote: ", error);
    throw error;
  }
}

/**
 * Delete a specific note.
 *
 * @param note_id - The ID of the note.
 * @returns A promise that resolves to a success or error message.
 */
export async function deleteNote(note_id: number): Promise<ITTResponseInfo> {
  try {
    const response = await client.delete<ITTResponseInfo>(`/notes/${note_id}`);
    return response.data;
  } catch (error) {
    console.error("Error in deleteNote: ", error);
    return { detail: `Unable to delete note: ${(error as Error).message}` };
  }
}

/**
 * Retrieve a specific tune.
 *
 * @param tuneRef - The reference ID of the tune.
 * @returns A promise that resolves to the requested Tune object, or an error message.
 */
export async function getTune(
  tuneRef: number,
): Promise<ITuneOverview | { detail: string }> {
  try {
    const response = await client.get<ITuneOverview | { detail: string }>(
      `/tune/${tuneRef}`,
    );
    return response.data;
  } catch (error) {
    console.error(`Error in getTune(${tuneRef})`, error);
    return { detail: `Unable to fetch tune: ${(error as Error).message}` };
  }
}

/**
 * Update a specific tune.
 *
 * @param tuneRef - The reference ID of the tune.
 * @param tuneUpdate - The fields to update (all optional).
 * @returns A promise that resolves to a success or error message.
 */
export async function updateTune(
  tuneRef: number,
  tuneUpdate: Partial<ITuneOverview>,
): Promise<ITTResponseInfo> {
  try {
    const response = await client.patch<ITTResponseInfo>(
      `/tune/${tuneRef}`,
      tuneUpdate,
    );
    return response.data;
  } catch (error) {
    console.error("Error in updateTune: ", error);
    return { detail: `Unable to update tune: ${(error as Error).message}` };
  }
}

export async function updateTunes(
  tuneRefs: number[],
  tuneUpdate: Partial<ITune>,
): Promise<ITTResponseInfo> {
  try {
    const response = await client.patch<ITTResponseInfo>("/tunes", tuneUpdate, {
      params: { tune_refs: tuneRefs },
      paramsSerializer: parseParamsWithArrays,
    });
    return response.data;
  } catch (error) {
    console.error("Error in updateTune: ", error);
    return { detail: `Unable to update tune: ${(error as Error).message}` };
  }
}

/**
 * Delete a specific tune.
 *
 * @param tuneRef - The reference ID of the tune.
 * @returns A promise that resolves to a success or error message.
 */
export async function deleteTune(tuneRef: number): Promise<ITTResponseInfo> {
  try {
    const response = await client.delete<ITTResponseInfo>(`/tune/${tuneRef}`);
    return response.data;
  } catch (error) {
    console.error("Error in deleteTune: ", error);
    return { detail: `Unable to delete tune: ${(error as Error).message}` };
  }
}

/**
 * Retrieve a specific playlist tune.
 *
 * @param tuneRef - The reference ID of the tune.
 * @returns A promise that resolves to the requested Tune object, or an error message.
 */
export async function getPlaylistTune(
  tuneRef: number,
  playlistRef: number,
): Promise<IPlaylistTune | { detail: string }> {
  try {
    const response = await client.get<IPlaylistTune | { detail: string }>(
      "/playlist_tune",
      {
        params: {
          tune_ref: tuneRef,
          playlist_ref: playlistRef,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error(`Error in getPlaylistTune(${tuneRef})`, error);
    return {
      detail: `Unable to fetch playlist tune: ${(error as Error).message}`,
    };
  }
}

/**
 * Create a playlist tune entry.
 *
 * @param playlist - The playlist data to create.
 * @returns A promise that resolves to the created PlaylistTune object, or an error message.
 */
export async function createPlaylistTune(
  playlist: Partial<IPlaylistTune>,
): Promise<IPlaylistTune | { detail: string }> {
  try {
    const response = await client.post<IPlaylistTune | { detail: string }>(
      "/playlist_tune",
      playlist,
    );
    return response.data;
  } catch (error) {
    console.error("Error in createPlaylist: ", error);
    return { detail: `Unable to create playlist: ${(error as Error).message}` };
  }
}

/**
 * Retrieve a specific playlist tune.
 *
 * @param tuneRef - The reference ID of the tune.
 * @returns A promise that resolves to the requested Tune object, or an error message.
 */
export async function intersectPlaylistTunes(
  tuneRefs: number[],
  playlistRef: number,
): Promise<number[]> {
  try {
    const response = await client.get<number[]>("/intersect_playlist_tunes", {
      params: {
        tune_refs: tuneRefs,
        playlist_ref: playlistRef,
      },
      paramsSerializer: parseParamsWithArrays,
    });
    return response.data;
  } catch (error) {
    console.error(`Error in getPlaylistTunes(${tuneRefs.join(", ")})`, error);
    return [];
  }
}

export async function updatePlaylistTunes(
  tuneRefs: number[],
  playlistRef: number,
  tuneUpdate: Partial<IPlaylistTune>,
): Promise<ITTResponseInfo> {
  try {
    const response = await client.patch<ITTResponseInfo>(
      "/playlist_tunes",
      tuneUpdate,
      {
        params: { tune_refs: tuneRefs, playlist_ref: playlistRef },
        paramsSerializer: parseParamsWithArrays,
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error in updateTune: ", error);
    return { detail: `Unable to update tune: ${(error as Error).message}` };
  }
}

/**
 * Creates a new empty tune.  If a playlist is specified, will alsi associate it with the specified playlist.
 *
 * @param {ITuneOverview} tune - The tune object to be created.
 * @param {number} playlistRef - If specified, the reference ID of the playlist to associate the tune with.
 * @return {Promise<ITuneOverview | ITTResponseInfo>} A promise that resolves to the created tune or an object with success or detail messages.
 */
export async function createEmptyTune(
  tune: ITuneOverview,
  playlistRef?: number,
): Promise<ITuneOverview | ITTResponseInfo> {
  try {
    const tuneCreateInput: ITune = {
      title: tune.title,
      type: tune.type ?? "",
      structure: tune.structure ?? "",
      mode: tune.mode ?? "",
      incipit: tune.incipit ?? "",
      genre: tune.genre ?? "",
    };

    type CreateTuneResponse = ITuneOverview | ITTResponseInfo;

    const response = await client.post<CreateTuneResponse>(
      "/tune",
      tuneCreateInput,
      {
        params: { playlist_ref: playlistRef },
      },
    );
    console.log("createTune response: ", response.data);
    return response.data;
  } catch (error) {
    console.error("Error in createTune: ", error);
    return { detail: `Unable to create tune: ${(error as Error).message}` };
  }
}

/**
 * Retrieve playlists by user reference.
 *
 * @param userRef - The user reference ID.
 * @returns A promise that resolves to the requested Playlist objects, or an error message.
 */
export async function getPlaylists(
  userRef = -1,
): Promise<IPlaylist[] | { detail: string }> {
  try {
    const response = await client.get<IPlaylist[] | { detail: string }>(
      "/playlist",
      {
        params: { user_ref: userRef },
      },
    );
    return response.data;
  } catch (error) {
    console.error(`Error in getPlaylists(${userRef})`, error);
    return { detail: `Unable to fetch playlists: ${(error as Error).message}` };
  }
}

/**
 * Create a new playlist.
 *
 * @param playlist - The playlist data to create.
 * @returns A promise that resolves to the created Playlist object, or an error message.
 */
export async function createPlaylist(
  playlist: Partial<IPlaylist>,
): Promise<IPlaylist | { detail: string }> {
  try {
    const response = await client.post<IPlaylist | { detail: string }>(
      "/playlist",
      playlist,
    );
    return response.data;
  } catch (error) {
    console.error("Error in createPlaylist: ", error);
    return { detail: `Unable to create playlist: ${(error as Error).message}` };
  }
}

/**
 * Update a specific playlist.
 *
 * @param playlistId - The ID of the playlist.
 * @param playlistUpdate - The fields to update (all optional).
 * @returns A promise that resolves to the updated Playlist object, or an error message.
 */
export async function updatePlaylist(
  playlistId: number,
  playlistUpdate: Partial<IPlaylist>,
): Promise<IPlaylist | { detail: string }> {
  try {
    const response = await client.patch<IPlaylist | { detail: string }>(
      `/playlist/${playlistId}`,
      playlistUpdate,
    );
    return response.data;
  } catch (error) {
    console.error("Error in updatePlaylist: ", error);
    return { detail: `Unable to update playlist: ${(error as Error).message}` };
  }
}

/**
 * Delete a specific playlist.
 *
 * @param playlistId - The ID of the playlist.
 * @returns A promise that resolves to a success or error message.
 */
export async function deletePlaylist(
  playlistId: number,
  hardDelete = false,
): Promise<IPlaylist | { detail: string }> {
  try {
    if (hardDelete) {
      const responseDelete = await client.delete<
        IPlaylist | { detail: string }
      >(`/playlist/${playlistId}`);
      return responseDelete.data;
    }
    const playlistUpdate = { deleted: true };
    const response = await client.patch<IPlaylist | { detail: string }>(
      `/playlist/${playlistId}`,
      playlistUpdate,
    );
    return response.data;
  } catch (error) {
    console.error("Error in deletePlaylist: ", error);
    return { detail: `Unable to delete playlist: ${(error as Error).message}` };
  }
}

/**
 * Retrieve instruments by user reference.
 *
 * @param userRef - The user reference ID.
 * @returns A promise that resolves to the requested Instrument objects, or an error message.
 */
export async function getInstruments(
  userRef = -1,
): Promise<IInstrument[] | { detail: string }> {
  try {
    const response = await client.get<IInstrument[] | { detail: string }>(
      "/instruments",
      {
        params: { user_ref: userRef },
      },
    );
    return response.data;
  } catch (error) {
    console.error(`Error in getInstruments(${userRef})`, error);
    return {
      detail: `Unable to fetch instruments: ${(error as Error).message}`,
    };
  }
}

/**
 * Retrieve a specific instrument by its ID.
 *
 * @param instrumentId - The ID of the instrument.
 * @returns A promise that resolves to the requested Instrument object, or an error message.
 */
export async function getInstrumentById(
  instrumentId: number,
): Promise<IInstrument | { detail: string }> {
  try {
    const response = await client.get<IInstrument | { detail: string }>(
      `/instruments/${instrumentId}`,
    );
    return response.data;
  } catch (error) {
    console.error(`Error in getInstrumentById(${instrumentId})`, error);
    return {
      detail: `Unable to fetch instrument: ${(error as Error).message}`,
    };
  }
}

/**
 * Create a new instrument.
 *
 * @param instrument - The instrument data to create.
 * @returns A promise that resolves to the created Instrument object, or an error message.
 */
export async function createInstrument(
  instrument: Partial<IInstrument>,
): Promise<IInstrument | { detail: string }> {
  try {
    const response = await client.post<IInstrument | { detail: string }>(
      "/instruments",
      instrument,
    );
    return response.data;
  } catch (error) {
    console.error("Error in createInstrument: ", error);
    return {
      detail: `Unable to create instrument: ${(error as Error).message}`,
    };
  }
}

/**
 * Update a specific instrument.
 *
 * @param instrumentId - The ID of the instrument.
 * @param instrumentUpdate - The fields to update (all optional).
 * @returns A promise that resolves to the updated Instrument object, or an error message.
 */
export async function updateInstrument(
  instrumentId: number,
  instrumentUpdate: Partial<IInstrument>,
): Promise<IInstrument | { detail: string }> {
  try {
    const response = await client.patch<IInstrument | { detail: string }>(
      `/instruments/${instrumentId}`,
      instrumentUpdate,
    );
    return response.data;
  } catch (error) {
    console.error("Error in updateInstrument: ", error);
    return {
      detail: `Unable to update instrument: ${(error as Error).message}`,
    };
  }
}

/**
 * Delete a specific instrument.
 *
 * @param instrumentId - The ID of the instrument.
 * @returns A promise that resolves to a success or error message.
 */
export async function deleteInstrument(
  instrumentId: number,
): Promise<{ detail?: string }> {
  try {
    const response = await client.delete<{ detail?: string }>(
      `/instruments/${instrumentId}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error in deleteInstrument: ", error);
    return {
      detail: `Unable to delete instrument: ${(error as Error).message}`,
    };
  }
}

/**
 * Retrieve a specific playlist by its ID.
 *
 * @param playlistId - The ID of the playlist.
 * @returns A promise that resolves to the requested Playlist object, or an error message.
 */
export async function getPlaylistById(
  playlistId: number,
): Promise<IPlaylist | { detail: string }> {
  try {
    const response = await client.get<IPlaylist | { detail: string }>(
      `/playlist/${playlistId}`,
    );
    return response.data;
  } catch (error) {
    console.error(`Error in getPlaylistById(${playlistId})`, error);
    return { detail: `Unable to fetch playlist: ${(error as Error).message}` };
  }
}

export async function getAllGenres(): Promise<IGenre[]> {
  try {
    const response = await client.get<IGenre[]>("/genres");
    return response.data;
  } catch (error) {
    console.error("Error in getAllGenres:", error);
    return [];
  }
}

export async function getGenreById(
  genreId: number,
): Promise<IGenre | { detail: string }> {
  try {
    const response = await client.get<IGenre>(`/genres/${genreId}`);
    return response.data;
  } catch (error) {
    console.error("Error in getGenreById:", error);
    return { detail: `Unable to fetch genre: ${(error as Error).message}` };
  }
}

export async function createGenre(
  genreData: Omit<IGenre, "id">,
): Promise<IGenre | { detail: string }> {
  try {
    const response = await client.post<IGenre>("/genres", genreData);
    return response.data;
  } catch (error) {
    console.error("Error in createGenre:", error);
    return { detail: `Unable to create genre: ${(error as Error).message}` };
  }
}

export async function updateGenre(
  genreId: number,
  genreData: Partial<Omit<IGenre, "id">>,
): Promise<IGenre | { detail: string }> {
  try {
    const response = await client.put<IGenre>(`/genres/${genreId}`, genreData);
    return response.data;
  } catch (error) {
    console.error("Error in updateGenre:", error);
    return { detail: `Unable to update genre: ${(error as Error).message}` };
  }
}

export async function deleteGenre(
  genreId: number,
): Promise<{ detail?: string }> {
  try {
    await client.delete(`/genres/${genreId}`);
    return {};
  } catch (error) {
    console.error("Error in deleteGenre:", error);
    return { detail: `Unable to delete genre: ${(error as Error).message}` };
  }
}

export async function fetchViewPlaylistJoined(
  userId: number,
  instrumentId?: number,
  showDeleted = false,
  showPlaylistDeleted = false,
  allPublic = false,
): Promise<IViewPlaylistJoined[]> {
  try {
    const params: {
      show_deleted: boolean;
      show_playlist_deleted: boolean;
      all_public?: boolean;
      instrument_ref?: number;
    } = {
      show_deleted: showDeleted,
      show_playlist_deleted: showPlaylistDeleted,
    };
    if (instrumentId) {
      params.instrument_ref = instrumentId;
    }
    if (allPublic) {
      params.all_public = allPublic;
    }
    const response = await client.get<IViewPlaylistJoined[]>(
      `/view_playlist_joined/${userId}`,
      {
        params: params,
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching view playlist joined: ", error);
    throw new Error(
      `Error fetching view playlist joined: ${(error as Error).message}`,
    );
  }
}

export async function createPlaylistJoined(
  playlist: Partial<IViewPlaylistJoined>,
  userId?: number,
): Promise<IViewPlaylistJoined | { detail: string }> {
  try {
    const instrument: Partial<IInstrument> = {};
    if (playlist.instrument) {
      instrument.instrument = playlist.instrument;
    }
    if (playlist.description) {
      instrument.description = playlist.description;
    }
    if (playlist.user_ref) {
      instrument.private_to_user = playlist.user_ref;
    }
    if (playlist.genre_default) {
      instrument.genre_default = playlist.genre_default;
    }
    if (playlist.instrument_deleted) {
      instrument.deleted = playlist.instrument_deleted;
    }
    const createdInstrument: IInstrument | { detail: string } =
      await createInstrument(instrument);
    if ("detail" in createdInstrument) {
      return { detail: createdInstrument.detail };
    }
    const newPlaylist: Partial<IPlaylist> = {
      user_ref: userId ?? playlist.user_ref,
      instrument_ref: createdInstrument.id,
      deleted: playlist.playlist_deleted,
    };
    const createdPlaylist = await createPlaylist(newPlaylist);
    if ("detail" in createdPlaylist) {
      return { detail: createdPlaylist.detail };
    }
    const createdPlaylistJoined: IViewPlaylistJoined[] =
      await fetchViewPlaylistJoined(
        userId ?? playlist.user_ref ?? 0,
        createdInstrument.id,
      );
    if (createdPlaylistJoined.length === 0) {
      return { detail: "Unable to create playlist" };
    }
    return createdPlaylistJoined[0];
  } catch (error) {
    console.error("Error in createPlaylist: ", error);
    return { detail: `Unable to create playlist: ${(error as Error).message}` };
  }
}
