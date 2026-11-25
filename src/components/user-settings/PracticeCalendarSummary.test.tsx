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
  fireEvent.input(screen.getByTestId("calendar-days"), {
    target: { value: "4" },
  });
  fireEvent.input(screen.getByTestId("calendar-weekly"), {
    target: { value: '{"monday":true}' },
  });
  fireEvent.input(screen.getByTestId("calendar-exceptions"), {
    target: { value: "[]" },
  });
  fireEvent.click(screen.getByTestId("calendar-save"));
  await waitFor(() =>
    expect(screen.queryByTestId("practice-calendar-dialog")).toBeNull()
  );
  expect(mocks.update).toHaveBeenCalledWith(mocks.db, {
    userId: "owner",
    daysPerWeek: 4,
    weeklyRules: '{"monday":true}',
    exceptions: "[]",
  });
  expect(mocks.persist).toHaveBeenCalledOnce();
});
it("keeps invalid JSON and blocks writes", async () => {
  await open();
  fireEvent.input(screen.getByTestId("calendar-weekly"), {
    target: { value: "[" },
  });
  fireEvent.click(screen.getByTestId("calendar-save"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Weekly Rules")
  );
  expect(
    (screen.getByTestId("calendar-weekly") as HTMLTextAreaElement).value
  ).toBe("[");
  expect(screen.getByTestId("calendar-weekly")).toBe(document.activeElement);
  expect(
    screen.getByTestId("calendar-weekly").getAttribute("aria-invalid")
  ).toBe("true");
  expect(
    screen.getByTestId("calendar-weekly").getAttribute("aria-describedby")
  ).toBe(screen.getByRole("alert").id);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("guards navigation and retains edits when Keep Editing is chosen", async () => {
  const guard = await open();
  const leave = vi.fn();
  fireEvent.input(screen.getByTestId("calendar-days"), {
    target: { value: "3" },
  });
  guard.requestExit(leave);
  fireEvent.click(await screen.findByRole("button", { name: "Keep Editing" }));
  expect(leave).not.toHaveBeenCalled();
  expect((screen.getByTestId("calendar-days") as HTMLInputElement).value).toBe(
    "3"
  );
});
it("retries a failed disk save without repeating the mutation", async () => {
  mocks.persist.mockRejectedValueOnce(new Error("Disk unavailable"));
  const guard = await open();
  fireEvent.input(screen.getByTestId("calendar-days"), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByTestId("calendar-save"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("in memory")
  );
  expect(guard.pending()).toBe(true);
  expect(
    screen.getByTestId("calendar-days").closest("fieldset")?.disabled
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
  fireEvent.input(screen.getByTestId("calendar-days"), {
    target: { value: "3" },
  });
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
