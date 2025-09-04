"use server";

import type { TableState } from "@tanstack/react-table";
import { isExtendedLoggingEnabled, logVerbose } from "@/lib/logging";
import { Mutex } from "async-mutex";
import axios, { isAxiosError } from "axios";
import { createServerAxios } from "@/lib/axios-server";
import { type ITabSpec, initialTabSpec } from "./tab-spec";
import type {
  ITableStateTable,
  ITableTransientData,
  ITableTransientDataFields,
  ScreenSize,
  TablePurpose,
} from "./types";

// Provide a test-friendly fallback so server components don't hard-crash (500) when
// the variable isn't injected (Playwright env sometimes omits it when booting fast).
// Backend default port is 8000; adjust if central config changes.
// Runtime tripwire: warn if this server module is ever executed in a client context.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  console.warn(
    "[Tripwire] practice/settings.ts executed in a client environment. This should only be imported via server actions.",
  );
}

const TT_API_BASE_URL = process.env.TT_API_BASE_URL ?? "http://localhost:8000";
if (!process.env.TT_API_BASE_URL) {
  console.warn(
    "TT_API_BASE_URL not set in env; falling back to http://localhost:8000 for tests",
  );
}
logVerbose("TT_API_BASE_URL resolved:", TT_API_BASE_URL);

// Settings API is at /settings/ from the base URL
const baseURL = `${TT_API_BASE_URL}/settings`;
logVerbose("Settings API baseURL:", baseURL);

const client = createServerAxios(baseURL);

const tableStateMutex = new Mutex();

export async function createOrUpdateTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  playlistId: number,
  tableStates: TableState,
  currentTune: number | null,
): Promise<ITableStateTable> {
  logVerbose(
    (() => {
      if (!isExtendedLoggingEnabled()) return "LF6: createOrUpdateTableState"; // cheap
      return `LF6: createOrUpdateTableState: purpose=${purpose} playlistId=${playlistId}, currentTune=${currentTune}, rowSelection: ${JSON.stringify(tableStates.rowSelection)}`;
    })(),
  );
  return tableStateMutex.runExclusive(async () => {
    try {
      logVerbose(
        `=> createOrUpdateTableState: purpose=${purpose}, currentTune=${currentTune})}`,
      );
      if (userId <= 0) {
        throw new Error("createOrUpdateTableState: userId is invalid");
      }
      // NOTE: During initial signup flow the user may not yet have selected / created
      // a playlist. Instead of throwing (which surfaces a browser error in tests),
      // we short‑circuit and return a dummy structure so callers can proceed.
      if (playlistId === undefined || playlistId === null || playlistId <= 0) {
        console.warn(
          "createOrUpdateTableState: skipping – playlistId not yet established (signup flow)",
        );
        return {
          user_id: userId,
          screen_size: screenSize,
          // Provide sentinel values; caller logic should tolerate these when playlist is absent
          purpose,
          playlist_id: -1,
          settings: tableStates,
          current_tune: currentTune ?? -1,
        } as ITableStateTable;
      }

      const tableStatesStr = JSON.stringify(tableStates);
      const tableStateTable: ITableStateTable = {
        user_id: userId,
        screen_size: screenSize,
        purpose: purpose,
        playlist_id: playlistId,
        settings: tableStatesStr,
        current_tune: currentTune ?? -1,
      };
      const response = await client.post<ITableStateTable>(
        "/table_state",
        tableStateTable,
      );
      logVerbose(
        "<= createOrUpdateTableState: response status: ",
        response?.status,
      );
      if (response.data?.settings) {
        response.data.settings = JSON.parse(
          response.data.settings as string,
        ) as TableState;
      } else {
        console.error(
          "createOrUpdateTableState: response.data.settings is null",
        );
      }
      const tableStateTableResult: ITableStateTable = response.data;
      logVerbose(
        `=> createOrUpdateTableState: response.status=${response.status} purpose=${purpose}, playlistId=${playlistId})}`,
      );
      return tableStateTableResult;
    } catch (error) {
      console.error("<= createOrUpdateTableState: ", error);
      throw error;
    }
  });
}

