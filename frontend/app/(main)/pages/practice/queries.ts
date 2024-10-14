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
    console.log("Environment Variables:", process.env);
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
 * Fetches a specific tune from a user's playlist.
 *
 * @param user_id - The ID of the user.
 * @param playlist_id - The ID of the playlist.
 * @param tune_id - The ID of the tune.
 * @returns A promise that resolves to the requested Tune object, or null if an error occurs.
 *
 * @throws Will log an error message if the request fails.
 */
export async function getPlaylistTune(
  user_id: string,
  playlist_id: string,
  tune_id: string,
): Promise<PlaylistTune | null> {
  try {
    const response = await client.get<PlaylistTune>(
      `/playlist-tune/${user_id}/${playlist_id}/${tune_id}`,
    );
    const data = response.data;
    return data;
  } catch (error) {
    console.error("Error in getPlaylistTune: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    return null;
  }
}
