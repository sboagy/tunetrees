import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type IStackedListRow,
  TuneStackedList,
} from "../../../src/components/grids/TuneStackedList";
import type { TablePurpose } from "../../../src/components/grids/types";

vi.mock("../../../src/components/grids/RecallEvalComboBox", () => ({
  RecallEvalComboBox: (props: { value?: string }) => (
    <div>{`Evaluation control: ${props.value ?? "(empty)"}`}</div>
  ),
}));

type ColumnCase = {
  columnId: string;
  matcher: RegExp;
};

const baseRow: IStackedListRow = {
  id: "catalog-row-1",
  tune_id: "tune-row-1",
  title: "Stacked Tune Title",
  type: "Slip Jig",
  mode: "D Mixolydian",
  structure: "AABBCC",
  incipit: "E2BE dBAG",
  genre: "Irish Traditional",
  composer: "Turlough O'Carolan",
  artist: "The Bothy Band",
  release_year: 1975,
  id_foreign: "itune-1234",
  private_for: "user-1",
  bucket: "Lapsed",
  recall_eval: "good",
  learned: "2026-04-01T00:00:00Z",
  latest_practiced: "2026-04-02T00:00:00Z",
  latest_quality: 4,
  latest_easiness: 2.35,
  latest_stability: 8.1,
  latest_interval: 12,
  latest_due: "2026-04-10T00:00:00Z",
  latest_state: 2,
  goal: "perform",
  scheduled: "2026-04-09T00:00:00Z",
  tags: "session,favorite",
  purpose: "warm-up",
  note_private: "Focus on bowing",
  note_public: "Common session tune",
  has_override: 1,
  has_staged: 1,
};

const commonCases: ColumnCase[] = [
  { columnId: "title", matcher: /Stacked Tune Title/ },
  { columnId: "id", matcher: /catalog-row-1/ },
  { columnId: "type", matcher: /Slip Jig/ },
  { columnId: "mode", matcher: /D Mixolydian/ },
  { columnId: "structure", matcher: /AABBCC/ },
  { columnId: "incipit", matcher: /E2BE dBAG/ },
  { columnId: "genre", matcher: /Irish Traditional/ },
  { columnId: "composer", matcher: /Turlough O'Carolan/ },
  { columnId: "artist", matcher: /The Bothy Band/ },
  { columnId: "release_year", matcher: /1975/ },
  { columnId: "id_foreign", matcher: /itune-1234/ },
  { columnId: "private_for", matcher: /Ownership:/ },
];

const repertoireOnlyCases: ColumnCase[] = [
  { columnId: "latest_state", matcher: /^Review$/ },
  { columnId: "learned", matcher: /Learned:/ },
  { columnId: "goal", matcher: /Goal:/ },
  { columnId: "scheduled", matcher: /Scheduled:/ },
  { columnId: "latest_due", matcher: /Due:/ },
  { columnId: "latest_practiced", matcher: /Practiced:/ },
  { columnId: "recall_eval", matcher: /Recall Eval:/ },
  { columnId: "latest_quality", matcher: /Quality:/ },
  { columnId: "latest_easiness", matcher: /Easiness:/ },
  { columnId: "latest_stability", matcher: /Stability:/ },
  { columnId: "latest_interval", matcher: /Interval:/ },
  { columnId: "tags", matcher: /Tags:/ },
  { columnId: "purpose", matcher: /Purpose:/ },
  { columnId: "note_private", matcher: /Private Note:/ },
  { columnId: "note_public", matcher: /Public Note:/ },
  { columnId: "has_override", matcher: /^Override$/ },
  { columnId: "has_staged", matcher: /^Staged$/ },
];

const scheduledOnlyCases: ColumnCase[] = [
  { columnId: "bucket", matcher: /^Lapsed$/ },
  { columnId: "evaluation", matcher: /Evaluation control: good/ },
];

const catalogColumns = commonCases.map(({ columnId }) => columnId);
const repertoireColumns = [
  ...catalogColumns,
  ...repertoireOnlyCases.map(({ columnId }) => columnId),
];
const scheduledColumns = [
  ...repertoireColumns,
  ...scheduledOnlyCases.map(({ columnId }) => columnId),
];

afterEach(() => {
  cleanup();
});

function buildVisibility(
  columnIds: string[],
  defaultVisible: boolean,
  overrides: Record<string, boolean>
): Record<string, boolean> {
  return columnIds.reduce<Record<string, boolean>>((visibility, columnId) => {
    visibility[columnId] = overrides[columnId] ?? defaultVisible;
    return visibility;
  }, {});
}

function renderStackedList(
  tablePurpose: TablePurpose,
  columnIds: string[],
  visibility: Record<string, boolean>
) {
  return render(() => (
    <TuneStackedList
      data={[baseRow]}
      tablePurpose={tablePurpose}
      columnVisibility={buildVisibility(columnIds, false, visibility)}
    />
  ));
}

function assertColumnControlsContent(
  tablePurpose: TablePurpose,
  columnIds: string[],
  testCase: ColumnCase
) {
  const visibleRender = renderStackedList(tablePurpose, columnIds, {
    [testCase.columnId]: true,
  });

  expect(screen.getByText(testCase.matcher)).toBeDefined();

  visibleRender.unmount();

  render(() => (
    <TuneStackedList
      data={[baseRow]}
      tablePurpose={tablePurpose}
      columnVisibility={buildVisibility(columnIds, true, {
        [testCase.columnId]: false,
      })}
    />
  ));

  expect(screen.queryByText(testCase.matcher)).toBeNull();
}

describe("TuneStackedList column visibility", () => {
  describe("catalog", () => {
    for (const testCase of commonCases) {
      it(`maps ${testCase.columnId} to mobile stacked-list content`, () => {
        assertColumnControlsContent("catalog", catalogColumns, testCase);
      });
    }
  });

  describe("repertoire", () => {
    for (const testCase of [...commonCases, ...repertoireOnlyCases]) {
      it(`maps ${testCase.columnId} to mobile stacked-list content`, () => {
        assertColumnControlsContent("repertoire", repertoireColumns, testCase);
      });
    }
  });

  describe("scheduled", () => {
    for (const testCase of [
      ...commonCases,
      ...repertoireOnlyCases,
      ...scheduledOnlyCases,
    ]) {
      it(`maps ${testCase.columnId} to mobile stacked-list content`, () => {
        assertColumnControlsContent("scheduled", scheduledColumns, testCase);
      });
    }
  });
});