export async function updateTableStateInDb(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  playlistId: number,
  tableStates: TableState,
): Promise<number> {
  logVerbose(
    (() => {
      if (!isExtendedLoggingEnabled()) return "LF6: updateTableStateInDb";
      return `LF6: updateTableStateInDb: purpose=${purpose} playlistId=${playlistId}, rowSelection: ${JSON.stringify(tableStates.rowSelection)}`;
    })(),
  );
  return tableStateMutex.runExclusive(async () => {
    // Tolerate missing playlist during early app bootstrap (e.g., immediately after signup
    // before the playlist creation/selection dialog completes). Treat as a no‑op instead of throwing.
    if (playlistId === undefined || playlistId === null || playlistId <= 0) {
      console.warn(
        "updateTableStateInDb: playlistId not set yet – skipping persistence (will retry when playlist chosen)",
      );
      return 0; // 0 => skipped / no-op
    }
    const maxEConnRefusedRetries = 5;
    let isConnRefused = null;
    let isConnReset = null;
    for (let attempt = 1; attempt <= maxEConnRefusedRetries; attempt++) {
      try {
        logVerbose(
          `=> updateTableStateInDb: purpose=${purpose}, playlistId=${playlistId})}`,
        );
        const tableStatesStr = JSON.stringify(tableStates);
        const tableStateTable: Partial<ITableStateTable> = {
          user_id: userId,
          screen_size: screenSize,
          purpose: purpose,
          playlist_id: playlistId,
          settings: tableStatesStr,
        };
        const response = await client.patch<Partial<ITableStateTable>>(
          `/table_state/${userId}/${playlistId}/${screenSize}/${purpose}`,
          tableStateTable,
          { timeout: 10000 }, // Increase timeout to 10 seconds
        );
        logVerbose(
          `=> updateTableStateInDb: response.status=${response.status} purpose=${purpose}, playlistId=${playlistId})}`,
        );
        return response.status;
      } catch (error) {
        // Suppress noisy logs and early exits for connection-refused errors so retry loop can continue.
        const axiosErr = isAxiosError(error) ? error : null;
        const code =
          (axiosErr as unknown as { code?: string })?.code ||
          (error as { code?: string })?.code;
        const message = (error as Error)?.message ?? "";

        isConnRefused =
          code === "ECONNREFUSED" || message.includes("ECONNREFUSED");

        isConnReset = code === "ECONNRESET" || message.includes("ECONNRESET");

        if (isConnRefused) {
          // silently retry after a small backoff
          await new Promise((r) => setTimeout(r, attempt * 200));
          continue;
        }
        if (isConnReset) {
          break;
        }

        console.error("<= updateTableStateInDb: ", error);
        return 500;
      }
    }
    if (isConnReset) {
      console.warn(
        "<= updateTableStateInDb: table update occurred after DB reboot, abandoning update",
      );
    } else if (isConnRefused) {
      console.error(
        "<= updateTableStateInDb: exhausted all retries, ECONNREFUSED",
      );
    } else {
      console.error("<= updateTableStateInDb: exhausted all retries, fallback");
    }
    return 500;
  });
}

export async function updateCurrentTuneInDb(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  playlistId: number,
  currentTune: number | null,
): Promise<number> {
  logVerbose(
    (() => {
      if (!isExtendedLoggingEnabled()) return "LF6: updateCurrentTuneInDb";
      return `LF6: updateCurrentTuneInDb: purpose=${purpose} playlistId=${playlistId}, currentTune=${currentTune}`;
    })(),
  );
  return tableStateMutex.runExclusive(async () => {
    const tableStateTable: Partial<ITableStateTable> = {
      current_tune: currentTune === null ? -1 : currentTune,
    };
    try {
      logVerbose(
        `=> updateCurrentTuneInDb: purpose=${purpose}, currentTune=${currentTune})}`,
      );
      const response = await client.patch<Partial<ITableStateTable>>(
        `/table_state/${userId}/${playlistId}/${screenSize}/${purpose}`,
        tableStateTable,
      );
      logVerbose(
        `=> updateCurrentTuneInDb: response.status=${response.status} purpose=${purpose}, currentTune=${currentTune})}`,
      );
      return response.status;
    } catch (error) {
      console.error("<= updateCurrentTuneInDb: ", error);
      return 500;
    }
  });
}

