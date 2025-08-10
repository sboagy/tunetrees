"use server";

// Server-side queries module for Scheduling Options, mirroring practice/queries.ts style.
// Provides unified technique: server-only module that the page can import.

import axios from "axios";

export interface IPrefsSchedulingOptionsBase {
  user_id: number;
  acceptable_delinquency_window?: number;
  min_reviews_per_day?: number;
  max_reviews_per_day?: number;
  days_per_week?: number;
  weekly_rules?: string | null;
  exceptions?: string | null;
}

export type IPrefsSchedulingOptionsResponse = IPrefsSchedulingOptionsBase;
export type IPrefsSchedulingOptionsCreate = IPrefsSchedulingOptionsBase;
export type IPrefsSchedulingOptionsUpdate =
  Partial<IPrefsSchedulingOptionsBase>;

const TT_API_BASE_URL = process.env.TT_API_BASE_URL;
if (!TT_API_BASE_URL) {
  console.error(
    "TT_API_BASE_URL env var not set in scheduling-options/queries.ts",
  );
  throw new Error("TT_API_BASE_URL environment variable is not set");
}

// NOTE: Preferences endpoints live at /preferences (root), NOT under /tunetrees.
// Other feature query modules may use `${TT_API_BASE_URL}/tunetrees` but
// here we must point directly at the API root to avoid 404s like
// /tunetrees/preferences/prefs_scheduling_options.
const client = axios.create({
  baseURL: `${TT_API_BASE_URL}`,
});

export async function getSchedulingOptions(
  userId: number,
): Promise<IPrefsSchedulingOptionsResponse | null> {
  try {
    const resp = await client.get<IPrefsSchedulingOptionsResponse>(
      "/preferences/prefs_scheduling_options",
      { params: { user_id: userId } },
    );
    return resp.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    console.error("Error in getSchedulingOptions", error);
    throw error;
  }
}

// Explicit create not required; GET auto-creates and PUT upserts.

export async function updateSchedulingOptions(
  userId: number,
  prefs: IPrefsSchedulingOptionsUpdate,
): Promise<IPrefsSchedulingOptionsResponse> {
  try {
    const resp = await client.put<IPrefsSchedulingOptionsResponse>(
      "/preferences/prefs_scheduling_options",
      prefs,
      { params: { user_id: userId } },
    );
    return resp.data;
  } catch (error) {
    console.error("Error in updateSchedulingOptions", error);
    throw error;
  }
}
