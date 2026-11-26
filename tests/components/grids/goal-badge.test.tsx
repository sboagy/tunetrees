import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { GoalBadge } from "../../../src/components/grids/GoalBadge";

vi.mock("@/contexts/UserSettingsDialogContext", () => ({
  useUserSettingsDialog: () => ({ openUserSettings: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("closes after assigning a goal while the badge remains mounted", async () => {
  vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});
  const user = userEvent.setup();
  const [goal, setGoal] = createSignal("recall");
  render(() => (
    <GoalBadge
      value={goal()}
      onGoalChange={setGoal}
      goals={() => [
        { id: "recall", name: "recall", displayName: "Recall" },
        { id: "session", name: "session_ready", displayName: "Session" },
      ]}
    />
  ));

  await user.click(screen.getByRole("button", { name: "Recall" }));
  expect(
    screen
      .getByRole("menuitemradio", { name: "Recall" })
      .getAttribute("aria-checked")
  ).toBe("true");
  await user.click(screen.getByRole("menuitemradio", { name: "Session" }));
  expect(goal()).toBe("session_ready");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Session" })
    )
  );
});