export async function getTableStateTable(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  playlistId: number,
): Promise<ITableStateTable | null> {
  logVerbose(
    (() => {
      if (!isExtendedLoggingEnabled()) return "LF6: getTableStateTable";
      return `LF6: getTableStateTable: purpose=${purpose} playlistId=${playlistId}`;
    })(),
  );
  if (playlistId === undefined || playlistId === null || playlistId <= 0) {
    console.warn(
      "getTableStateTable: playlistId not yet available – returning null (signup bootstrap)",
    );
    return null;
  }

  return tableStateMutex.runExclusive(async () => {
    try {
      logVerbose(`=> getTableStateTable: purpose=${purpose}`);
      const response = await client.get<ITableStateTable>(
        `/table_state/${userId}/${playlistId}/${screenSize}/${purpose}`,
      );
      if (response.data === null) {
        console.log(
          "getTableStateTable response is null, status: ",
          response.status,
        );
        return null;
      }
      response.data.settings = JSON.parse(
        response.data.settings as string,
      ) as TableState;
      const tableStateTable: ITableStateTable = response.data;
      // rowSelection: ${JSON.stringify(tableStateTable.settings.rowSelection)}
      const tableSettings = tableStateTable.settings as TableState;
      logVerbose(
        (() => {
          if (!isExtendedLoggingEnabled())
            return "LF6: getTableStateTable (post)";
          return `LF6: getTableStateTable: purpose=${purpose} playlistId=${playlistId}, currentTune=${tableStateTable.current_tune} rowSelection: ${JSON.stringify(tableSettings.rowSelection)}`;
        })(),
      );
      logVerbose("=> getTableStateTable response status: ", response.status);
      return tableStateTable;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `getTableStateTable error: ${error.response?.status} ${error.response?.data}`,
        );
      }
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null; // Return null for 404 status
      }
      console.error("getTableState error: ", error);
      throw error;
    }
  });
}

export async function getTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  playlistId: number,
): Promise<TableState | null> {
  const tableStateTable = await getTableStateTable(
    userId,
    screenSize,
    purpose,
    playlistId,
  );
  return tableStateTable?.settings as TableState;
}

export async function fetchFilterFromDB(
  userId: number,
  purpose: TablePurpose,
  playlistId: number,
): Promise<string> {
  if (playlistId !== undefined && playlistId > 0) {
    const tableStateFromDb = await getTableState(
      userId,
      "full",
      purpose,
      playlistId,
    );

    if (tableStateFromDb) {
      const filter: string = tableStateFromDb.globalFilter;
      return filter;
    }
  }
  return "";
}

export async function getTableCurrentTune(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  playlistId: number,
): Promise<number> {
  const tableStateTable = await getTableStateTable(
    userId,
    screenSize,
    purpose,
    playlistId,
  );
  return tableStateTable?.current_tune ?? -1;
}

export async function deleteTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  playlistId: number,
): Promise<number> {
  try {
    const response = await client.delete(
      `/table_state/${userId}/${playlistId}/${screenSize}/${purpose}`,
    );
    logVerbose("deleteTableState: ", response?.status);
    return response.status;
  } catch (error) {
    console.error("deleteTableState: ", error);
    return 500;
  }
}

// =====
// export async function createOrUpdateTableState(
//   userId: number,
//   screenSize: ScreenSize,
//   purpose: TablePurpose,
//   tableStates: TableState,
//   currentTune: number | null,
// ): Promise<number> {
//   try {
//     console.log(
//       `=> createOrUpdateTableState rowSelection: ${JSON.stringify(tableStates.rowSelection)}`,
//     );
//     const tableStatesStr = JSON.stringify(tableStates);
//     const response = await client.post(
//       `/table_state/${userId}/${screenSize}/${purpose}`,
//       tableStatesStr,
//     );
//     console.log("<= createOrUpdateTableState: ", response?.status);
//     return response.status;
//     // Handle successful response
//   } catch (error) {
//     // Handle error
//     console.error("<= createOrUpdateTableState: ", error);
//     return 500;
//   }
// }

// export async function updateTableState(
//   userId: number,
//   screenSize: ScreenSize,
//   purpose: TablePurpose,
//   tableStates: TableState,
// ): Promise<number> {
//   try {
//     const tableStatesStr = JSON.stringify(tableStates);
//     const response = await client.put(
//       `/table_state/${userId}/${screenSize}/${purpose}`,
//       tableStatesStr,
//     );
//     // Handle successful response
//     console.log("createOrUpdateTableState: ", response?.status);
//     return response.status;
//   } catch (error) {
//     // Handle error
//     console.error("updateTableState: ", error);
//     return 500;
//   }
// }

