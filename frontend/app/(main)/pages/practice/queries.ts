"use server";

import axios from "axios";
import type { PlaylistTune, Tune } from "./types";
import { ERROR_TUNE } from "./mocks";

const client = axios.create({
  // baseURL: process.env.TT_API_BASE_URL
  baseURL: process.env.NEXT_PUBLIC_TT_BASE_URL,
});

export async function getPracticeListScheduled(
  user_id: string,
  playlist_id: string,
): Promise<Tune[]> {
  try {
    // console.log("Environment Variables:", process.env);
    console.log("In getPracticeListScheduled: baseURL: %s", client.getUri());
    console.log("user_id: %s, playlist_id: %s", user_id, playlist_id);
    const response = await client.get<Tune[]>(
      `/get_practice_list_scheduled/${user_id}/${playlist_id}`,
    );
    const data = response.data;
    return data;
  } catch (error) {
    console.error("Error in getPracticeListScheduled: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    return ERROR_TUNE;
  }
}

export async function getRecentlyPracticed(
  user_id: string,
  playlist_id: string,
): Promise<Tune[]> {
  try {
    const response = await client.get<Tune[]>(
      `/get_tunes_recently_played/${user_id}/${playlist_id}`,
    );
    const data = response.data;
    return data;
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
    const data = response.data;
    return data;
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
  user_id: string,
  playlist_ref: string,
  tune_id: string,
  tune_update: Partial<PlaylistTune>,
): Promise<{ success?: string; detail?: string }> {
  try {
    const response = await client.put<{ success?: string; detail?: string }>(
      `/playlist-tune/${user_id}/${playlist_ref}/${tune_id}`,
      tune_update,
    );
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
  user_id: string,
  playlist_ref: string,
  tune_id: string,
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
