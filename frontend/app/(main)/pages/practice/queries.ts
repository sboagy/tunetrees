"use server";

import { normalizeKey } from "@/lib/abc-utils";
import { fetchWithTimeout } from "@/lib/fetch-utils";
import { parseParamsWithArrays } from "@/lib/utils";
import type { SortingState } from "@tanstack/react-table";
import { createServerAxios } from "@/lib/axios-server";
import { ERROR_TUNE } from "./mocks";
import type {
  IGenre,
  IGenreTuneType,
  IInstrument,
  INote,
  IPlaylist,
  IPlaylistTune,
  IPracticeRecord,
  IReferenceData,
  ITTResponseInfo,
  ITune,
  ITuneOverride,
  ITuneOverview,
  ITuneOverviewScheduled,
  ITuneType,
  IViewPlaylistJoined,
  IPracticeQueueEntry,
  IPracticeQueueWithMeta,
} from "./types";
import { formatDateToIso8601UtcString } from "@/lib/date-utils";

// function isValidUTF8(str: string): boolean {
//   try {
//     const encoder = new TextEncoder();
//     const decoder = new TextDecoder("utf8", { fatal: true });
//     const encoded = encoder.encode(str);
//     decoder.decode(encoded);
//     return true;
//   } catch {
//     return false;
//   }
// }

// Runtime tripwire: warn if this server module is ever executed in a client context.
// Heuristic: window is defined OR document is defined OR a known client-only global
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  console.warn(
    "[Tripwire] practice/queries.ts executed in a client environment. This should only be imported via server actions.",
  );
}

const TT_API_BASE_URL = process.env.TT_API_BASE_URL;

if (!TT_API_BASE_URL) {
  console.error(
    "TT_API_BASE_URL environment variable is not set in queries.ts!",
  );
  throw new Error("TT_API_BASE_URL environment variable is not set");
}

// Most queries APIs are under /tunetrees/ path
const client = createServerAxios(`${TT_API_BASE_URL}/tunetrees`);

// The sitdown date must always be passed from the client/browser.
// There is no default for SSR; if missing, throw an error.
// For tests, use NEXT_PUBLIC_TT_SITDOWN_DATE_DEFAULT as the default.

