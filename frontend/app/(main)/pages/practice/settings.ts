"use server";

import type { TableState } from "@tanstack/react-table";
import axios, { isAxiosError } from "axios";
import type { ITabSpec } from "./components/TabsStateContext";
import type {
  ITableStateTable,
  ScreenSize,
  TablePurpose,
  TableTransientData,
  TableTransientDataFields,
} from "./types";

const client = axios.create({
  baseURL: `${process.env.NEXT_BASE_URL}/settings`,
  timeout: 2000, // Increase timeout to 2 seconds
});

// interface ColumnRecordModel {
//   userId: number;
//   screenSize: string;
//   purpose: string;
//   columnSettings: ColumnSettingsModel;
// }

export async function createOrUpdateTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  tableStates: TableState,
  currentTune: number | null,
): Promise<number> {
  try {
    console.log(
      `LF6 => createOrUpdateTableState: purpose=${purpose}, currentTune=${currentTune})}`,
    );
    // console.log(
    //   `=> createOrUpdateTableState rowSelection: ${JSON.stringify(tableStates.rowSelection)}`,
    // );
    const tableStatesStr = JSON.stringify(tableStates);
    const tableStateTable: ITableStateTable = {
      user_id: userId,
      screen_size: screenSize,
      purpose: purpose,
      settings: tableStatesStr,
      current_tune: currentTune === null ? -1 : currentTune,
    };
    const response = await client.post<ITableStateTable>(
      "/table_state",
      tableStateTable,
      {
        params: {
          user_id: userId,
          screen_size: screenSize,
          purpose: purpose,
        },
      },
    );
    // console.log("<= createOrUpdateTableState: ", response?.status);
    return response.status;
  } catch (error) {
    console.error("<= createOrUpdateTableState: ", error);
    return 500;
  }
}

export async function updateTableStateInDb(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  tableStates: TableState,
): Promise<number> {
  try {
    // console.log(
    //   `=> createOrUpdateTableState rowSelection: ${JSON.stringify(tableStates.rowSelection)}`,
    // );
    const tableStatesStr = JSON.stringify(tableStates);
    const tableStateTable: Partial<ITableStateTable> = {
      user_id: userId,
      screen_size: screenSize,
      purpose: purpose,
      settings: tableStatesStr,
    };
    const response = await client.put<Partial<ITableStateTable>>(
      "/table_state",
      tableStateTable,
      {
        params: {
          user_id: userId,
          screen_size: screenSize,
          purpose: purpose,
        },
      },
    );
    // console.log("<= createOrUpdateTableState: ", response?.status);
    return response.status;
  } catch (error) {
    console.error("<= createOrUpdateTableState: ", error);
    return 500;
  }
}

export async function updateCurrentTuneInDb(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  currentTune: number | null,
): Promise<number> {
  try {
    console.log(
      `LF6 => updateCurrentTuneInDb: purpose=${purpose}, currentTune=${currentTune})}`,
    );
    const tableStateTable: Partial<ITableStateTable> = {
      current_tune: currentTune === null ? -1 : currentTune,
    };
    const response = await client.put<Partial<ITableStateTable>>(
      "/table_state",
      tableStateTable,
      {
        params: {
          user_id: userId,
          screen_size: screenSize,
          purpose: purpose,
        },
      },
    );
    // console.log("<= createOrUpdateTableState: ", response?.status);
    return response.status;
  } catch (error) {
    console.error("<= createOrUpdateTableState: ", error);
    return 500;
  }
}

// export async function updateTableStateOnly(
//   userId: number,
//   screenSize: ScreenSize,
//   purpose: TablePurpose,
//   tableStates: TableState,
// ): Promise<number> {
//   try {
//     const tableStatesStr = JSON.stringify(tableStates);
//     const response = await client.put<ITableStateTable>(
//       "/table_state",
//       { settings: tableStatesStr },
//       {
//         params: {
//           user_id: userId,
//           screen_size: screenSize,
//           purpose: purpose,
//         },
//       },
//     );
//     console.log("updateTableState: ", response?.status);
//     return response.status;
//   } catch (error) {
//     console.error("updateTableState: ", error);
//     return 500;
//   }
// }

