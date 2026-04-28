import { describe, expect, it } from "vitest";
import type { TuneEditorData } from "../../../src/components/tunes";
import {
  buildBaseTuneUpdateInput,
  buildChangedTuneOverrideInput,
  buildRepertoireTuneUpdate,
  hasRepertoireTuneChanges,
} from "../../../src/routes/tunes/edit-tune-save";

function createTuneEditorData(
  overrides: Partial<TuneEditorData> = {}
): TuneEditorData {
  return {
    id: "tune-1",
    title: "The Silver Spear",
    type: "reel",
    structure: "AABB",
    mode: "Dmix",
    incipit: "ABcd",
    genre: "irish",
    composer: "Traditional",
    artist: "Session Players",
    idForeign: "123",
    releaseYear: 1998,
    privateFor: null,
    primaryOrigin: null,
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: "2026-04-20T10:00:00.000Z",
    deviceId: "local",
    ...overrides,
  };
}

describe("edit tune save helpers", () => {
  it("builds direct tune updates for all editable base fields", () => {
    expect(
      buildBaseTuneUpdateInput({
        title: "Updated Title",
        genre: "scottish",
        releaseYear: 2001,
      })
    ).toEqual({
      title: "Updated Title",
      type: undefined,
      mode: undefined,
      structure: undefined,
      incipit: undefined,
      genre: "scottish",
      composer: undefined,
      artist: undefined,
      idForeign: undefined,
      releaseYear: 2001,
    });
  });

  it("builds override input from only changed base fields", () => {
    expect(
      buildChangedTuneOverrideInput(
        {
          title: "Updated Title",
          artist: "",
          releaseYear: 2001,
        },
        createTuneEditorData({ artist: "Legacy Artist" })
      )
    ).toEqual({
      title: "Updated Title",
      artist: "",
      releaseYear: 2001,
    });
  });

  it("detects when repertoire-specific fields are present", () => {
    expect(hasRepertoireTuneChanges({ goal: "maintenance" })).toBe(true);
    expect(hasRepertoireTuneChanges({ title: "Updated Title" })).toBe(false);
  });

  it("normalizes cleared repertoire values to null", () => {
    expect(
      buildRepertoireTuneUpdate({
        learned: "",
        goal: "recall",
        scheduled: undefined,
      })
    ).toEqual({
      learned: null,
      goal: "recall",
      scheduled: null,
    });
  });
});