export async function getScheduledTunesOverview(
  userId: number,
  playlistId: number,
  sitdownDate: Date,
  showDeleted = false,
  enableBackfill = false,
): Promise<ITuneOverviewScheduled[]> {
  if (
    !sitdownDate ||
    !(sitdownDate instanceof Date) ||
    Number.isNaN(sitdownDate.getTime())
  ) {
    throw new Error(
      "sitdownDate (Date) must be provided by the client/browser. SSR is not supported for this function.",
    );
  }
  try {
    // console.log("Environment Variables:", process.env);
    console.log(
      "============> queries.ts:30 ~ In getScheduledTunesOverview: baseURL: %s",
      client.getUri(),
    );
    console.log("user_id: %s, playlist_id: %s", userId, playlistId);
    const sitdownDateUtcString = formatDateToIso8601UtcString(sitdownDate);
    // Convert JS getTimezoneOffset (minutes behind UTC, positive for West) to desired sign convention (offset relative to UTC)
    // Example: EST (UTC-5) -> getTimezoneOffset() = 300, we want -300
    const localTzOffsetMinutes = -sitdownDate.getTimezoneOffset();
    const response = await client.get<ITuneOverviewScheduled[]>(
      `/scheduled_tunes_overview/${userId}/${playlistId}`,
      {
        params: {
          show_playlist_deleted: showDeleted,
          sitdown_date: sitdownDateUtcString,
          local_tz_offset_minutes: localTzOffsetMinutes,
          enable_backfill: enableBackfill,
        },
      },
    );
    try {
      const sample = response.data.slice(0, 5).map((t) => ({
        id: (t as unknown as { id?: number }).id ?? null,
        bucket: (t as unknown as { bucket?: number | null }).bucket ?? null,
      }));
      console.log(
        "[ScheduledFetch][Query] axios response",
        JSON.stringify({ length: response.data.length, sample }),
      );
    } catch {
      // ignore logging error
    }
    return response.data;
  } catch (error) {
    console.error("Error in getPracticeListScheduled: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    return ERROR_TUNE;
  }
}

/**
 * Fetch (or generate) the frozen daily practice queue snapshot for a user/playlist.
 * Returns entries plus a derived count of newly-due tunes not in the snapshot (bucket 1 gap).
 */
export async function getPracticeQueue(
  userId: number,
  playlistId: number,
  sitdownDate: Date,
  forceRegen = false,
): Promise<IPracticeQueueWithMeta> {
  if (!sitdownDate || Number.isNaN(sitdownDate.getTime())) {
    throw new Error("sitdownDate (Date) required for practice queue fetch");
  }
  const sitdownDateUtcString = formatDateToIso8601UtcString(sitdownDate);
  const localTzOffsetMinutes = -sitdownDate.getTimezoneOffset();
  try {
    const response = await client.get<IPracticeQueueWithMeta>(
      `/practice-queue/${userId}/${playlistId}/with-meta`,
      {
        params: {
          sitdown_date: sitdownDateUtcString,
          local_tz_offset_minutes: localTzOffsetMinutes,
          force_regen: forceRegen,
        },
      },
    );
    // Contract (stable): this function ALWAYS returns a wrapper
    //   { entries: IPracticeQueueEntry[], new_tunes_due_count: number }
    // regardless of backend/raw shape.
    // The backend currently returns a raw array for GET /practice-queue
    // (response_model=list[PracticeQueueEntryModel]). We normalize here.
    const dataAny: unknown = response.data;
    let normalizedEntries: IPracticeQueueEntry[] = [];
    let newTunesDueCount = 0;

    if (Array.isArray(dataAny)) {
      // Legacy/raw array fallback (older endpoint)
      normalizedEntries = dataAny as IPracticeQueueEntry[];
    } else if (dataAny && typeof dataAny === "object") {
      // Wrapper-like shape from any caller/adapter that already wrapped it
      const maybeWrapper = dataAny as {
        entries?: unknown;
        new_tunes_due_count?: unknown;
      };
      const { entries } = maybeWrapper;
      if (Array.isArray(entries)) {
        normalizedEntries = entries as IPracticeQueueEntry[];
      } else if (entries && typeof entries === "object") {
        // Occasionally an object-map keyed by tune id; convert to array
        normalizedEntries = Object.values(
          entries as Record<string, IPracticeQueueEntry>,
        );
      } else {
        normalizedEntries = [];
      }
      if (typeof maybeWrapper.new_tunes_due_count === "number") {
        newTunesDueCount = maybeWrapper.new_tunes_due_count;
      }
    }

    const wrapped: IPracticeQueueWithMeta = {
      entries: normalizedEntries,
      new_tunes_due_count: newTunesDueCount,
    };
    if (process.env.NODE_ENV !== "production") {
      try {
        const length = wrapped.entries.length;
        const sample = wrapped.entries.slice(0, 3).map((e) => {
          const row = e as Partial<IPracticeQueueEntry>;
          return {
            tune_ref: row.tune_ref,
            completed_at: row.completed_at,
            bucket: row.bucket as number | null | undefined,
          };
        });
        console.debug("[PracticeQueue][Query] normalized", {
          userId,
          playlistId,
          forceRegen,
          entriesType: "array",
          length,
          new_tunes_due_count: wrapped.new_tunes_due_count,
          sample,
        });
      } catch {
        // ignore debug errors
      }
    }
    return wrapped;
  } catch (error) {
    console.error("Error in getPracticeQueue: ", error);
    return { entries: [], new_tunes_due_count: 0 };
  }
}

/**
 * Entries-only variant of the practice queue fetch.
 * Stable contract: returns IPracticeQueueEntry[] directly from backend /entries endpoint.
 */
export async function getPracticeQueueEntries(
  userId: number,
  playlistId: number,
  sitdownDate: Date,
  forceRegen = false,
): Promise<IPracticeQueueEntry[]> {
  if (!sitdownDate || Number.isNaN(sitdownDate.getTime())) {
    throw new Error("sitdownDate (Date) required for practice queue fetch");
  }
  const sitdownDateUtcString = formatDateToIso8601UtcString(sitdownDate);
  const localTzOffsetMinutes = -sitdownDate.getTimezoneOffset();
  try {
    const response = await client.get<IPracticeQueueEntry[]>(
      `/practice-queue/${userId}/${playlistId}/entries`,
      {
        params: {
          sitdown_date: sitdownDateUtcString,
          local_tz_offset_minutes: localTzOffsetMinutes,
          force_regen: forceRegen,
        },
      },
    );
    const data = response.data;
    if (Array.isArray(data)) return data;
    // Fallback: if the server returned wrapper or object-map by mistake
    if (data && typeof data === "object") {
      const maybeEntries = (data as unknown as { entries?: unknown }).entries;
      if (Array.isArray(maybeEntries))
        return maybeEntries as IPracticeQueueEntry[];
      if (maybeEntries && typeof maybeEntries === "object") {
        return Object.values(
          maybeEntries as Record<string, IPracticeQueueEntry>,
        );
      }
    }
    return [];
  } catch (error) {
    console.error("Error in getPracticeQueueEntries: ", error);
    return [];
  }
}

/**
 * Request additional backlog tunes (explicit backfill) appended to active daily queue.
 * Returns ONLY newly appended queue entries (can be empty if none eligible).
 */
export async function refillPracticeQueue(
  userId: number,
  playlistId: number,
  sitdownDate: Date,
  count = 5,
): Promise<IPracticeQueueEntry[]> {
  if (!sitdownDate || Number.isNaN(sitdownDate.getTime())) {
    throw new Error("sitdownDate (Date) required for practice queue refill");
  }
  const sitdownDateUtcString = formatDateToIso8601UtcString(sitdownDate);
  const localTzOffsetMinutes = -sitdownDate.getTimezoneOffset();
  try {
    const response = await client.post<IPracticeQueueEntry[]>(
      `/practice-queue/${userId}/${playlistId}/refill`,
      null,
      {
        params: {
          sitdown_date: sitdownDateUtcString,
          local_tz_offset_minutes: localTzOffsetMinutes,
          count,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error in refillPracticeQueue: ", error);
    return [];
  }
}

/**
 * Manually (priority) add selected tunes to today's practice queue snapshot.
 * Returns structure with added_tune_ids, skipped_tune_ids, and enriched new_entries (queue rows added).
 */
export async function addTunesToPracticeQueue(
  userId: number,
  playlistId: number,
  tuneIds: number[],
  sitdownDate: Date,
): Promise<{
  added_tune_ids: number[];
  skipped_tune_ids: number[];
  new_entries: IPracticeQueueEntry[];
}> {
  if (!sitdownDate || Number.isNaN(sitdownDate.getTime())) {
    throw new Error("sitdownDate (Date) required for practice queue add");
  }
  const sitdownDateUtcString = formatDateToIso8601UtcString(sitdownDate);
  const localTzOffsetMinutes = -sitdownDate.getTimezoneOffset();
  try {
    const response = await client.post(
      `/practice-queue/${userId}/${playlistId}/add`,
      { tune_ids: tuneIds },
      {
        params: {
          sitdown_date: sitdownDateUtcString,
          local_tz_offset_minutes: localTzOffsetMinutes,
        },
      },
    );
    /**
     * Backend (add_practice_queue_tunes_endpoint) returns shape:
     *   {
     *     added: [<serialized queue rows>],
     *     skipped_existing: number[],
     *     missing: number[],
     *     duplicate_request_ignored: number[]
     *   }
     * Frontend historically expected { added_tune_ids, skipped_tune_ids, new_entries }.
     * To avoid a broader refactor we adapt here.
     */
    const backend = response.data as unknown as {
      added?: Array<
        Partial<IPracticeQueueEntry> & {
          tune_ref?: number;
          tune_id?: number;
          id?: number;
        }
      >;
      skipped_existing?: number[];
      missing?: number[];
      duplicate_request_ignored?: number[];
    };
    const addedTuneIds: number[] = Array.isArray(backend.added)
      ? backend.added
          .map((r) => {
            if (typeof r.tune_ref === "number") return r.tune_ref;
            if (typeof r.tune_id === "number") return r.tune_id;
            if (typeof r.id === "number") return r.id;
            return undefined;
          })
          .filter((v): v is number => typeof v === "number")
      : [];
    const skippedTuneIds: number[] = Array.isArray(backend.skipped_existing)
      ? backend.skipped_existing
      : [];
    const newEntries: IPracticeQueueEntry[] = Array.isArray(backend.added)
      ? (backend.added as IPracticeQueueEntry[])
      : [];
    return {
      added_tune_ids: addedTuneIds,
      skipped_tune_ids: skippedTuneIds,
      new_entries: newEntries,
    };
  } catch (error) {
    console.error("Error in addTunesToPracticeQueue: ", error);
    return { added_tune_ids: [], skipped_tune_ids: [], new_entries: [] };
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
      latest_practiced: null,
      latest_quality: null,
      latest_easiness: null,
      latest_interval: null,
      latest_repetitions: null,
      latest_due: null,
      scheduled: null, // Current scheduling date
      latest_backup_practiced: null,
      external_ref: null,
      tags: null,
      recall_eval: null,
      notes: null,
      favorite_url: null,
      playlist_deleted: null,
      latest_difficulty: null,
      latest_stability: null,
      latest_step: null,
      latest_technique: null,
      latest_goal: null,
    }));
  } catch (error) {
    console.error("Error in getTunesOnly: ", error);
    // Return a dummy Tune object to avoid breaking the UI
    throw error;
  }
}

async function createNewOverrideRecord(
  user_id: number,
  tune_id: number,
  tuneOverrideData: Partial<ITuneOverride>, // change request
  dbTune: ITuneOverview, // public tune data
) {
  const tuneOverrideDataWithTuneRef: Partial<ITuneOverride> = {
    ...tuneOverrideData,
    tune_ref: tune_id,
    user_ref: user_id,
  };
  const responseCreate = await fetch(
    `${TT_API_BASE_URL}/tunetrees/tune_override`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(tuneOverrideDataWithTuneRef),
    },
  );

  if (!responseCreate.ok) {
    throw new Error(`Request failed with status code ${responseCreate.status}`);
  }

  const responseTuneOverride: ITuneOverride = await responseCreate.json();
  const responseData: ITune = {
    ...dbTune,
    ...responseTuneOverride,
  };
  return responseData;
}