export async function getTableStateTable(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
): Promise<ITableStateTable | null> {
  try {
    const response = await client.get<ITableStateTable>("/table_state", {
      params: {
        user_id: userId,
        screen_size: screenSize,
        purpose: purpose,
      },
    });
    response.data.settings = JSON.parse(
      response.data.settings as string,
    ) as TableState;
    const tableStateTable: ITableStateTable = response.data;
    console.log("getTableStateTable response status: ", response.status);
    return tableStateTable;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null; // Return null for 404 status
    }
    console.error("getTableState error: ", error);
    throw error;
  }
}

export async function getTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
): Promise<TableState | null> {
  const tableStateTable = await getTableStateTable(userId, screenSize, purpose);
  return tableStateTable?.settings as TableState;
}

export async function getTableCurrentTune(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
): Promise<number> {
  const tableStateTable = await getTableStateTable(userId, screenSize, purpose);
  return tableStateTable?.current_tune ?? -1;
}

export async function deleteTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
): Promise<number> {
  try {
    const response = await client.delete("/table_state", {
      params: {
        user_id: userId,
        screen_size: screenSize,
        purpose: purpose,
      },
    });
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
    const transientData: TableTransientDataFields = {
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
): Promise<TableTransientData | null> {
  try {
    const response = await client.get(
      `/table_transient_data/${userId}/${tuneId}/${playlistId}/${purpose}`,
    );
    // Handle successful response
    const transientDataStr: string = response.data as string;
    // Not very confident about this reconstitution of TableTransientData
    const transientData: TableTransientData = JSON.parse(
      transientDataStr,
    ) as TableTransientData;
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
    const response = await client.delete(
      `/table_transient_data/${userId}/${tuneId}/${playlistId}/${purpose}`,
    );
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

export interface ITabGroupMainStateModel {
  user_id: number;
  id: number;
  which_tab: string;
  playlist_id?: number;
  tab_spec?: string | ITabSpec[];
}

export async function getTabGroupMainState(
  userId: number,
): Promise<ITabGroupMainStateModel | null> {
  try {
    const response = await client.get(`/tab_group_main_state/${userId}`);
    console.log("getTabGroupMainState response status: ", response.status);
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
}

export async function updateTabGroupMainState(
  userId: number,
  tabGroupMainState: Partial<ITabGroupMainStateModel>,
): Promise<number> {
  try {
    if (tabGroupMainState.tab_spec !== null) {
      tabGroupMainState.tab_spec = JSON.stringify(tabGroupMainState.tab_spec);
    }
    const response = await client.patch(
      `/tab_group_main_state/${userId}`,
      tabGroupMainState,
    );
    console.log("updateTabGroupMainState response status: ", response.status);
    return response.status;
  } catch (error) {
    console.error("updateTabGroupMainState error: ", error);
    return 500;
  }
}

export async function createTabGroupMainState(
  userId: number,
  tabGroupMainState: ITabGroupMainStateModel,
): Promise<number> {
  try {
    if (tabGroupMainState.tab_spec !== null) {
      tabGroupMainState.tab_spec = JSON.stringify(tabGroupMainState.tab_spec);
    }
    const response = await client.post(
      `/tab_group_main_state/${userId}`,
      tabGroupMainState,
    );
    console.log("createTabGroupMainState response status: ", response.status);
    return response.status;
  } catch (error) {
    console.error("createTabGroupMainState error: ", error);
    return 500;
  }
}

export async function deleteTabGroupMainState(userId: number): Promise<number> {
  try {
    const response = await client.delete(`/tab_group_main_state/${userId}`);
    console.log("deleteTabGroupMainState response status: ", response.status);
    return response.status;
  } catch (error) {
    console.error("deleteTabGroupMainState error: ", error);
    return 500;
  }
}
