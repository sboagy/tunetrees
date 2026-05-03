export function filterRowsBySelectedTuneIds<T extends { id: string }>(
  rows: T[],
  selectedTuneIds?: string[]
): T[] {
  if (selectedTuneIds === undefined) {
    return rows;
  }

  const allowedIds = new Set(selectedTuneIds);
  return rows.filter((row) => allowedIds.has(row.id));
}
