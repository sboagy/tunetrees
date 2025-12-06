// Removed types moved to types.ts

import { getUserFromDatabase } from "@/auth/auth-fetch";
import type {
  IPrefsSpacedRepetitionCreate,
  IPrefsSpacedRepetitionResponse,
  IPrefsSpacedRepetitionUpdate,
} from "./types";

/**
 * API accessor functions for spaced repetition preferences
 */

/**
 * Resolve the spaced repetition algorithm type for a user
 * @param userId - Optional user ID to resolve the algorithm type for
 * @param srAlgType - Optional algorithm type to use directly
 * @returns Promise containing the resolved algorithm type
 */
function resolveSrAlgType(
  userId?: number,
  srAlgType?: string,
): Promise<string> {
  if (srAlgType === undefined) {
    return getUserFromDatabase(`${userId}`).then((userRecord) => {
      return userRecord?.sr_alg_type || "FSRS";
    });
  }
  return Promise.resolve(srAlgType);
}

/**
 * Get all spaced repetition preferences
 * @param user_id - Optional user ID to filter preferences by user
 * @param srAlgType - Optional algorithm type to filter preferences
 * @returns Promise containing array of spaced repetition preferences
 */
export async function getPrefsSpacedRepetitionForUser(
  user_id?: number,
  srAlgType?: string,
): Promise<IPrefsSpacedRepetitionResponse[]> {
  const srAlgTypeLocal = await resolveSrAlgType(user_id, srAlgType);
  // Build URL with query parameter if user_id is provided
  let url = "/api/preferences/prefs_spaced_repetition";
  if (user_id !== undefined) {
    const params = new URLSearchParams();
    params.append("user_id", user_id.toString());
    params.append("sr_alg_type", srAlgTypeLocal.toString());
    url += `?${params.toString()}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Handle 404 error specifically
      return [];
    }
    throw new Error(`Failed to fetch preferences: ${response.statusText}`);
  }
  const data = await response.json();
  return data as Promise<IPrefsSpacedRepetitionResponse[]>;
}

/**
 * Create a new spaced repetition preference
 * @param prefs - The preferences object to create
 * @returns Promise containing the created preference
 */
export async function createPrefsSpacedRepetition(
  prefs: IPrefsSpacedRepetitionCreate,
): Promise<IPrefsSpacedRepetitionResponse> {
  const response = await fetch("/api/preferences/prefs_spaced_repetition", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prefs),
  });

  if (!response.ok) {
    throw new Error(`Failed to create preference: ${response.statusText}`);
  }

  return response.json() as Promise<IPrefsSpacedRepetitionResponse>;
}

/**
 * Update an existing spaced repetition preference
 * @param user_id - ID of the user whose preference is being updated
 * @param prefs - The updated preference data
 * @param srAlgType - Optional algorithm type to filter preferences
 * @returns Promise containing the updated preference
 */
export async function updatePrefsSpacedRepetition(
  user_id: number,
  prefs: IPrefsSpacedRepetitionUpdate,
  srAlgType?: string,
): Promise<IPrefsSpacedRepetitionResponse> {
  let url = "/api/preferences/prefs_spaced_repetition";
  const srAlgTypeLocal = await resolveSrAlgType(user_id, srAlgType);
  if (user_id !== undefined) {
    const params = new URLSearchParams();
    params.append("user_id", user_id.toString());
    params.append("sr_alg_type", srAlgTypeLocal.toString());
    url += `?${params.toString()}`;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prefs),
  });

  if (!response.ok) {
    throw new Error(`Failed to update preference: ${response.statusText}`);
  }

  return response.json() as Promise<IPrefsSpacedRepetitionResponse>;
}

/**
 * Delete a spaced repetition preference
 * @param user_id - ID of the user whose preference is being deleted
 * @param srAlgType - Optional algorithm type to filter preferences
 * @returns Promise that resolves when deletion is complete
 */
export async function deletePrefsSpacedRepetition(
  user_id: number,
  srAlgType?: string,
): Promise<void> {
  let url = "/api/preferences/prefs_spaced_repetition";
  const srAlgTypeLocal = await resolveSrAlgType(user_id, srAlgType);
  if (user_id !== undefined) {
    const params = new URLSearchParams();
    params.append("user_id", user_id.toString());
    params.append("sr_alg_type", srAlgTypeLocal.toString());
    url += `?${params.toString()}`;
  }
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete preference: ${response.statusText}`);
  }
}
