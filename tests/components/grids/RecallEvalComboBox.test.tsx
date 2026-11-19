import { cleanup, render, screen } from "@solidjs/testing-library";
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

it("preserves the selected evaluation's label and explanation", () => {
  render(() => (
    <RecallEvalComboBox
      tuneId="tune"
      choices={choices}
      value="good"
      onChange={vi.fn()}
    />
  ));
  expect(screen.getByTestId("recall-eval-tune").textContent).toContain(
    "Good: Recalled correctly"
  );
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
  expect(screen.getByTestId("recall-eval-tune").textContent).toContain(
    "Remembered: Without a prompt"
  );
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