// export async function getTableState(
//   userId: number,
//   screenSize: ScreenSize,
//   purpose: TablePurpose,
// ): Promise<TableState | null> {
//   try {
//     const response = await client.get(
//       `/table_state/${userId}/${screenSize}/${purpose}`,
//     );
//     // Handle successful response
//     const tableStatesStr: string = response.data as string;
//     // Not very confident about this reconstitution of TableState
//     const tableStates: TableState = JSON.parse(tableStatesStr) as TableState;
//     console.error("getTableState response status: ", response.status);
//     return tableStates;
//   } catch (error) {
//     if (isAxiosError(error) && error.response?.status === 404) {
//       return null; // Return null for 404 status
//     }
//     // Handle error
//     console.error("getTableState error: ", error);
//     throw error;
//   }
// }

export async function createOrUpdateTableTransientData(
  userId: number,
  tuneId: number,
  playlistId: number,
  purpose: TablePurpose,
  notesPrivate: string | null,
  notesPublic: string | null,
  recallEval: string | null,
): Promise<number> {
  try {
    const transientData: ITableTransientDataFields = {
      note_private: notesPrivate,
      note_public: notesPublic,
      recall_eval: recallEval,
    };
    // const transientDataStr = JSON.stringify(transientData);
    const response = await client.post(
      `/table_transient_data/${userId}/${tuneId}/${playlistId}/${purpose}`,
      transientData,
    );
    // Handle successful response
    console.log("createOrUpdateTableTransientData: ", response?.data);
    return response.status;
  } catch (error) {
    // Handle error
    console.error("createOrUpdateTableTransientData: ", error);
    return 500;
  }
}

export async function getTableTransientData(
  userId: number,
  tuneId: number,
  playlistId: number,
  purpose: TablePurpose,
): Promise<ITableTransientData | null> {
  try {
    const response = await client.get(
      `/table_transient_data/${userId}/${tuneId}/${playlistId}/${purpose}`,
    );
    // Handle successful response
    const transientDataStr: string = response.data as string;
    // Not very confident about this reconstitution of TableTransientData
    const transientData: ITableTransientData = JSON.parse(
      transientDataStr,
    ) as ITableTransientData;
    console.error("getTableTransientData response status: ", response.status);
    return transientData;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null; // Return null for 404 status
    }
    // Handle error
    console.error("getTableTransientData error: ", error);
    throw error;
  }
}

export async function deleteTableTransientData(
  userId: number,
  tuneId: number,
  playlistId: number,
  purpose: TablePurpose,
): Promise<number> {
  try {
    const url = `/table_transient_data/${userId}/${tuneId}/${playlistId}/${purpose}`;
    const response = await client.delete(url);
    // Handle successful response
    console.log("deleteTableTransientData: ", response?.status);
    return response.status;
  } catch (error) {
    // Handle error
    console.error("deleteTableTransientData: ", error);
    return 500;
  }
}

// export function deleteTableTransientDataSync(
//   userId: number,
//   tuneId: number,
//   playlistId: number,
//   purpose: TablePurpose,
// ): number {
//   try {
//     const promiseResult = deleteTableTransientData(
//       userId,
//       tuneId,
//       playlistId,
//       purpose,
//     );
//     promiseResult
//       .then((result) => {
//         console.log("deleteTableTransientData successful:", result);
//         return result;
//       })
//       .catch((error) => {
//         console.error("Error submitting feedbacks:", error);
//         return 500;
//       });
//     return 500;
//   } catch (error) {
//     // Handle error
//     console.error("deleteTableTransientData: ", error);
//     return 500;
//   }
// }

const tabGroupMainStateMutex = new Mutex();

export interface ITabGroupMainStateModel {
  user_id: number;
  id: number;
  which_tab: string;
  playlist_id?: number;
  tab_spec?: string | ITabSpec[];
  // Persisted practice tab UI prefs (DB-backed; 0/1 or boolean)
  practice_show_submitted?: boolean | number | null;
  practice_mode_flashcard?: boolean | number | null;
}