async function updateOverrideRecord(
  existingOverrideResponse: Response, // override data from db
  tuneOverrideData: Partial<ITuneOverride>, // change request
  dbTune: ITuneOverview, // public tune data
) {
  const tuneOverrideDataFromDB = await existingOverrideResponse.json();
  const overrideId = tuneOverrideDataFromDB.id;
  const responseCreate = await fetch(
    `${TT_API_BASE_URL}/tunetrees/tune_override/${overrideId}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(tuneOverrideData),
    },
  );

  if (!responseCreate.ok) {
    throw new Error(`Request failed with status code ${responseCreate.status}`);
  }

  const responseTuneOverride: ITuneOverride = await responseCreate.json();
  const responseData: ITune = {
    ...dbTune,
    ...responseTuneOverride,
  };
  return responseData;
}

async function updatePublicTuneRecord(
  dbTune: ITuneOverview,
  tune_update: Partial<ITuneOverview>,
  tune_id: number,
) {
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
    if (tune_update.deleted !== dbTune.deleted)
      tuneUpdateData.deleted = tune_update.deleted;
  }

  console.log(
    "tuneUpdateDataStringified:",
    JSON.stringify(tuneUpdateData, null, 2),
  );

  const urlString = `${TT_API_BASE_URL}/tunetrees/tune/${tune_id}`;

  console.log("===> queries.ts:215 ~ urlString", urlString);

  // The axios library is throwing an error with the string "Sí Bheag, Sí Mhór",
  // or just "í", so using fetch instead.
  // See issue filed: https://github.com/axios/axios/issues/6761
  // Contemplating using the fetch API for everything.
  //
  // const response = await axios.patch<ITune>(urlString, tuneUpdateData, {
  //   headers: {
  //     // accept: "application/json",
  //     "Content-Type": "application/json; charset=utf-8",
  //   },
  //   timeout: 10_000,
  // });
  // if (!response.status || response.status < 200 || response.status >= 300) {
  //   throw new Error(`Request failed with status code ${response.status}`);
  // }
  // const responseData = response.data;

  const response = await fetch(urlString, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(tuneUpdateData),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status code ${response.status}`);
  }

  const responseData: ITune = await response.json();
  return responseData;
}

