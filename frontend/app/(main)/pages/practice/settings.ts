"use server";

import type { TableState } from "@tanstack/react-table";
import { Mutex } from "async-mutex";
import axios, { isAxiosError } from "axios";
import { type ITabSpec, initialTabSpec } from "./tab-spec";
import type {
  ITableStateTable,
  ITableTransientData,
  ITableTransientDataFields,
  ScreenSize,
  TablePurpose,
} from "./types";

const TT_API_BASE_URL = process.env.TT_API_BASE_URL;
console.log("TT_API_BASE_URL env var:", TT_API_BASE_URL);
console.log("Using TT_API_BASE_URL:", TT_API_BASE_URL);

if (!TT_API_BASE_URL) {
  console.error("TT_API_BASE_URL environment variable is not set!");
  throw new Error("TT_API_BASE_URL environment variable is not set");
}

// Settings API is at /settings/ from the base URL
const baseURL = `${TT_API_BASE_URL}/settings`;
console.log("Settings API baseURL:", baseURL);

const client = axios.create({
  baseURL: baseURL,
  timeout: 6000, // Increase timeout to 2 seconds
});

const tableStateMutex = new Mutex();

export async function createOrUpdateTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  playlistId: number,
  tableStates: TableState,
  currentTune: number | null,
): Promise<ITableStateTable> {
  console.log(
    `LF6: createOrUpdateTableState: purpose=${purpose} playlistId=${playlistId}, currentTune=${currentTune}, rowSelection: ${JSON.stringify(tableStates.rowSelection)}`,
  );
  return tableStateMutex.runExclusive(async () => {
    try {
      console.log(
        `=> createOrUpdateTableState: purpose=${purpose}, currentTune=${currentTune})}`,
      );
      if (userId <= 0) {
        throw new Error("createOrUpdateTableState: userId is invalid");
      }
      if (playlistId <= 0) {
        throw new Error("createOrUpdateTableState: playlistId is invalid");
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
      console.log(
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
      console.log(
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
  console.log(
    `LF6: updateTableStateInDb: purpose=${purpose} playlistId=${playlistId}, rowSelection: ${JSON.stringify(tableStates.rowSelection)}`,
  );
  return tableStateMutex.runExclusive(async () => {
    if (playlistId <= 0 || playlistId === undefined) {
      console.error("updateTableStateInDb: playlistId is invalid");
      throw new Error("updateTableStateInDb: playlistId is invalid");
    }

    try {
      console.log(
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
        { timeout: 10_000 }, // Increase timeout to 10 seconds
      );
      console.log(
        `=> updateTableStateInDb: response.status=${response.status} purpose=${purpose}, playlistId=${playlistId})}`,
      );
      return response.status;
    } catch (error) {
      console.error("<= updateTableStateInDb: ", error);
      return 500;
    }
  });
}

export async function updateCurrentTuneInDb(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  playlistId: number,
  currentTune: number | null,
): Promise<number> {
  console.log(
    `LF6: updateCurrentTuneInDb: purpose=${purpose} playlistId=${playlistId}, currentTune=${currentTune}`,
  );
  return tableStateMutex.runExclusive(async () => {
    const tableStateTable: Partial<ITableStateTable> = {
      current_tune: currentTune === null ? -1 : currentTune,
    };
    try {
      console.log(
        `=> updateCurrentTuneInDb: purpose=${purpose}, currentTune=${currentTune})}`,
      );
      const response = await client.patch<Partial<ITableStateTable>>(
        `/table_state/${userId}/${playlistId}/${screenSize}/${purpose}`,
        tableStateTable,
      );
      console.log(
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
  console.log(
    `LF6: getTableStateTable: purpose=${purpose} playlistId=${playlistId}`,
  );
  if (playlistId <= 0 || playlistId === undefined) {
    console.error("getTableStateTable: playlistId is invalid");
    throw new Error("getTableStateTable: playlistId is invalid");
  }

  return tableStateMutex.runExclusive(async () => {
    try {
      console.log(`=> getTableStateTable: purpose=${purpose}`);
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
      console.log(
        `LF6: getTableStateTable: purpose=${purpose} playlistId=${playlistId}, currentTune=${tableStateTable.current_tune} rowSelection: ${JSON.stringify(tableSettings.rowSelection)}`,
      );
      console.log("=> getTableStateTable response status: ", response.status);
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
    console.log("deleteTableState: ", response?.status);
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
      if (response.data.tab_spec !== null) {
        response.data.tab_spec = JSON.parse(
          response.data.tab_spec as string,
        ) as ITabSpec[];
      }
      return response.data as ITabGroupMainStateModel;
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
