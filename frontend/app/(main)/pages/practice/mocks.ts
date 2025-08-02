/**
 * @file This file contains utility functions for creating mock data and contexts for a Tune table.
 * It turns out I didn't need these functions for what I originally intended them for, but they may
 * turn out to be useful in the future for various purposes, including testing.
 */

/**
 * Generates a mock Tune object with predefined data.
 *
 * @returns {ITuneOverview} A mock Tune object with sample data.
 */

/**
 * Creates a mock CellContext for a Tune table.
 *
 * @template TCellValue - The type of the cell value, which can be a string, number, Date, or undefined.
 * @param {number} userId - The ID of the user.
 * @param {number} playlistId - The ID of the playlist.
 * @param {TablePurpose} purpose - The purpose of the table.
 * @param {keyof ITuneOverview} [columnId="recall_eval"] - The ID of the column to target. Defaults to "recall_eval".
 * @param {ITuneOverview} [mockTune] - An optional mock Tune object. If not provided, a default mock Tune will be used.
 * @returns {CellContext<ITuneOverview, TCellValue>} The context of the targeted cell in the mock Tune table.
 * @throws Will throw an error if the cell with the specified column ID is not found.
 */
import type {
  CellContext,
  Table as TanstackTable,
} from "@tanstack/react-table";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { get_columns } from "./components/TuneColumns";
import type { ITuneOverview, TablePurpose } from "./types";

export function getMockTune(): ITuneOverview {
  const tuneData: ITuneOverview = {
    id: 1,
    title: "Mock Tune",
    type: "Folk",
    structure: "AABB",
    mode: "Dorian",
    incipit: "incipit",
    genre: "ITRAD",
    learned: "2023-01-01",
    latest_practiced: "2023-01-02",
    latest_quality: 3,
    latest_easiness: 5,
    latest_interval: 3,
    latest_repetitions: 10,
    latest_review_date: "2023-01-03",
    scheduled: "2023-01-05", // Current scheduling date
    latest_backup_practiced: "2023-01-04",
    external_ref: "http://example.com",
    tags: "tag1, tag2",
    recall_eval: "High",
    notes: "",
    private_for: null,
    latest_difficulty: 1,
    latest_step: 1,
  };
  return tuneData;
}

// Utility function to create a mock CellContext for a Tune table
// Utility function to create a mock CellContext for a Tune table
export function createMockTuneCellContext<
  TCellValue extends string | number | Date | undefined,
>(
  userId: number,
  playlistId: number,
  purpose: TablePurpose,
  columnId: keyof ITuneOverview = "recall_eval",
  mockTune?: ITuneOverview,
): CellContext<ITuneOverview, TCellValue> {
  const tuneData: ITuneOverview = mockTune ?? getMockTune();

  const mockTunes = [tuneData];

  const columns = get_columns(userId, playlistId, purpose);

  const table: TanstackTable<ITuneOverview> = useReactTable({
    data: mockTunes,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const firstRow = table.getRowModel().rows[0];

  const targetCell = firstRow
    .getAllCells()
    .find((cell) => cell.column.id === columnId);

  if (!targetCell) {
    throw new Error(
      `Cell with id "${columnId}" not found. Check your column definitions and mock data.`,
    );
  }

  return targetCell.getContext() as CellContext<ITuneOverview, TCellValue>;
}

export const ERROR_TUNE: ITuneOverview[] = [
  {
    id: 0,
    title: "Error",
    type: "Error",
    structure: "Error",
    mode: "Error",
    incipit: "Error",
    genre: "Error",
    learned: "Error",
    latest_practiced: "Error",
    latest_quality: 0,
    latest_easiness: 0,
    latest_interval: 0,
    latest_repetitions: 0,
    latest_review_date: "Error",
    scheduled: "Error", // Current scheduling date
    latest_backup_practiced: "Error",
    tags: "Error", // Optional property, should't need to be set
    recall_eval: "Error", // Optional property, should't need to be set
    notes: "",
    private_for: null,
    latest_difficulty: 0,
    latest_step: 0,
  },
];

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ERROR_PLAYLIST_TUNE: ITuneOverview = {
  id: 0,
  title: "Error",
  type: "Error",
  structure: "Error",
  mode: "Error",
  incipit: "Error",
  genre: "Error",
  learned: "Error",
  latest_practiced: "Error",
  latest_quality: 0,
  latest_easiness: 0,
  latest_interval: 0,
  latest_repetitions: 0,
  latest_review_date: "Error",
  scheduled: "Error", // Current scheduling date
  tags: "Error", // Optional property, should't need to be set
  user_ref: 0,
  playlist_ref: 0,
  notes: "",
  private_for: null,
  latest_difficulty: 0,
  latest_step: 0,
};