function createTuneOverrideChangeRecordFromDifferences(
  tune_update: Partial<ITuneOverview>,
  dbTune: ITuneOverview,
): Partial<ITuneOverride> {
  const tuneOverrideData: Partial<ITuneOverride> = {};
  if (dbTune) {
    if (tune_update.title !== dbTune.title)
      tuneOverrideData.title = tune_update.title;
    if (tune_update.type !== dbTune.type)
      tuneOverrideData.type = tune_update.type;
    if (tune_update.structure !== dbTune.structure)
      tuneOverrideData.structure = tune_update.structure;
    if (tune_update.mode !== dbTune.mode)
      tuneOverrideData.mode = tune_update.mode;
    if (tune_update.incipit !== dbTune.incipit)
      tuneOverrideData.incipit = tune_update.incipit;
    if (tune_update.genre !== dbTune.genre)
      tuneOverrideData.genre = tune_update.genre;
    if (tune_update.deleted !== dbTune.deleted)
      tuneOverrideData.deleted = tune_update.deleted;
  }
  return tuneOverrideData;
}

/**
 * Update a specific tune in a user's playlist.
 *
 * Dates in tune_update must be in UTC and look like "2023-01-11 22:56:26".
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
  saveAsOverride: boolean,
  tune_update: Partial<ITuneOverview>,
): Promise<ITune> {
  try {
    console.log("Input title:", tune_update.title);
    console.log("Title bytes:", [
      ...new TextEncoder().encode(tune_update.title || ""),
    ]);

    if (tune_update.mode) {
      tune_update.mode = normalizeKey(tune_update.mode);
    }

    const dbTune = await getPlaylistTuneOverview(
      user_id,
      playlist_ref,
      tune_id,
    );
    if ("detail" in dbTune) {
      console.error("Error calling getPlaylistTuneOverview: ", dbTune.detail);
      throw new Error(dbTune.detail);
    }

    // This goes into some fairly nasty logic to save the user data as an override
    // vs. updating the public tune record. One could make the argument that this
    // logic should be implemented in the backend, to avoid so many round trips.
    // Keep this in mind for optimization or simplication in the future.
    const responseData = await (saveAsOverride
      ? saveTuneAsOverride(tune_update, dbTune, user_id, tune_id)
      : updatePublicTuneRecord(dbTune, tune_update, tune_id));

    console.log("Received response:", responseData);

    return responseData;
  } catch (error) {
    console.error("Error in updatePlaylistTune: ", error);
    throw error;
  }
}

async function saveTuneAsOverride(
  tune_update: Partial<ITuneOverview>,
  dbTune: ITuneOverview,
  user_id: number,
  tune_id: number,
): Promise<ITune> {
  const tuneOverrideData: Partial<ITuneOverride> =
    createTuneOverrideChangeRecordFromDifferences(tune_update, dbTune);

  console.log(
    "tuneUpdateDataStringified:",
    JSON.stringify(tuneOverrideData, null, 2),
  );

  const existingOverrideResponse = await fetch(
    `${TT_API_BASE_URL}/tunetrees/query_tune_override?user_ref=${user_id}&tune_ref=${tune_id}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );

  let responseData: ITune;

  if (existingOverrideResponse.status === 404) {
    responseData = await createNewOverrideRecord(
      user_id,
      tune_id,
      tuneOverrideData,
      dbTune,
    );
  } else if (existingOverrideResponse.ok) {
    responseData = await updateOverrideRecord(
      existingOverrideResponse,
      tuneOverrideData,
      dbTune,
    );
  } else {
    throw new Error(
      `Request failed with status code ${existingOverrideResponse.status}`,
    );
  }
  return responseData;
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
      { timeout: 10000 }, // 10 seconds timeout
    );
    return response.data;
  } catch (error) {
    console.error("Error calling playlist-tune-overview: ", error);
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
      `Request URL (computed): /references/${userRef ?? 0}/${tuneRef}?public=0`,
    );
    const response = await client.get<IReferenceData[]>(
      `/references/${userRef ?? 0}/${tuneRef}`,
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

/**
 * Fetch references for a specific tune.
 *
 * @param url - URL value to search for.
 * @returns A promise that resolves to a list of references.
 */
