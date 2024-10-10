"use server";

import axios from "axios";
import type { Tune } from "./types";
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

export async function getTuneStaged(
  user_id: string,
  playlist_id: string,
  tune_id: string,
): Promise<Tune[]> {
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
