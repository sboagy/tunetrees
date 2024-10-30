/**
 * @file This file contains utility functions for creating mock data and contexts for a Tune table.
 * It turns out I didn't need these functions for what I originally intended them for, but they may
 * turn out to be useful in the future for various purposes, including testing.
 */

/**
 * Generates a mock Tune object with predefined data.
 *
 * @returns {Tune} A mock Tune object with sample data.
 */

/**
 * Creates a mock CellContext for a Tune table.
 *
 * @template TCellValue - The type of the cell value, which can be a string, number, Date, or undefined.
 * @param {number} userId - The ID of the user.
 * @param {number} playlistId - The ID of the playlist.
 * @param {TablePurpose} purpose - The purpose of the table.
 * @param {keyof Tune} [columnId="recall_eval"] - The ID of the column to target. Defaults to "recall_eval".
 * @param {Tune} [mockTune] - An optional mock Tune object. If not provided, a default mock Tune will be used.
 * @returns {CellContext<Tune, TCellValue>} The context of the targeted cell in the mock Tune table.
 * @throws Will throw an error if the cell with the specified column ID is not found.
 */
import type {
  ColumnDef,
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
import type { PlaylistTune, TablePurpose, Tune } from "./types";
import { get_columns } from "./components/TuneColumns";

export function getMockTune(): Tune {
  const tuneData: Tune = {
    id: 1,
    title: "Mock Tune",
    type: "Folk",
    structure: "AABB",
    mode: "Dorian",
    incipit: "incipit",
    learned: "2023-01-01",
    practiced: "2023-01-02",
    quality: 3,
    easiness: 5,
    interval: 3,
    repetitions: 10,
    review_date: "2023-01-03",
    backup_practiced: "2023-01-04",
    external_ref: "http://example.com",
    note_private: "Private notes",
    note_public: "Public notes",
    tags: "tag1, tag2",
    recall_eval: "High",
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
  columnId: keyof Tune = "recall_eval",
  mockTune?: Tune,
): CellContext<Tune, TCellValue> {
  const tuneData: Tune = mockTune ?? getMockTune();

  const mockTunes = [tuneData];

  const columns: ColumnDef<Tune>[] = get_columns(userId, playlistId, purpose);

  const table: TanstackTable<Tune> = useReactTable({
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

  return targetCell.getContext() as CellContext<Tune, TCellValue>;
}

export const ERROR_TUNE: Tune[] = [
  {
    id: 0,
    title: "Error",
    type: "Error",
    structure: "Error",
    mode: "Error",
    incipit: "Error",
    learned: "Error",
    practiced: "Error",
    quality: 0,
    easiness: 0,
    interval: 0,
    repetitions: 0,
    review_date: "Error",
    backup_practiced: "Error",
    note_private: "Error", // Optional property, should't need to be set
    note_public: "Error", // Optional property, should't need to be set
    tags: "Error", // Optional property, should't need to be set
    recall_eval: "Error", // Optional property, should't need to be set
  },
];

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ERROR_PLAYLIST_TUNE: PlaylistTune = {
  id: 0,
  title: "Error",
  type: "Error",
  structure: "Error",
  mode: "Error",
  incipit: "Error",
  learned: "Error",
  practiced: "Error",
  quality: 0,
  easiness: 0,
  interval: 0,
  repetitions: 0,
  review_date: "Error",
  backup_practiced: "Error",
  note_private: "Error", // Optional property, should't need to be set
  note_public: "Error", // Optional property, should't need to be set
  tags: "Error", // Optional property, should't need to be set
  user_ref: 0,
  playlist_ref: 0,
};