export async function getTabGroupMainState(
  userId: number,
  playlistId: number,
): Promise<ITabGroupMainStateModel | null> {
  return tabGroupMainStateMutex.runExclusive(async () => {
    try {
      let response = await client.get(`/tab_group_main_state/${userId}`);
      console.log(
        "getTabGroupMainState response status from GET: ",
        response.status,
      );
      if (response.data === null) {
        console.log(
          "getTabGroupMainState response.data is null, creating new tab group main state",
        );

        // const initialTabSpecString = JSON.stringify(initialTabSpec);
        const tabGroupMainStateModel: Partial<ITabGroupMainStateModel> = {
          user_id: userId,
          which_tab: initialTabSpec[0].id,
          // tab_spec: initialTabSpecString,
          playlist_id: playlistId,
        };
        response = await client.post(
          "/tab_group_main_state",
          tabGroupMainStateModel,
        );
        console.log(
          "getTabGroupMainState response status from POST: ",
          response.status,
        );
        if (!(response.status >= 200 && response.status < 300)) {
          console.error(
            "Error creating tab group main state:",
            response.status,
          );
          throw new Error("Error creating tab group main state");
        }
      }
      const data = response.data as ITabGroupMainStateModel | null;
      if (data && data.tab_spec !== null) {
        data.tab_spec = JSON.parse(data.tab_spec as string) as ITabSpec[];
      }
      // Coerce numeric flags to booleans if backend returns 0/1 integers
      if (data) {
        const coerceBool = (v: boolean | number | null | undefined) =>
          typeof v === "number" ? v !== 0 : (v ?? false);
        data.practice_show_submitted = coerceBool(data.practice_show_submitted);
        data.practice_mode_flashcard = coerceBool(data.practice_mode_flashcard);
      }
      return data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return null; // Return null for 404 status
      }
      console.error("getTabGroupMainState error: ", error);
      throw error;
    }
  });
}

export async function updateTabGroupMainState(
  userId: number,
  tabGroupMainState: Partial<ITabGroupMainStateModel>,
): Promise<number> {
  return tabGroupMainStateMutex.runExclusive(async () => {
    try {
      if (tabGroupMainState.tab_spec !== null) {
        tabGroupMainState.tab_spec = JSON.stringify(tabGroupMainState.tab_spec);
      }
      // Ensure boolean flags serialize as strict booleans (not numbers)
      if (typeof tabGroupMainState.practice_show_submitted === "number") {
        tabGroupMainState.practice_show_submitted =
          tabGroupMainState.practice_show_submitted !== 0;
      }
      if (typeof tabGroupMainState.practice_mode_flashcard === "number") {
        tabGroupMainState.practice_mode_flashcard =
          tabGroupMainState.practice_mode_flashcard !== 0;
      }
      const response = await client.patch(
        `/tab_group_main_state/${userId}`,
        tabGroupMainState,
        { timeout: 10_000 }, // Increase timeout to 10 seconds
      );
      console.log("updateTabGroupMainState response status: ", response.status);
      return response.status;
    } catch (error) {
      console.error("updateTabGroupMainState error: ", error);
      return 500;
    }
  });
}

export async function createTabGroupMainState(
  userId: number,
  tabGroupMainState: Partial<ITabGroupMainStateModel>,
): Promise<number> {
  return tabGroupMainStateMutex.runExclusive(async () => {
    try {
      if (tabGroupMainState.tab_spec !== null) {
        tabGroupMainState.tab_spec = JSON.stringify(tabGroupMainState.tab_spec);
      }
      const response = await client.post(
        "/tab_group_main_state",
        tabGroupMainState,
      );
      console.log("createTabGroupMainState response status: ", response.status);
      return response.status;
    } catch (error) {
      console.error("createTabGroupMainState error: ", error);
      return 500;
    }
  });
}

export async function deleteTabGroupMainState(userId: number): Promise<number> {
  return tabGroupMainStateMutex.runExclusive(async () => {
    try {
      const response = await client.delete(`/tab_group_main_state/${userId}`);
      console.log("deleteTabGroupMainState response status: ", response.status);
      return response.status;
    } catch (error) {
      console.error("deleteTabGroupMainState error: ", error);
      return 500;
    }
  });
}
