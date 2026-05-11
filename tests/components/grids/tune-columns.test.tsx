import { cleanup, render } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRepertoireColumns } from "../../../src/components/grids/TuneColumns";
import type { ICellEditorCallbacks } from "../../../src/components/grids/types";

type MockScheduledOverridePickerProps = {
  tuneId: string;
  value: string;
  triggerLabel?: string;
  triggerTitle?: string;
  triggerTextClass?: string;
};

type ScheduledRow = {
  id: string;
  tune_id?: string | number | null;
  scheduled?: string | null;
  latest_due?: string | null;
  recall_eval?: string | null;
};

type ScheduledCellInfo = {
  getValue: () => string | null;
  row: {
    original: ScheduledRow;
    getValue: (columnId: string) => string | null;
  };
  cell: {
    row: {
      original: ScheduledRow;
    };
  };
};

const capturedPickerProps: MockScheduledOverridePickerProps[] = [];

vi.mock("../../../src/components/grids/ScheduledOverridePicker", () => ({
  ScheduledOverridePicker: (props: MockScheduledOverridePickerProps) => {
    capturedPickerProps.push(props);

    return (
      <div data-testid="scheduled-override-picker">
        {props.triggerLabel ?? props.value}
      </div>
    );
  },
}));

function getScheduledCellRenderer(callbacks?: ICellEditorCallbacks) {
  const scheduledColumn = getRepertoireColumns(callbacks).find(
    (column) => column.id === "scheduled"
  ) as { cell?: (info: ScheduledCellInfo) => JSX.Element } | undefined;

  if (!scheduledColumn?.cell) {
    throw new Error("Scheduled column cell renderer was not found");
  }

  return scheduledColumn.cell;
}

function renderScheduledCell(
  row: ScheduledRow,
  callbacks?: ICellEditorCallbacks
) {
  const renderCell = getScheduledCellRenderer(callbacks);
  const info: ScheduledCellInfo = {
    getValue: () => row.scheduled || row.latest_due || null,
    row: {
      original: row,
      getValue: (columnId) => {
        if (columnId === "latest_due") {
          return row.latest_due || null;
        }

        if (columnId === "recall_eval") {
          return row.recall_eval || null;
        }

        return null;
      },
    },
    cell: {
      row: {
        original: row,
      },
    },
  };

  return render(() => renderCell(info));
}

function getLastPickerProps(): MockScheduledOverridePickerProps {
  const props = capturedPickerProps.at(-1);
  if (!props) {
    throw new Error("ScheduledOverridePicker was not rendered");
  }

  return props;
}

describe("getRepertoireColumns scheduled column", () => {
  beforeEach(() => {
    capturedPickerProps.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T12:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("falls back to latest_due for display when no scheduled override exists", () => {
    renderScheduledCell(
      {
        id: "tune-1",
        tune_id: "tune-1",
        scheduled: null,
        latest_due: "2026-04-01T12:00:00.000Z",
      },
      {
        onScheduledChange: vi.fn(),
      }
    );

    const pickerProps = getLastPickerProps();
    expect(pickerProps.value).toBe("");
    expect(pickerProps.triggerLabel).toContain("overdue");
    expect(pickerProps.triggerTextClass).toContain("text-red-600");
  });

  it("uses the raw scheduled override for both editing and display when present", () => {
    renderScheduledCell(
      {
        id: "tune-2",
        tune_id: "tune-2",
        scheduled: "2026-04-25T12:00:00.000Z",
        latest_due: "2026-04-01T12:00:00.000Z",
        recall_eval: "good",
      },
      {
        onScheduledChange: vi.fn(),
      }
    );

    const pickerProps = getLastPickerProps();
    expect(pickerProps.value).toBe("2026-04-25T12:00:00.000Z");
    expect(pickerProps.triggerTextClass).toContain("text-green-600");
    expect(pickerProps.triggerLabel).toMatch(/In \d+d/);
  });
});
