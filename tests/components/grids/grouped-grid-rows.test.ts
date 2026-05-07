import { describe, expect, it } from "vitest";
import {
  buildMixedTuneGridRows,
  canSelectMixedTuneGridRow,
  getMixedTuneGridSubRows,
  isTuneSetGridRow,
} from "../../../src/components/grids/grouped-grid-rows";
import type { ITuneOverview } from "../../../src/components/grids/types";

function makeTune(id: string, title: string): ITuneOverview {
  return {
    id,
    title,
    type: null,
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
    deleted: 0,
    user_ref: "user-1",
    repertoire_id: "rep-1",
    instrument: null,
    learned: null,
    scheduled: null,
    repertoire_deleted: 0,
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
    purpose: null,
    note_private: null,
    note_public: null,
    recall_eval: null,
    tags: null,
    notes: null,
    favorite_url: null,
    has_override: 0,
    has_staged: 0,
  };
}

describe("buildMixedTuneGridRows", () => {
  it("wraps grouped tunes under tune set rows and leaves ungrouped tunes standalone", () => {
    const tunes = [
      makeTune("tune-1", "Alpha Jig"),
      makeTune("tune-2", "Bravo Reel"),
      makeTune("tune-3", "Charlie Hornpipe"),
    ];

    const result = buildMixedTuneGridRows(tunes, [
      {
        id: "set-1",
        name: "Morning Set",
        items: [
          { tuneRef: "tune-2", position: 1 },
          { tuneRef: "tune-1", position: 0 },
        ],
      },
    ]);

    expect(result.autoExpandedRowIds).toEqual([]);
    expect(result.rows.map((row) => row.title)).toEqual([
      "Charlie Hornpipe",
      "Morning Set",
    ]);

    const setRow = result.rows.find((row) => isTuneSetGridRow(row));
    expect(setRow).toBeDefined();
    expect(canSelectMixedTuneGridRow(setRow!)).toBe(false);
    expect(getMixedTuneGridSubRows(setRow!)?.map((row) => row.title)).toEqual([
      "Alpha Jig",
      "Bravo Reel",
    ]);
  });

  it("keeps matching tune sets visible and auto-expanded when search only matches child tunes", () => {
    const tunes = [
      makeTune("tune-1", "The Kesh Jig"),
      makeTune("tune-2", "Ballydesmond No. 1"),
      makeTune("tune-3", "Ballydesmond No. 2"),
    ];

    const result = buildMixedTuneGridRows(
      tunes,
      [
        {
          id: "set-42",
          name: "Ballydesmond Polkas",
          items: [
            { tuneRef: "tune-2", position: 0 },
            { tuneRef: "tune-3", position: 1 },
          ],
        },
      ],
      { searchQuery: "No. 2" }
    );

    expect(result.rows.map((row) => row.title)).toEqual([
      "Ballydesmond Polkas",
    ]);
    expect(result.autoExpandedRowIds).toEqual(["set-set-42"]);
    expect(
      getMixedTuneGridSubRows(result.rows[0])?.map((row) => row.rowId)
    ).toEqual(["set-set-42-tune-tune-3"]);
  });
});
