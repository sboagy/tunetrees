import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@solidjs/testing-library";
import { Show } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  UserSettingsDialogProvider,
  useUserSettingsDialog,
} from "@/contexts/UserSettingsDialogContext";
import { getBuiltInGoals } from "@/lib/goals/builtins";
import type { GoalSettingsEntry } from "@/lib/goals/settings";
import GoalsPage from "./goals";

const mocks = vi.hoisted(() => ({
  db: {},
  save: vi.fn(),
  catalog: vi.fn(),
}));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: () => ({ id: "owner" }),
    localDb: () => mocks.db,
    incrementRepertoireListChanged: vi.fn(),
    incrementPracticeListStagedChanged: vi.fn(),
  }),
}));
vi.mock("@/lib/db/queries/plugins", () => ({
  getPluginsByCapability: async () => [],
}));
vi.mock("@/components/user-settings/PracticeCalendarSummary", () => ({
  PracticeCalendarSummary: () => <p>Shared calendar</p>,
}));
vi.mock("@/lib/goals/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/goals/settings")>()),
  readGoalSettingsCatalog: mocks.catalog,
  saveGoalSettingsBatch: mocks.save,
}));

// No database is used by this UI test; persistence/revision atomicity has separate
// SQLite tests. Fixtures contain the complete row shape consumed by the catalog.
function entries(): GoalSettingsEntry[] {
  return getBuiltInGoals()
    .slice(0, 2)
    .map((item) => ({
      row: {
        id: item.id,
        name: item.name,
        displayName: item.displayName,
        description: item.description,
        defaultConfig: JSON.stringify(item.config),
        defaultTechnique: "fsrs",
        baseIntervals: null,
        privateFor: null,
        deleted: 0,
        deviceId: null,
        lastModifiedAt: "2026-11-20T12:00:00Z",
        syncVersion: 1,
      },
      defaults: structuredClone(item),
      effective: structuredClone(item),
      revision: "one",
      overridden: false,
    }));
}
function Harness() {
  const settings = useUserSettingsDialog();
  settings.openUserSettings("goals");
  return (
    <>
      <button type="button" onClick={settings.closeUserSettings}>
        Close settings
      </button>
      <button
        type="button"
        onClick={() => settings.navigateToTab("appearance")}
      >
        Appearance
      </button>
      <Show when={settings.isOpen()}>
        <Show
          when={settings.currentTab() === "goals"}
          fallback={<p>Appearance content</p>}
        >
          <GoalsPage />
        </Show>
        {settings.draft()?.footer(settings.closeUserSettings)}
      </Show>
    </>
  );
}
function setup() {
  // The real Settings overlay is outside Router; keep this regression boundary.
  render(() => (
    <UserSettingsDialogProvider>
      <Harness />
    </UserSettingsDialogProvider>
  ));
  const first = screen.getByTestId(`goal-panel-${getBuiltInGoals()[0].id}`);
  const second = screen.getByTestId(`goal-panel-${getBuiltInGoals()[1].id}`);
  return { first: within(first), second: within(second) };
}
beforeEach(() => {
  vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});
  mocks.catalog.mockReturnValue({ entries: entries(), unavailable: [] });
  mocks.save.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it("saves only the active goal and closes its dialog without closing Settings", async () => {
  const { first, second } = setup();
  expect(screen.queryByTestId("goal-save")).toBeNull();
  fireEvent.click(first.getByRole("button", { name: "Edit" }));
  fireEvent.input(screen.getByTestId("goal-minimum"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByTestId("goal-save"));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(mocks.save.mock.calls[0][2]).toHaveLength(1);
  expect(mocks.save.mock.calls[0][2][0].definition.config.daily.minimum).toBe(
    2
  );
  await waitFor(() =>
    expect(screen.queryByTestId("goal-editor-dialog")).toBeNull()
  );
  expect(screen.getByTestId("goals-settings")).toBeTruthy();
  fireEvent.click(second.getByRole("button", { name: "Edit" }));
  expect((screen.getByTestId("goal-minimum") as HTMLInputElement).value).toBe(
    "0"
  );
});

it("keeps the category and draft when declining navigation, then discards on explicit confirmation", async () => {
  const { first } = setup();
  fireEvent.click(first.getByRole("button", { name: "Edit" }));
  fireEvent.input(screen.getByTestId("goal-name"), {
    target: { value: "My recall" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Appearance", hidden: true })
  );
  fireEvent.click(await screen.findByRole("button", { name: "Keep editing" }));
  expect((screen.getByTestId("goal-name") as HTMLInputElement).value).toBe(
    "My recall"
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Appearance", hidden: true })
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Discard changes" })
  );
  expect(screen.getByText("Appearance content")).toBeTruthy();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("blocks close and category changes during a local save and keeps failed drafts", async () => {
  let reject!: (error: Error) => void;
  mocks.save.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    })
  );
  const { first } = setup();
  fireEvent.click(first.getByRole("button", { name: "Edit" }));
  fireEvent.input(screen.getByTestId("goal-name"), {
    target: { value: "My recall" },
  });
  fireEvent.click(screen.getByTestId("goal-save"));
  fireEvent.click(
    screen.getByRole("button", { name: "Close settings", hidden: true })
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Appearance", hidden: true })
  );
  expect(screen.getByTestId("goals-settings")).toBeTruthy();
  expect((screen.getByTestId("goal-save") as HTMLButtonElement).disabled).toBe(
    true
  );
  reject(new Error("Conflicting edit; reload goals"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Conflicting edit")
  );
  expect((screen.getByTestId("goal-name") as HTMLInputElement).value).toBe(
    "My recall"
  );
  expect((screen.getByTestId("goal-save") as HTMLButtonElement).disabled).toBe(
    false
  );
});
