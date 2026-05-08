import { describe, expect, it } from "vitest";
import {
  buildSetlistGridRows,
  buildSetlistLibraryGridRows,
} from "../../../src/components/grids/setlist-grid-rows";
import type { SetlistItemWithSummary } from "../../../src/lib/db/queries/setlists";
import type {
  Tune,
  TuneSet,
  TuneSetItemWithTune,
} from "../../../src/lib/db/types";

function createTune(
  id: string,
  title: string,
  overrides?: Partial<Tune>
): Tune {
  return {
    id,
    title,
    type: "Reel",
    structure: "AABB",
    mode: "D Major",
    incipit: "ABcd efga",
    genre: null,
    composer: null,
    artist: null,
    idForeign: null,
    primaryOrigin: null,
    releaseYear: null,
    privateFor: null,
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: "2026-05-08T00:00:00.000Z",
    deviceId: "local",
    createdAt: "2026-05-08T00:00:00.000Z",
    abc: null,
    abcCanonical: null,
    melodyStats: null,
    nameWithPrefix: null,
    ...overrides,
  } as Tune;
}

function createTuneSet(
  id: string,
  name: string,
  overrides?: Partial<TuneSet>
): TuneSet {
  return {
    id,
    name,
    description: null,
    ownerUserRef: "user-1",
    groupRef: null,
    setKind: "practice_set",
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: "2026-05-08T00:00:00.000Z",
    deviceId: "local",
    createdAt: "2026-05-08T00:00:00.000Z",
    ...overrides,
  } as TuneSet;
}

function createTuneSetMember(
  id: string,
  tuneSetRef: string,
  tune: Tune,
  position: number
): TuneSetItemWithTune {
  return {
    id,
    tuneSetRef,
    tuneRef: tune.id,
    position,
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: "2026-05-08T00:00:00.000Z",
    deviceId: "local",
    createdAt: "2026-05-08T00:00:00.000Z",
    tune,
  } as TuneSetItemWithTune;
}

function createSetlistItem(
  id: string,
  position: number,
  options: {
    tune?: Tune;
    tuneSet?: TuneSet;
    tuneSetTuneCount?: number;
  }
): SetlistItemWithSummary {
  return {
    id,
    setlistRef: "setlist-1",
    tuneRef: options.tune?.id ?? null,
    tuneSetRef: options.tuneSet?.id ?? null,
    itemKind: options.tune ? "tune" : "tune_set",
    position,
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: "2026-05-08T00:00:00.000Z",
    deviceId: "local",
    createdAt: "2026-05-08T00:00:00.000Z",
    tune: options.tune ?? null,
    tuneSet: options.tuneSet ?? null,
    tuneSetTuneCount: options.tuneSetTuneCount ?? 0,
  } as SetlistItemWithSummary;
}

describe("setlist-grid-rows", () => {
  it("preserves setlist item order and expands tune sets into child tune rows", () => {
    const tuneA = createTune("tune-a", "Alexander's");
    const tuneB = createTune("tune-b", "Bucks of Oranmore");
    const tuneC = createTune("tune-c", "Catharsis");
    const tuneSet = createTuneSet("set-1", "Opening Set", {
      description: "Festival opener",
    });

    const result = buildSetlistGridRows(
      [
        createSetlistItem("item-1", 0, { tune: tuneA }),
        createSetlistItem("item-2", 1, {
          tuneSet,
          tuneSetTuneCount: 2,
        }),
      ],
      {
        [tuneSet.id]: [
          createTuneSetMember("member-1", tuneSet.id, tuneB, 0),
          createTuneSetMember("member-2", tuneSet.id, tuneC, 1),
        ],
      }
    );

    expect(result.rows.map((row) => row.title)).toEqual([
      "Alexander's",
      "Opening Set",
    ]);
    expect(result.rows.map((row) => row.setlistPosition)).toEqual([1, 2]);
    expect(result.rows[1]?.subRows?.map((row) => row.title)).toEqual([
      "Bucks of Oranmore",
      "Catharsis",
    ]);
    expect(result.autoExpandedRowIds).toEqual(["setlist-item-item-2"]);
  });

  it("hides grouped tunes from standalone rows in the library all filter", () => {
    const groupedTune = createTune("tune-a", "A Tune Inside a Set");
    const standaloneTune = createTune("tune-b", "Standalone Tune");
    const tuneSet = createTuneSet("set-1", "Session Set");

    const result = buildSetlistLibraryGridRows(
      [groupedTune, standaloneTune],
      [tuneSet],
      {
        [tuneSet.id]: [
          createTuneSetMember("member-1", tuneSet.id, groupedTune, 0),
        ],
      },
      { filter: "all" }
    );

    expect(result.rows.map((row) => row.title)).toEqual([
      "Session Set",
      "Standalone Tune",
    ]);
  });

  it("auto-expands matching tune sets when a child tune matches the search query", () => {
    const matchingTune = createTune("tune-a", "Silver Spear");
    const nonMatchingTune = createTune("tune-b", "Maid Behind the Bar");
    const tuneSet = createTuneSet("set-1", "Session Set");

    const result = buildSetlistLibraryGridRows(
      [matchingTune, nonMatchingTune],
      [tuneSet],
      {
        [tuneSet.id]: [
          createTuneSetMember("member-1", tuneSet.id, matchingTune, 0),
        ],
      },
      { filter: "all", searchQuery: "silver" }
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.title).toBe("Session Set");
    expect(result.rows[0]?.subRows?.map((row) => row.title)).toEqual([
      "Silver Spear",
    ]);
    expect(result.autoExpandedRowIds).toEqual(["library-set-set-1"]);
  });
});
