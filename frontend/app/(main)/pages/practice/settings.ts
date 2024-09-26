"use server";

import axios, { isAxiosError } from "axios";
import type {
  ScreenSize,
  TablePurpose,
  TableTransientData,
  TableTransientDataFields,
} from "./types";
import type { TableState } from "@tanstack/react-table";

const client = axios.create({
  baseURL: `${process.env.NEXT_BASE_URL}/settings`,
});

// interface ColumnRecordModel {
//   userId: number;
//   screenSize: string;
//   purpose: string;
//   columnSettings: ColumnSettingsModel;
// }

// =====
export async function createOrUpdateTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  tableStates: TableState,
): Promise<number> {
  try {
    const tableStatesStr = JSON.stringify(tableStates);
    const response = await client.post(
      `/table_state/${userId}/${screenSize}/${purpose}`,
      tableStatesStr,
    );
    console.log("createOrUpdateTableState: ", response?.status);
    return response.status;
    // Handle successful response
  } catch (error) {
    // Handle error
    console.error("createOrUpdateTableState: ", error);
    return 500;
  }
}

export async function updateTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
  tableStates: TableState,
): Promise<number> {
  try {
    const tableStatesStr = JSON.stringify(tableStates);
    const response = await client.put(
      `/table_state/${userId}/${screenSize}/${purpose}`,
      tableStatesStr,
    );
    // Handle successful response
    console.log("createOrUpdateTableState: ", response?.status);
    return response.status;
  } catch (error) {
    // Handle error
    console.error("updateTableState: ", error);
    return 500;
  }
}

export async function getTableState(
  userId: number,
  screenSize: ScreenSize,
  purpose: TablePurpose,
): Promise<TableState | null> {
  try {
    const response = await client.get(
      `/table_state/${userId}/${screenSize}/${purpose}`,
    );
    // Handle successful response
    const tableStatesStr: string = response.data as string;
    // Not very confident about this reconstitution of TableState
    const tableStates: TableState = JSON.parse(tableStatesStr) as TableState;
    console.error("getTableState response status: ", response.status);
    return tableStates;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null; // Return null for 404 status
    }
    // Handle error
    console.error("getTableState error: ", error);
    throw error;
  }
}

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
      notes_private: notesPrivate,
      notes_public: notesPublic,
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
