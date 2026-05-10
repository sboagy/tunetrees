import type {
  SetlistItemKind,
  SetlistItemWithSummary,
} from "@/lib/db/queries/setlists";
import type { Tune, TuneSet, TuneSetItemWithTune } from "@/lib/db/types";

export interface ISetlistGridRow {
  id: string;
  rowId: string;
  rowKind: "tune" | "tune_set";
  itemKind: SetlistItemKind;
  title: string;
  type: string | null;
  mode: string | null;
  details: string | null;
  structure?: string | null;
  incipit?: string | null;
  genre?: string | null;
  composer?: string | null;
  artist?: string | null;
  releaseYear?: number | null;
  idForeign?: string | null;
  privateFor?: string | null;
  favoriteUrl?: string | null;
  primaryOrigin?: string | null;
  setlistPosition: number | null;
  setlistItemId: string | null;
  sourceId: string;
  tuneSetRef?: string;
  subRows?: ISetlistGridRow[];
}

export interface ISetlistGridRowsResult {
  rows: ISetlistGridRow[];
  autoExpandedRowIds: string[];
}

type TuneSetMembersById = Readonly<Record<string, TuneSetItemWithTune[]>>;

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function compareByTitle(
  left: { title: string | null },
  right: { title: string | null }
): number {
  return normalize(left.title).localeCompare(normalize(right.title));
}

function compareByName(
  left: { name: string | null },
  right: { name: string | null }
): number {
  return normalize(left.name).localeCompare(normalize(right.name));
}

function buildTuneDetails(tune: Pick<Tune, "structure" | "incipit">): string {
  return [tune.structure, tune.incipit].filter(Boolean).join(" | ") || "Tune";
}

function buildTuneSetDetails(
  tuneSet: Pick<TuneSet, "description">,
  tuneCount: number
): string {
  const countLabel = `${tuneCount} tune${tuneCount === 1 ? "" : "s"}`;
  return tuneSet.description
    ? `${countLabel} • ${tuneSet.description}`
    : countLabel;
}

function createTuneRow(
  tune: Tune,
  options: {
    rowId: string;
    setlistPosition?: number | null;
    setlistItemId?: string | null;
    tuneSetRef?: string;
  }
): ISetlistGridRow {
  return {
    id: tune.id,
    rowId: options.rowId,
    rowKind: "tune",
    itemKind: "tune",
    title: tune.title ?? "Untitled Tune",
    type: tune.type,
    mode: tune.mode,
    details: buildTuneDetails(tune),
    structure: tune.structure,
    incipit: tune.incipit,
    genre: (tune as Tune & { genre?: string | null }).genre ?? null,
    composer: (tune as Tune & { composer?: string | null }).composer ?? null,
    artist: (tune as Tune & { artist?: string | null }).artist ?? null,
    releaseYear:
      (tune as Tune & { releaseYear?: number | null }).releaseYear ?? null,
    idForeign: (tune as Tune & { idForeign?: string | null }).idForeign ?? null,
    privateFor:
      (tune as Tune & { privateFor?: string | null }).privateFor ?? null,
    favoriteUrl:
      (tune as Tune & { favoriteUrl?: string | null }).favoriteUrl ?? null,
    primaryOrigin:
      (tune as Tune & { primaryOrigin?: string | null }).primaryOrigin ?? null,
    setlistPosition: options.setlistPosition ?? null,
    setlistItemId: options.setlistItemId ?? null,
    sourceId: tune.id,
    tuneSetRef: options.tuneSetRef,
  };
}

function createTuneSetRow(
  tuneSet: TuneSet,
  subRows: ISetlistGridRow[],
  options: {
    rowId: string;
    setlistPosition?: number | null;
    setlistItemId?: string | null;
    tuneCount: number;
  }
): ISetlistGridRow {
  return {
    id: tuneSet.id,
    rowId: options.rowId,
    rowKind: "tune_set",
    itemKind: "tune_set",
    title: tuneSet.name,
    type: "Tune Set",
    mode: null,
    details: buildTuneSetDetails(tuneSet, options.tuneCount),
    structure: null,
    incipit: null,
    genre: null,
    composer: null,
    artist: null,
    releaseYear: null,
    idForeign: null,
    privateFor: null,
    favoriteUrl: null,
    primaryOrigin: null,
    setlistPosition: options.setlistPosition ?? null,
    setlistItemId: options.setlistItemId ?? null,
    sourceId: tuneSet.id,
    tuneSetRef: tuneSet.id,
    subRows,
  };
}

