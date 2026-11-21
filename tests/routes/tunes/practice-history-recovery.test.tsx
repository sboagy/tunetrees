import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBuiltInGoals } from "@/lib/goals/builtins";
import { ManualPracticePersistenceError } from "@/lib/goals/manual-practice";
import PracticeHistoryPage from "@/routes/tunes/[id]/practice-history";

const mocks = vi.hoisted(() => ({
  repertoire: (): string => "rep-a",
  records: vi.fn(),
  catalog: vi.fn(),
  prepare: vi.fn(),
  save: vi.fn(),
  success: vi.fn(),
  db: {
    select: () => ({ from: () => ({ where: () => ({ all: () => [] }) }) }),
  },
}));
vi.mock("@solidjs/router", () => ({
  useParams: () => ({ id: "tune" }),
  useLocation: () => ({}),
  useNavigate: () => vi.fn(),
  // These tests exercise repertoire-scoped recovery without a mounted router.
  // Real navigation/discard behavior is covered in practice-history.spec.ts.
  useBeforeLeave: vi.fn(),
}));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ localDb: () => mocks.db, userIdInt: () => "owner" }),
}));
vi.mock("@/lib/context/CurrentRepertoireContext", () => ({
  useCurrentRepertoire: () => ({
    currentRepertoireId: () => mocks.repertoire(),
  }),
}));
vi.mock("@/lib/db/client-sqlite", () => ({ persistDb: vi.fn() }));
vi.mock("@/lib/db/queries/practice-records", () => ({
  getPracticeRecordsForTune: (...args: unknown[]) => mocks.records(...args),
  deletePracticeRecord: vi.fn(),
}));
vi.mock("@/lib/db/queries/tunes", () => ({
  getTuneForUserById: async () => ({ title: "Test tune" }),
}));
vi.mock("@/lib/goals/settings", () => ({
  readGoalSettingsCatalog: () => mocks.catalog(),
}));
vi.mock("@/lib/goals/resolve", () => ({
  readGoalPracticeContext: () => ({
    goalId: "00000000-0000-0000-0000-000000000001",
  }),
}));
vi.mock("@/lib/goals/manual-practice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/goals/manual-practice")>()),
  prepareManualPractice: (...args: unknown[]) => mocks.prepare(...args),
  saveManualPractice: (...args: unknown[]) => mocks.save(...args),
}));
vi.mock("solid-sonner", () => ({
  toast: { success: (...args: unknown[]) => mocks.success(...args) },
}));

let switchRepertoire: (value: string) => void;
const receipt = { committed: true, record: { id: "saved-entry" } };
beforeEach(() => {
  vi.resetAllMocks();
  const [repertoire, setRepertoire] = createSignal("rep-a");
  mocks.repertoire = repertoire;
  switchRepertoire = setRepertoire;
  mocks.records.mockResolvedValue([]);
  mocks.catalog.mockReturnValue({
    entries: getBuiltInGoals().map((goal) => ({
      row: goal,
      effective: { displayName: goal.displayName, config: goal.config },
    })),
    unavailable: [],
  });
  mocks.prepare.mockResolvedValue(receipt);
  mocks.save.mockResolvedValue(undefined);
});
afterEach(cleanup);
async function openForm() {
  await waitFor(() =>
    expect(
      screen.getByTestId("practice-history-add-button").hasAttribute("disabled")
    ).toBe(false)
  );
  fireEvent.click(screen.getByTestId("practice-history-add-button"));
  await screen.findByTestId("practice-history-add-form");
}

describe("Practice History recovery across repertoires", () => {
  it("detaches a failed save from another repertoire and restores its retry on return", async () => {
    mocks.save.mockRejectedValueOnce(
      new ManualPracticePersistenceError(new Error("disk"))
    );
    render(() => <PracticeHistoryPage />);
    await openForm();
    fireEvent.click(screen.getByTestId("practice-history-save-button"));
    await screen.findByText(/This entry is in memory/);
    switchRepertoire("rep-b");
    await waitFor(() =>
      expect(screen.queryByTestId("practice-history-add-form")).toBeNull()
    );
    await waitFor(() =>
      expect(
        screen
          .getByTestId("practice-history-add-button")
          .hasAttribute("disabled")
      ).toBe(false)
    );
    switchRepertoire("rep-a");
    await screen.findByTestId("practice-history-add-form");
    fireEvent.click(screen.getByTestId("practice-history-save-button"));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledOnce());
    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenNthCalledWith(
      2,
      mocks.db,
      receipt,
      expect.any(Function)
    );
  });

  it("does not show an obsolete calculation error in another repertoire", async () => {
    let rejectCalculation!: (error: Error) => void;
    mocks.prepare.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectCalculation = reject;
      })
    );
    render(() => <PracticeHistoryPage />);
    await openForm();
    fireEvent.click(screen.getByTestId("practice-history-save-button"));
    await screen.findByText("Saving…");
    switchRepertoire("rep-b");
    rejectCalculation(new Error("Old repertoire plugin failed"));
    await waitFor(() =>
      expect(
        screen
          .getByTestId("practice-history-add-button")
          .hasAttribute("disabled")
      ).toBe(false)
    );
    expect(screen.queryByText("Old repertoire plugin failed")).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("clears a successfully saved original form even if persistence finishes in another view", async () => {
    let finishSave!: () => void;
    mocks.save.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      })
    );
    render(() => <PracticeHistoryPage />);
    await openForm();
    fireEvent.click(screen.getByTestId("practice-history-save-button"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    switchRepertoire("rep-b");
    finishSave();
    await waitFor(() =>
      expect(
        screen
          .getByTestId("practice-history-add-button")
          .hasAttribute("disabled")
      ).toBe(false)
    );
    switchRepertoire("rep-a");
    await waitFor(() =>
      expect(
        screen
          .getByTestId("practice-history-add-button")
          .hasAttribute("disabled")
      ).toBe(false)
    );
    expect(screen.queryByTestId("practice-history-add-form")).toBeNull();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("shows Retry without a perpetual loading indicator after a failed history read", async () => {
    mocks.records.mockRejectedValueOnce(new Error("History read failed"));
    render(() => <PracticeHistoryPage />);
    await screen.findByText(/Practice history could not be loaded/);
    expect(screen.queryByText("Loading practice history...")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("No practice records found for this tune.");
    expect(
      screen.queryByText(/Practice history could not be loaded/)
    ).toBeNull();
  });
});
