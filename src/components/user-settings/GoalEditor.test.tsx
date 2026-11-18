import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vitest";
import { getBuiltInGoals } from "@/lib/goals/builtins";
import { GoalEditor } from "./GoalEditor";

afterEach(cleanup);
function setup(name = "recall") {
  const definition = getBuiltInGoals().find((item) => item.name === name)!;
  const save = vi.fn().mockResolvedValue(undefined);
  render(() => (
    <GoalEditor initial={definition} onSave={save} onCancel={() => {}} />
  ));
  return { definition, save };
}
it("saves Unlimited and zero minimum without changing evaluation identities", async () => {
  const { definition, save } = setup();
  fireEvent.input(screen.getByTestId("goal-minimum"), {
    target: { value: "0" },
  });
  expect(
    (screen.getByTestId("goal-unlimited") as HTMLInputElement).checked
  ).toBe(false);
  fireEvent.click(screen.getByTestId("goal-unlimited"));
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].config.daily).toMatchObject({
    minimum: 0,
    maximum: 0,
  });
  expect(save.mock.calls[0][0].config.evaluations).toEqual(
    definition.config.evaluations
  );
});
it("preserves focus across consecutive evaluation-label edits", () => {
  setup("fluency");
  const input = screen.getByTestId("goal-choice-label-0");
  input.focus();
  fireEvent.input(input, { target: { value: "Needs " } });
  fireEvent.input(input, { target: { value: "Needs work" } });
  expect(document.activeElement).toBe(input);
  expect(
    (screen.getByTestId("goal-choice-label-0") as HTMLInputElement).value
  ).toBe("Needs work");
});
it("switches schedulers with compatible editable actions and fractional ladder steps", async () => {
  const { save } = setup();
  fireEvent.change(screen.getByTestId("goal-scheduler"), {
    target: { value: "builtin:interval-ladder" },
  });
  fireEvent.input(screen.getByTestId("goal-intervals"), {
    target: { value: "0.1, 0.5, 2" },
  });
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].config.scheduler).toMatchObject({
    id: "builtin:interval-ladder",
    intervalsDays: [0.1, 0.5, 2],
  });
  expect(
    save.mock.calls[0][0].config.evaluations.map(
      (item: { action: { kind: string } }) => item.action.kind
    )
  ).toEqual(["reset", "back", "stay", "advance"]);
});
it("rejects malformed ladder input without invoking save", async () => {
  const { save } = setup("fluency");
  fireEvent.input(screen.getByTestId("goal-intervals"), {
    target: { value: "1, 0.5" },
  });
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "strictly increasing"
    )
  );
  expect(save).not.toHaveBeenCalled();
});
it("edits advanced FSRS settings and leaves the source defaults intact", async () => {
  const { definition, save } = setup();
  fireEvent.input(screen.getByTestId("goal-retention"), {
    target: { value: "0.85" },
  });
  fireEvent.input(screen.getByTestId("goal-learning-steps"), {
    target: { value: "2, 15" },
  });
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].config.scheduler).toMatchObject({
    retention: 0.85,
    learningStepsMinutes: [2, 15],
  });
  expect(definition.config.scheduler).toEqual(
    getBuiltInGoals()[0].config.scheduler
  );
});
it("retains edits and displays a failed save for retry", async () => {
  const { save } = setup();
  save.mockRejectedValueOnce(new Error("Settings changed"));
  fireEvent.input(screen.getByTestId("goal-name"), {
    target: { value: "Remember tunes" },
  });
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Settings changed")
  );
  expect((screen.getByTestId("goal-name") as HTMLInputElement).value).toBe(
    "Remember tunes"
  );
  expect(screen.getByTestId("goal-save").closest("fieldset")?.disabled).toBe(
    false
  );
});