function matchesTuneQuery(tune: Tune, query: string): boolean {
  if (!query) return true;
  return [
    tune.title,
    tune.type,
    tune.mode,
    tune.structure,
    tune.incipit,
    (tune as Tune & { genre?: string | null }).genre,
    (tune as Tune & { composer?: string | null }).composer,
    (tune as Tune & { artist?: string | null }).artist,
    String((tune as Tune & { releaseYear?: number | null }).releaseYear ?? ""),
  ].some((value) => normalize(value).includes(query));
}

function matchesTuneSetQuery(tuneSet: TuneSet, query: string): boolean {
  if (!query) return true;
  return [tuneSet.name, tuneSet.description].some((value) =>
    normalize(value).includes(query)
  );
}

export function buildSetlistGridRows(
  items: SetlistItemWithSummary[],
  tuneSetMembersById: TuneSetMembersById
): ISetlistGridRowsResult {
  const rows: ISetlistGridRow[] = [];
  const autoExpandedRowIds: string[] = [];

  for (const [index, item] of items.entries()) {
    const setlistPosition = index + 1;

    if (item.itemKind === "tune" && item.tune) {
      rows.push(
        createTuneRow(item.tune, {
          rowId: `setlist-item-${item.id}`,
          setlistPosition,
          setlistItemId: item.id,
        })
      );
      continue;
    }

    if (item.itemKind !== "tune_set" || !item.tuneSet) continue;

    const members = tuneSetMembersById[item.tuneSet.id] ?? [];
    const subRows = members.map((member) =>
      createTuneRow(member.tune, {
        rowId: `setlist-item-${item.id}-tune-${member.tune.id}`,
        tuneSetRef: item.tuneSet?.id,
      })
    );
    const parentRow = createTuneSetRow(item.tuneSet, subRows, {
      rowId: `setlist-item-${item.id}`,
      setlistPosition,
      setlistItemId: item.id,
      tuneCount: item.tuneSetTuneCount,
    });
    rows.push(parentRow);
    autoExpandedRowIds.push(parentRow.rowId);
  }

  return { rows, autoExpandedRowIds };
}

export function buildSetlistLibraryGridRows(
  tunes: Tune[],
  tuneSets: TuneSet[],
  tuneSetMembersById: TuneSetMembersById,
  options?: {
    filter?: "all" | SetlistItemKind;
    searchQuery?: string;
  }
): ISetlistGridRowsResult {
  const filter = options?.filter ?? "all";
  const query = normalize(options?.searchQuery);
  const groupedTuneIds = new Set<string>();
  const autoExpandedRowIds: string[] = [];
  const setRows: ISetlistGridRow[] = [];

  if (filter !== "tune") {
    for (const tuneSet of [...tuneSets].sort(compareByName)) {
      const members = tuneSetMembersById[tuneSet.id] ?? [];
      const setMatches = matchesTuneSetQuery(tuneSet, query);
      const visibleMembers = query
        ? members.filter(
            (member) => setMatches || matchesTuneQuery(member.tune, query)
          )
        : members;

      if (visibleMembers.length === 0) continue;

      for (const member of members) {
        groupedTuneIds.add(member.tune.id);
      }

      const subRows = visibleMembers.map((member) =>
        createTuneRow(member.tune, {
          rowId: `library-set-${tuneSet.id}-tune-${member.tune.id}`,
          tuneSetRef: tuneSet.id,
        })
      );
      const parentRow = createTuneSetRow(tuneSet, subRows, {
        rowId: `library-set-${tuneSet.id}`,
        tuneCount: members.length,
      });
      setRows.push(parentRow);
      if (query) {
        autoExpandedRowIds.push(parentRow.rowId);
      }
    }
  }

  const standaloneRows =
    filter === "tune_set"
      ? []
      : tunes
          .filter((tune) => {
            if (filter === "all" && groupedTuneIds.has(tune.id)) {
              return false;
            }
            return !query || matchesTuneQuery(tune, query);
          })
          .map((tune) =>
            createTuneRow(tune, {
              rowId: `library-tune-${tune.id}`,
            })
          )
          .sort(compareByTitle);

  return {
    rows: [...standaloneRows, ...setRows].sort(compareByTitle),
    autoExpandedRowIds,
  };
}

export function getSetlistGridRowId(row: ISetlistGridRow): string {
  return row.rowId;
}

export function getSetlistGridSubRows(
  row: ISetlistGridRow
): ISetlistGridRow[] | undefined {
  return row.subRows;
}
