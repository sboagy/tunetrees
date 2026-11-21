import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vitest";
import { RecallEvalComboBox } from "@/components/grids/RecallEvalComboBox";
import type { EvaluationChoice } from "@/lib/goals/config";

afterEach(cleanup);
const choices: EvaluationChoice[] = [
  {
    id: "good",
    label: "Good",
    description: "Recalled correctly",
    action: { kind: "fsrs", rating: 3 },
  },
];

it("shows only the selected evaluation label in the closed picker", () => {
  render(() => (
    <RecallEvalComboBox
      tuneId="tune"
      choices={choices}
      value="good"
      onChange={vi.fn()}
    />
  ));
  expect(screen.getByTestId("recall-eval-tune").textContent).toBe("Good");
});

it("uses goal-provided labels rather than reconstructing them from the choice ID", () => {
  render(() => (
    <RecallEvalComboBox
      tuneId="tune"
      choices={[
        { ...choices[0], label: "Remembered", description: "Without a prompt" },
      ]}
      value="good"
      onChange={vi.fn()}
    />
  ));
  expect(screen.getByTestId("recall-eval-tune").textContent).toBe("Remembered");
});

it("does not add a separator to the unset choice", () => {
  render(() => (
    <RecallEvalComboBox
      tuneId="tune"
      choices={choices}
      value=""
      onChange={vi.fn()}
    />
  ));
  expect(screen.getByTestId("recall-eval-tune").textContent).toContain(
    "(Not Set)"
  );
  expect(screen.getByTestId("recall-eval-tune").textContent).not.toContain(":");
});

it("calculates estimates for an initially open controlled menu without selecting a choice", async () => {
  const load = vi.fn().mockResolvedValue({ good: "2026-11-22T12:00:00Z" });
  const change = vi.fn();
  render(() => (
    <RecallEvalComboBox
      tuneId="tune"
      choices={choices}
      value=""
      onChange={change}
      open={true}
      loadDuePreviews={load}
    />
  ));
  expect(await screen.findByText(/Due /)).toBeDefined();
  expect(load).toHaveBeenCalledOnce();
  expect(change).not.toHaveBeenCalled();
});

it("discloses explanations without changing the selected evaluation", () => {
  const change = vi.fn();
  render(() => (
    <RecallEvalComboBox
      tuneId="tune"
      choices={[
        {
          id: "back",
          label: "Loses the flow",
          description: "Drops out or loses the tune",
          action: { kind: "back" },
        },
      ]}
      value="back"
      onChange={change}
      open={true}
    />
  ));
  expect(screen.getByTestId("recall-eval-tune").textContent).toBe(
    "Loses the flow"
  );
  const option = screen.getByTestId("recall-eval-option-back");
  expect(option.textContent).toContain("Step back");
  expect(option.textContent).toContain("Current selection");
  expect(option.textContent).not.toContain("Drops out");
  fireEvent.keyDown(screen.getByTestId("recall-eval-explain"), {
    key: "Enter",
  });
  expect(option.textContent).toContain(
    "Drops out or loses the tune — Move back one interval"
  );
  expect(change).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByTestId("recall-eval-explain"), {
    key: "Enter",
  });
  expect(option.textContent).not.toContain("Drops out");
});

it("clears the evaluation through the separate clear action", () => {
  const change = vi.fn();
  render(() => (
    <RecallEvalComboBox
      tuneId="tune"
      choices={choices}
      value="good"
      onChange={change}
      open={true}
    />
  ));
  fireEvent.keyDown(screen.getByTestId("recall-eval-option-not-set"), {
    key: "Enter",
  });
  expect(change).toHaveBeenCalledWith("");
});
