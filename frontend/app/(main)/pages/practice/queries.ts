"use server";

import axios from "axios";
import { ERROR_TUNE } from "./mocks";
import type { INote, IReferenceData, ITune, PlaylistTune, Tune } from "./types";

const client = axios.create({
  // baseURL: process.env.TT_API_BASE_URL
  baseURL: process.env.NEXT_PUBLIC_TT_BASE_URL,
});

export async function getPracticeListScheduled(
  userId: number,
  playlistId: number,
): Promise<Tune[]> {
  try {
    // console.log("Environment Variables:", process.env);
    console.log("In getPracticeListScheduled: baseURL: %s", client.getUri());
    console.log("user_id: %s, playlist_id: %s", userId, playlistId);
    const response = await client.get<Tune[]>(
      `/get_practice_list_scheduled/${userId}/${playlistId}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error in getPracticeListScheduled: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    return ERROR_TUNE;
  }
}

export async function getRecentlyPracticed(
  userId: number,
  playlistId: number,
): Promise<Tune[]> {
  try {
    const response = await client.get<Tune[]>(
      `/get_tunes_recently_played/${userId}/${playlistId}`,
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
): Promise<Tune[]> {
  console.warn(
    "getTuneStaged is deprecated. Please use getPlaylistTune instead.",
  );
  try {
    const response = await client.get<Tune[]>(
      `/get_tune_staged/${user_id}/${playlist_id}/${tune_id}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error in getTuneStaged: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    return ERROR_TUNE;
  }
}

/**
 * Update a specific tune in a user's playlist.
 *
 * @param user_id - The ID of the user.
 * @param playlist_ref - The ID of the playlist.
 * @param tune_id - The ID of the tune.
 * @param tune_update - The fields to update (all optional).
 * @returns A promise that resolves to a success or error message.
 */
export async function updatePlaylistTune(
  user_id: number,
  playlist_ref: number,
  tune_id: number,
  tune_update: Partial<PlaylistTune>,
): Promise<Partial<PlaylistTune> | { detail?: string }> {
  try {
    const dbTune = await getPlaylistTune(user_id, playlist_ref, tune_id);
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
    }
    const response = await client.put<{
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
 * Delete a specific tune from a user's playlist.
 *
 * @param user_id - The ID of the user.
 * @param playlist_ref - The ID of the playlist.
 * @param tune_id - The ID of the tune.
 * @returns A promise that resolves to a success or error message.
 */
export async function deletePlaylistTune(
  user_id: string,
  playlist_ref: string,
  tune_id: string,
): Promise<{ success?: string; detail?: string }> {
  try {
    const response = await client.delete<{ success?: string; detail?: string }>(
      `/playlist-tune/${user_id}/${playlist_ref}/${tune_id}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error in deletePlaylistTune: ", error);
    return { detail: `Unable to delete tune: ${(error as Error).message}` };
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
export async function getPlaylistTune(
  user_id: number,
  playlist_ref: number,
  tune_id: number,
): Promise<PlaylistTune | { detail: string }> {
  try {
    const response = await client.get<PlaylistTune | { detail: string }>(
      `/playlist-tune/${user_id}/${playlist_ref}/${tune_id}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error in getPlaylistTune: ", error);
    return { detail: `Unable to fetch tune: ${(error as Error).message}` };
  }
}

/**
 * Create a new tune in a user's playlist.
 *
 * @param user_id - The ID of the user.
 * @param playlist_ref - The ID of the playlist.
 * @param tune - The tune data to create.
 * @returns A promise that resolves to a success or error message.
 */
export async function createPlaylistTune(
  user_id: string,
  playlist_ref: string,
  tune: PlaylistTune,
): Promise<{ success?: string; detail?: string }> {
  try {
    const response = await client.post<{ success?: string; detail?: string }>(
      `/playlist-tune/${user_id}/${playlist_ref}`,
      tune,
    );
    return response.data;
  } catch (error) {
    console.error("Error in createPlaylistTune: ", error);
    return { detail: `Unable to create tune: ${(error as Error).message}` };
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
      "In getReferences (server): tuneRef: %s, userRef: %s",
      tuneRef,
      userRef,
    );
    console.log(
      `Request URL: /references?user_ref=${userRef}&tune_ref=${tuneRef}&public=0`,
    );
    const response = await client.get<IReferenceData[]>(
      `/references?tune_ref=${tuneRef}&user_ref=${userRef}&public=0`,
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
      "In getReferences (server): tuneRef: %s, userRef: %s",
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
): Promise<IReferenceData | { success?: string; detail?: string }> {
  try {
    const response = await client.put<
      IReferenceData | { success?: string; detail?: string }
    >("/references", referenceUpdate, { params: { id: referenceId } });
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
): Promise<{ success?: string; detail?: string }> {
  try {
    const response = await client.delete<{ success?: string; detail?: string }>(
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
  playlistRef?: number,
  userRef?: number,
  displayPublic?: boolean,
): Promise<INote[]> {
  try {
    const response = await client.get<INote[]>("/notes", {
      params: {
        tune_ref: tuneRef,
        playlist_ref: playlistRef,
        user_ref: userRef,
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
): Promise<{ success?: string; detail?: string }> {
  try {
    const response = await client.put<{ success?: string; detail?: string }>(
      "/notes",
      note_update,
      { params: { id: note_id } },
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
export async function deleteNote(
  note_id: number,
): Promise<{ success?: string; detail?: string }> {
  try {
    const response = await client.delete<{ success?: string; detail?: string }>(
      `/notes/${note_id}`,
    );
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
): Promise<Tune | { detail: string }> {
  try {
    const response = await client.get<Tune | { detail: string }>("/tune", {
      params: { tune_ref: tuneRef },
    });
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
  tuneUpdate: Partial<Tune>,
): Promise<{ success?: string; detail?: string }> {
  try {
    const response = await client.put<{ success?: string; detail?: string }>(
      "/tune",
      tuneUpdate,
      { params: { tune_ref: tuneRef } },
    );
    return response.data;
  } catch (error) {
    console.error("Error in updateTune: ", error);
    return { detail: `Unable to update tune: ${(error as Error).message}` };
  }
}

export interface ITuneCreate {
  title: string;
  type: string;
  structure: string;
  mode: string;
  incipit: string;
}

/**
 * Creates a new tune and associates it with the specified playlist.
 *
 * @param {Tune} tune - The tune object to be created.
 * @param {number} playlistRef - The reference ID of the playlist to associate the tune with.
 * @return {Promise<Tune | { success?: string; detail?: string }>} A promise that resolves to the created tune or an object with success or detail messages.
 */
export async function createTune(
  tune: Tune,
  playlistRef: number,
): Promise<Tune | { success?: string; detail?: string }> {
  try {
    const tuneCreateInput: ITuneCreate = {
      title: tune.title,
      type: tune.type ?? "",
      structure: tune.structure ?? "",
      mode: tune.mode ?? "",
      incipit: tune.incipit ?? "",
    };
    const response = await client.post<
      Tune | { success?: string; detail?: string }
    >(`/tune?playlist_ref=${playlistRef}`, tuneCreateInput);
    console.log("createTune response: ", response.data);
    return response.data;
  } catch (error) {
    console.error("Error in createTune: ", error);
    return { detail: `Unable to create tune: ${(error as Error).message}` };
  }
}

/**
 * Delete a specific tune.
 *
 * @param tuneRef - The reference ID of the tune.
 * @returns A promise that resolves to a success or error message.
 */
export async function deleteTune(
  tuneRef: number,
): Promise<{ success?: string; detail?: string }> {
  try {
    const response = await client.delete<{ success?: string; detail?: string }>(
      "/tune",
      { params: { tune_ref: tuneRef } },
    );
    return response.data;
  } catch (error) {
    console.error("Error in deleteTune: ", error);
    return { detail: `Unable to delete tune: ${(error as Error).message}` };
  }
}
