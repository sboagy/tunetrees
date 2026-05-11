import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { createSignal, type Setter } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type IStackedListRow,
  TuneStackedList,
} from "../../../src/components/grids/TuneStackedList";
import type {
  ICellEditorCallbacks,
  TablePurpose,
} from "../../../src/components/grids/types";

vi.mock("../../../src/components/grids/GoalBadge", () => ({
  GoalBadge: (props: {
    value: string;
    goals?: () => Array<{ id: string; name: string }>;
    onGoalChange?: (newGoal: string) => void;
  }) => (
    <button type="button" onClick={() => props.onGoalChange?.("session_ready")}>
      {`Goal control: ${props.value}`}
    </button>
  ),
}));

vi.mock("../../../src/components/grids/RecallEvalComboBox", () => ({
  RecallEvalComboBox: (props: { value?: string }) => (
    <div>{`Evaluation control: ${props.value ?? "(empty)"}`}</div>
  ),
}));

vi.mock("../../../src/components/grids/ScheduledOverridePicker", () => ({
  ScheduledOverridePicker: (props: {
    triggerLabel?: string;
    value?: string;
    onChange?: (newValue: string | null) => void;
  }) => (
    <button
      type="button"
      onClick={() => props.onChange?.("2026-04-12T15:30:00.000Z")}
    >
      {`Scheduled control: ${props.triggerLabel ?? props.value ?? "(empty)"}`}
    </button>
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
  { columnId: "goal", matcher: /Goal control: perform/ },
  { columnId: "scheduled", matcher: /Scheduled control:/ },
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
  visibility: Record<string, boolean>,
  cellCallbacks: ICellEditorCallbacks = {
    onGoalChange: vi.fn(),
    onScheduledChange: vi.fn(),
    goals: () => [{ id: "goal-1", name: "perform" }],
  }
) {
  return render(() => (
    <TuneStackedList
      data={[baseRow]}
      tablePurpose={tablePurpose}
      columnVisibility={buildVisibility(columnIds, false, visibility)}
      cellCallbacks={cellCallbacks}
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
      cellCallbacks={{
        onGoalChange: vi.fn(),
        onScheduledChange: vi.fn(),
        goals: () => [{ id: "goal-1", name: "perform" }],
      }}
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

  it("reacts to column visibility changes without remounting", async () => {
    let setVisibility!: Setter<Record<string, boolean>>;

    const Host = () => {
      const [visibility, updateVisibility] = createSignal(
        buildVisibility(repertoireColumns, true, {})
      );
      setVisibility = updateVisibility;

      return (
        <TuneStackedList
          data={[baseRow]}
          tablePurpose="repertoire"
          columnVisibility={visibility()}
          cellCallbacks={{
            onGoalChange: vi.fn(),
            onScheduledChange: vi.fn(),
            goals: () => [{ id: "goal-1", name: "perform" }],
          }}
        />
      );
    };

    render(() => <Host />);

    expect(screen.getByText(/Structure:/)).toBeDefined();
    expect(screen.getByText(/Due:/)).toBeDefined();

    setVisibility(
      buildVisibility(repertoireColumns, true, {
        structure: false,
        latest_due: false,
      })
    );

    await waitFor(() => {
      expect(screen.queryByText(/Structure:/)).toBeNull();
      expect(screen.queryByText(/Due:/)).toBeNull();
    });
  });

  it("renders row-selection checkboxes only when selection is enabled", () => {
    const withSelection = render(() => (
      <TuneStackedList
        data={[baseRow]}
        tablePurpose="catalog"
        enableRowSelection={true}
        selectedRowIds={{}}
        onRowSelectionChange={() => {}}
      />
    ));

    expect(
      screen.getByRole("checkbox", { name: "Select row catalog-row-1" })
    ).toBeDefined();

    withSelection.unmount();

    render(() => <TuneStackedList data={[baseRow]} tablePurpose="catalog" />);

    expect(
      screen.queryByRole("checkbox", { name: "Select row catalog-row-1" })
    ).toBeNull();
  });

  it("toggles row selection without firing the row click handler", async () => {
    const onRowClick = vi.fn();
    const onRowSelectionChange = vi.fn();

    const Host = () => {
      const [selectedRowIds, setSelectedRowIds] = createSignal<
        Record<string, boolean>
      >({});

      return (
        <TuneStackedList
          data={[baseRow]}
          tablePurpose="catalog"
          enableRowSelection={true}
          selectedRowIds={selectedRowIds()}
          onRowClick={onRowClick}
          onRowSelectionChange={(row, checked) => {
            onRowSelectionChange(row, checked);
            setSelectedRowIds(checked ? { [String(row.id)]: true } : {});
          }}
        />
      );
    };

    render(() => <Host />);

    const checkbox = screen.getByRole("checkbox", {
      name: "Select row catalog-row-1",
    });

    await fireEvent.click(checkbox);

    expect(onRowSelectionChange).toHaveBeenCalledWith(baseRow, true);
    expect(onRowClick).not.toHaveBeenCalled();
    await waitFor(() => {
      expect((checkbox as HTMLInputElement).checked).toBe(true);
    });
  });

  it("renders inline goal and scheduled controls in list mode", () => {
    render(() => (
      <TuneStackedList
        data={[baseRow]}
        tablePurpose="repertoire"
        columnVisibility={buildVisibility(repertoireColumns, false, {
          goal: true,
          scheduled: true,
        })}
        cellCallbacks={{
          onGoalChange: vi.fn(),
          onScheduledChange: vi.fn(),
          goals: () => [{ id: "goal-1", name: "perform" }],
        }}
      />
    ));

    expect(screen.getByText("Goal control: perform")).toBeDefined();
    expect(screen.getByText(/Scheduled control:/)).toBeDefined();
    expect(screen.queryByText(/Goal:/)).toBeNull();
    expect(screen.queryByText(/Scheduled:/)).toBeNull();
  });

  it("wires inline goal changes to the stacked-list row tune id", async () => {
    const onGoalChange = vi.fn();

    render(() => (
      <TuneStackedList
        data={[baseRow]}
        tablePurpose="repertoire"
        columnVisibility={buildVisibility(repertoireColumns, false, {
          goal: true,
        })}
        cellCallbacks={{
          onGoalChange,
          goals: () => [{ id: "goal-1", name: "perform" }],
        }}
      />
    ));

    await fireEvent.click(screen.getByText("Goal control: perform"));

    expect(onGoalChange).toHaveBeenCalledWith("tune-row-1", "session_ready");
  });

  it("wires inline scheduled changes to the stacked-list row tune id", async () => {
    const onScheduledChange = vi.fn();

    render(() => (
      <TuneStackedList
        data={[baseRow]}
        tablePurpose="repertoire"
        columnVisibility={buildVisibility(repertoireColumns, false, {
          scheduled: true,
        })}
        cellCallbacks={{
          onScheduledChange,
          goals: () => [{ id: "goal-1", name: "perform" }],
        }}
      />
    ));

    await fireEvent.click(screen.getByText(/Scheduled control:/));

    expect(onScheduledChange).toHaveBeenCalledWith(
      "tune-row-1",
      "2026-04-12T15:30:00.000Z"
    );
  });
});
