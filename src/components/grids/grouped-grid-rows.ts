import type { ITuneOverview } from "./types";

export interface ITuneSetGridSourceItem {
  tuneRef: string;
  position: number;
}

export interface ITuneSetGridSource {
  id: string;
  name: string;
  description?: string | null;
  items: ITuneSetGridSourceItem[];
}

export interface IMixedTuneGridRow extends ITuneOverview {
  rowId: string;
  rowKind: "tune" | "tune_set";
  subRows?: IMixedTuneGridRow[];
  tuneSetRef?: string;
}

export interface IMixedTuneGridRowsResult {
  rows: IMixedTuneGridRow[];
  autoExpandedRowIds: string[];
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function matchesTuneQuery(tune: ITuneOverview, query: string): boolean {
  if (!query) return true;
  return [
    tune.title,
    tune.incipit,
    tune.structure,
    tune.composer,
    tune.artist,
  ].some((value) => normalize(value).includes(query));
}

function matchesTuneSetQuery(
  source: ITuneSetGridSource,
  query: string
): boolean {
  if (!query) return true;
  return [source.name, source.description].some((value) =>
    normalize(value).includes(query)
  );
}

function compareByTitle(
  left: { title: string | null },
  right: { title: string | null }
) {
  return normalize(left.title).localeCompare(normalize(right.title));
}

function createLeafRow(
  tune: ITuneOverview,
  rowId: string,
  tuneSetRef?: string
): IMixedTuneGridRow {
  return {
    ...tune,
    rowId,
    rowKind: "tune",
    tuneSetRef,
  };
}

function createTuneSetRow(
  source: ITuneSetGridSource,
  seedTune: ITuneOverview,
  subRows: IMixedTuneGridRow[]
): IMixedTuneGridRow {
  return {
    ...seedTune,
    id: source.id,
    title: source.name,
    type: "Tune Set",
    structure: null,
    mode: null,
    incipit: null,
    genre: null,
    composer: null,
    artist: null,
    id_foreign: null,
    primary_origin: null,
    release_year: null,
    private_for: null,
    learned: null,
    scheduled: null,
    latest_state: null,
    latest_practiced: null,
    latest_quality: null,
    latest_easiness: null,
    latest_difficulty: null,
    latest_stability: null,
    latest_interval: null,
    latest_step: null,
    latest_repetitions: null,
    latest_due: null,
    latest_backup_practiced: null,
    latest_goal: null,
    latest_technique: null,
    goal: null,
    purpose: source.description ?? null,
    note_private: null,
    note_public: null,
    recall_eval: null,
    tags: null,
    notes: null,
    favorite_url: null,
    has_override: 0,
    has_staged: 0,
    rowId: `set-${source.id}`,
    rowKind: "tune_set",
    subRows,
    tuneSetRef: source.id,
  };
}

export function buildMixedTuneGridRows(
  tunes: ITuneOverview[],
  tuneSets: ITuneSetGridSource[],
  options?: {
    searchQuery?: string;
  }
): IMixedTuneGridRowsResult {
  const query = normalize(options?.searchQuery);
  const tuneById = new Map(tunes.map((tune) => [tune.id, tune]));
  const groupedTuneIds = new Set<string>();
  const autoExpandedRowIds: string[] = [];
  const setRows: IMixedTuneGridRow[] = [];

  for (const source of tuneSets) {
    const sourceTunes = source.items
      .map((item) => {
        const tune = tuneById.get(item.tuneRef);
        return tune ? { item, tune } : null;
      })
      .filter(
        (
          entry
        ): entry is { item: ITuneSetGridSourceItem; tune: ITuneOverview } =>
          entry !== null
      );

    if (sourceTunes.length === 0) continue;

    const setMatches = matchesTuneSetQuery(source, query);
    const visibleEntries = query
      ? sourceTunes.filter(
          ({ tune }) => setMatches || matchesTuneQuery(tune, query)
        )
      : sourceTunes;

    if (visibleEntries.length === 0) continue;

    for (const { tune } of sourceTunes) {
      groupedTuneIds.add(tune.id);
    }

    const sorted = [...visibleEntries].sort(
      (left, right) => left.item.position - right.item.position
    );
    const subRows = sorted.map(({ tune }) => {
      return createLeafRow(tune, `set-${source.id}-tune-${tune.id}`, source.id);
    });

    const parentRow = createTuneSetRow(source, visibleEntries[0].tune, subRows);
    setRows.push(parentRow);

    if (query) {
      autoExpandedRowIds.push(parentRow.rowId);
    }
  }

  const standaloneRows = tunes
    .filter((tune) => !groupedTuneIds.has(tune.id))
    .filter((tune) => !query || matchesTuneQuery(tune, query))
    .map((tune) => createLeafRow(tune, `tune-${tune.id}`));

  return {
    rows: [...standaloneRows, ...setRows].sort(compareByTitle),
    autoExpandedRowIds,
  };
}

export function getMixedTuneGridRowId(row: IMixedTuneGridRow): string {
  return row.rowId;
}

export function getMixedTuneGridSubRows(
  row: IMixedTuneGridRow
): IMixedTuneGridRow[] | undefined {
  return row.subRows;
}

export function canSelectMixedTuneGridRow(row: IMixedTuneGridRow): boolean {
  return row.rowKind === "tune";
}

export function isTuneSetGridRow(row: IMixedTuneGridRow): boolean {
  return row.rowKind === "tune_set";
}
