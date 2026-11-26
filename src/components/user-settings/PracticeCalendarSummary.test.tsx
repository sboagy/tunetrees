import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  type CalendarEditorGuard,
  PracticeCalendarSummary,
} from "./PracticeCalendarSummary";

const mocks = vi.hoisted(() => ({
  db: {},
  user: (): string => "owner",
  load: vi.fn(),
  update: vi.fn(),
  persist: vi.fn(),
}));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: () => ({ id: mocks.user() }),
    localDb: () => mocks.db,
  }),
}));
vi.mock("@/lib/db/queries/user-settings", () => ({
  getSchedulingOptions: mocks.load,
  updateSchedulingOptions: mocks.update,
}));
vi.mock("@/lib/db/client-sqlite", () => ({ persistDb: mocks.persist }));
beforeEach(() => {
  vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});
  mocks.user = () => "owner";
  mocks.load.mockResolvedValue(null);
  mocks.update.mockResolvedValue({});
  mocks.persist.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});
async function open() {
  let guard!: CalendarEditorGuard;
  render(() => (
    <PracticeCalendarSummary
      onRegister={(value) => {
        guard = value;
      }}
    />
  ));
  fireEvent.click(screen.getByTestId("shared-practice-calendar"));
  await screen.findByTestId("calendar-days");
  return guard;
}
it("saves only calendar fields and persists before closing", async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  const first = document.querySelector<HTMLButtonElement>("[data-date]")!;
  const firstKey = first.dataset.date;
  fireEvent.click(first);
  fireEvent.click(screen.getByRole("button", { name: "Next Month" }));
  const second = document.querySelector<HTMLButtonElement>("[data-date]")!;
  const secondKey = second.dataset.date;
  fireEvent.click(second);
  fireEvent.click(screen.getByTestId("calendar-save"));
  await waitFor(() =>
    expect(screen.queryByTestId("practice-calendar-dialog")).toBeNull()
  );
  expect(mocks.update).toHaveBeenCalledWith(mocks.db, {
    userId: "owner",
    daysPerWeek: 1,
    weeklyRules: '{"monday":true}',
    exceptions: JSON.stringify([firstKey, secondKey]),
  });
  expect(mocks.persist).toHaveBeenCalledOnce();
});
it("preserves an unsupported weekly rule on an exception-only save", async () => {
  mocks.load.mockResolvedValue({
    weeklyRules: '{"legacy":true}',
    daysPerWeek: 3,
  });
  render(() => <PracticeCalendarSummary />);
  fireEvent.click(screen.getByTestId("shared-practice-calendar"));
  await screen.findByText(/existing weekly rule is preserved/);
  fireEvent.click(document.querySelector<HTMLButtonElement>("[data-date]")!);
  fireEvent.click(screen.getByTestId("calendar-save"));
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      mocks.db,
      expect.objectContaining({
        weeklyRules: '{"legacy":true}',
        daysPerWeek: 3,
      })
    )
  );
});
it("returns to a clean draft when a weekday and date are toggled twice", async () => {
  await open();
  for (const button of [
    screen.getByRole("button", { name: "Monday" }),
    document.querySelector<HTMLButtonElement>("[data-date]")!,
  ]) {
    fireEvent.click(button);
    fireEvent.click(button);
  }
  expect(
    (screen.getByTestId("calendar-save") as HTMLButtonElement).disabled
  ).toBe(true);
});
it("guards navigation and retains edits when Keep Editing is chosen", async () => {
  const guard = await open();
  const leave = vi.fn();
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  guard.requestExit(leave);
  fireEvent.click(await screen.findByRole("button", { name: "Keep Editing" }));
  expect(leave).not.toHaveBeenCalled();
  expect(screen.getByTestId("calendar-days").textContent).toBe(
    "1 day per week"
  );
});
it("retries a failed disk save without repeating the mutation", async () => {
  mocks.persist.mockRejectedValueOnce(new Error("Disk unavailable"));
  const guard = await open();
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  fireEvent.click(screen.getByTestId("calendar-save"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("in memory")
  );
  expect(guard.pending()).toBe(true);
  expect(
    screen.getByTestId("calendar-weekly").parentElement?.closest("fieldset")
      ?.disabled
  ).toBe(true);
  fireEvent.click(screen.getByTestId("calendar-save"));
  await waitFor(() =>
    expect(screen.queryByTestId("practice-calendar-dialog")).toBeNull()
  );
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(mocks.persist).toHaveBeenCalledTimes(2);
});

it("releases failed persistence recovery when the account changes", async () => {
  const [owner, setOwner] = createSignal("owner");
  mocks.user = owner;
  mocks.persist.mockRejectedValueOnce(new Error("Disk unavailable"));
  const guard = await open();
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  fireEvent.click(screen.getByTestId("calendar-save"));
  await screen.findByRole("alert");
  expect(guard.pending()).toBe(true);
  setOwner("other");
  await waitFor(() => expect(guard.open()).toBe(false));
  expect(guard.pending()).toBe(false);
  const leave = vi.fn();
  guard.requestExit(leave);
  expect(leave).toHaveBeenCalledOnce();
  expect(mocks.update).toHaveBeenCalledOnce();
});