export async function queryReferences(url: string): Promise<IReferenceData[]> {
  try {
    console.log("===> queries.ts:368 ~ ", url);
    const response = await client.get<IReferenceData[]>(
      `/references_query?url=${url}`,
      {},
    );
    console.log("references_query response: ", response.data);
    return response.data;
  } catch (error) {
    console.error("Error in queryReferences: ", error);
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
      `Request URL (computed): /references/${userRef ?? 0}/${tuneRef}?public=1`,
    );
    const response = await client.get<IReferenceData[]>(
      `/references/${userRef ?? 0}/${tuneRef}`,
      {
        params: { public: 1 },
      },
    );
    const references = response.data;
    const favoriteReference = references.find((ref) => ref.favorite === 1);
    if (favoriteReference) {
      return favoriteReference;
    }
    return references.length > 0 ? references[0] : null;
  } catch (error) {
    console.error("Error in getReferenceFavorite: ", error);
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
    // Remove the ID from the note object, if present.  Which may have
    // been assigned by the client to track the note in the UI,
    // but should not be sent to the server.
    const { id, ...noteWithoutId } = note;
    if (id !== undefined && id >= 0) {
      throw new Error("ID must be a negative number if present");
    }
    const response = await client.post<INote>("/notes", noteWithoutId);
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
 * Reorder notes by providing a list of note IDs in the new order.
 *
 * @param noteIds - Array of note IDs in the desired order.
 * @returns A promise that resolves to the updated notes in the new order.
 */
export async function reorderNotes(noteIds: number[]): Promise<INote[]> {
  try {
    const response = await client.patch<INote[]>("/notes/reorder", noteIds);
    return response.data;
  } catch (error) {
    console.error("Error in reorderNotes: ", error);
    throw error;
  }
}

/**
 * Reorder references by providing a list of reference IDs in the new order.
 *
 * @param referenceIds - Array of reference IDs in the desired order.
 * @returns A promise that resolves to the updated references in the new order.
 */
export async function reorderReferences(
  referenceIds: number[],
): Promise<IReferenceData[]> {
  try {
    const response = await client.patch<IReferenceData[]>(
      "/references/reorder",
      referenceIds,
    );
    return response.data;
  } catch (error) {
    console.error("Error in reorderReferences: ", error);
    throw error;
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
): Promise<ITune> {
  try {
    const response = await client.patch<ITune>(`/tune/${tuneRef}`, tuneUpdate);
    return response.data;
  } catch (error) {
    console.error("Error in updateTune: ", error);
    throw new Error(`Unable to update tune: ${(error as Error).message}`);
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
  tune: Partial<ITuneOverview>,
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
      deleted: tune.deleted ?? false,
      private_for: tune.private_for ?? null,
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
  showDeleted = false,
): Promise<IPlaylist[] | { detail: string }> {
  try {
    const response = await client.get<IPlaylist[] | { detail: string }>(
      "/playlist",
      {
        params: { user_ref: userRef, show_deleted: showDeleted },
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
  allPublic = false,
): Promise<IInstrument[]> {
  try {
    const [response, responsePublic] = await Promise.all([
      client.get<IInstrument[] | { detail: string }>("/instruments", {
        params: { user_ref: userRef },
      }),
      allPublic
        ? client.get<IInstrument[] | { detail: string }>("/instruments", {
            params: { user_ref: 0 },
          })
        : Promise.resolve({ data: [] }),
    ]);

    if (Array.isArray(response.data) && Array.isArray(responsePublic.data)) {
      response.data = [...response.data, ...responsePublic.data];
    }
    if (!Array.isArray(response.data)) {
      throw new TypeError(
        `Unable to fetch instruments: ${JSON.stringify(response.data)}`,
      );
    }
    return response.data;
  } catch (error) {
    console.error(`Error in getInstruments(${userRef})`, error);
    throw error;
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

export async function getPracticeRecords(
  tuneRef: number,
  playlistRef: number,
): Promise<IPracticeRecord> {
  const res = await client.get<IPracticeRecord>(
    `/practice_record/${playlistRef}/${tuneRef}`,
  );
  return res.data;
}

export async function createPracticeRecord(
  tuneRef: number,
  playlistRef: number,
  record: Partial<IPracticeRecord>,
): Promise<IPracticeRecord> {
  const payload = {
    tune_ref: tuneRef,
    playlist_ref: playlistRef,
    ...record,
  };
  const res = await client.post<IPracticeRecord>("/practice_record", payload);
  return res.data;
}

export async function updatePracticeRecord(
  tuneRef: number,
  playlistRef: number,
  record: Partial<IPracticeRecord>,
): Promise<IPracticeRecord> {
  const res = await client.patch<IPracticeRecord>(
    `/practice_record/${playlistRef}/${tuneRef}`,
    record,
  );
  return res.data;
}

export async function upsertPracticeRecord(
  tuneRef: number,
  playlistRef: number,
  record: Partial<IPracticeRecord>,
): Promise<IPracticeRecord> {
  const res = await client.put<IPracticeRecord>(
    `/practice_record/${playlistRef}/${tuneRef}`,
    record,
  );
  return res.data;
}

export async function deletePracticeRecord(
  tuneRef: number,
  playlistRef: number,
): Promise<void> {
  await client.delete(`/practice_record/${playlistRef}/${tuneRef}`);
}

export async function fetchTuneOverride(
  overrideId: number,
): Promise<ITuneOverride> {
  const res = await fetchWithTimeout(
    `${TT_API_BASE_URL}/tunetrees/tune_override/${overrideId}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch tune override: ${res.statusText}`);
  }
  const result = await res.json();
  return result as ITuneOverride;
}

export async function createTuneOverride(
  data: Partial<ITuneOverride>,
): Promise<ITuneOverride> {
  const res = await fetchWithTimeout(
    `${TT_API_BASE_URL}/tunetrees/tune_override`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to create tune override: ${res.statusText}`);
  }
  const result = await res.json();
  return result as ITuneOverride;
}

export async function updateTuneOverride(
  overrideId: number,
  data: Partial<ITuneOverride>,
): Promise<ITuneOverride> {
  const res = await fetchWithTimeout(
    `${TT_API_BASE_URL}/tunetrees/tune_override/${overrideId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to update tune override: ${res.statusText}`);
  }
  const result = await res.json();
  return result as ITuneOverride;
}

export async function deleteTuneOverride(overrideId: number): Promise<void> {
  const res = await fetchWithTimeout(
    `${TT_API_BASE_URL}/tunetrees/tune_override/${overrideId}`,
    {
      method: "DELETE",
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to delete tune override: ${res.statusText}`);
  }
}

export async function getTuneType(tuneTypeId: string): Promise<ITuneType> {
  const res = await fetchWithTimeout(
    `${TT_API_BASE_URL}/tunetrees/tune_type/${tuneTypeId}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch tune type: ${res.statusText}`);
  }
  const result = await res.json();
  return result as ITuneType;
}

export async function createTuneType(
  data: Partial<ITuneType>,
): Promise<ITuneType> {
  const res = await fetchWithTimeout(`${TT_API_BASE_URL}/tunetrees/tune_type`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Failed to create tune type: ${res.statusText}`);
  }
  const result = await res.json();
  return result as ITuneType;
}

export async function updateTuneType(
  tuneTypeId: string,
  data: Partial<ITuneType>,
): Promise<ITuneType> {
  const res = await fetchWithTimeout(
    `${TT_API_BASE_URL}/tunetrees/tune_type/${tuneTypeId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to update tune type: ${res.statusText}`);
  }
  const result = await res.json();
  return result as ITuneType;
}

export async function deleteTuneType(tuneTypeId: string): Promise<void> {
  const res = await fetchWithTimeout(
    `${TT_API_BASE_URL}/tunetrees/tune_type/${tuneTypeId}`,
    {
      method: "DELETE",
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to delete tune type: ${res.statusText}`);
  }
}

export async function fetchGenreTuneType(
  assocId: number,
): Promise<IGenreTuneType> {
  const res = await fetch(
    `${TT_API_BASE_URL}/tunetrees/genre_tune_type/${assocId}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch association: ${res.statusText}`);
  }
  return (await res.json()) as IGenreTuneType;
}

export async function createGenreTuneType(
  data: Partial<IGenreTuneType>,
): Promise<IGenreTuneType> {
  const res = await fetch(`${TT_API_BASE_URL}/tunetrees/genre_tune_type`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Failed to create association: ${res.statusText}`);
  }
  return (await res.json()) as IGenreTuneType;
}

export async function updateGenreTuneType(
  assocId: number,
  data: Partial<IGenreTuneType>,
): Promise<IGenreTuneType> {
  const res = await fetch(
    `${TT_API_BASE_URL}/tunetrees/genre_tune_type/${assocId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to update association: ${res.statusText}`);
  }
  return (await res.json()) as IGenreTuneType;
}

export async function deleteGenreTuneType(assocId: number): Promise<void> {
  const res = await fetch(
    `${TT_API_BASE_URL}/tunetrees/genre_tune_type/${assocId}`,
    {
      method: "DELETE",
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to delete association: ${res.statusText}`);
  }
}

export async function getTuneTypesByGenre(
  genreId: string,
): Promise<ITuneType[]> {
  const res = await fetch(`${TT_API_BASE_URL}/tunetrees/tune_types/${genreId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tune types: ${res.statusText}`);
  }
  return (await res.json()) as ITuneType[];
}

export async function searchTunesByTitle(
  title: string,
  limit = 10,
): Promise<ITune[]> {
  const url = new URL(`${TT_API_BASE_URL}/tunetrees/tunes/search`);
  url.searchParams.append("title", title);
  url.searchParams.append("limit", limit.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Error searching tunes: ${response.statusText}`);
  }
  return (await response.json()) as ITune[];
}
