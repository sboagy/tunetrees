import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { createSignal, Show } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getBuiltInGoals } from "@/lib/goals/builtins";
import type { GoalPluginSelection } from "@/lib/goals/plugin-settings";
import type { EditableGoalDefinition } from "@/lib/goals/settings";
import { GoalEditor, type GoalEditorDraft } from "./GoalEditor";

// Exercise the editor through its category-facing validation contract.
function EditorHarness(props: {
  initial: EditableGoalDefinition;
  plugins?: { id: string; name: string }[];
  onInspectPlugin?: (id: string) => Promise<GoalPluginSelection>;
  isNew?: boolean;
  onSave: (
    definition: EditableGoalDefinition,
    selection?: GoalPluginSelection
  ) => Promise<void>;
}) {
  let draft!: GoalEditorDraft;
  const [failure, setFailure] = createSignal("");
  const save = async () => {
    try {
      const value = draft.validate();
      await props.onSave(value.definition, value.reviewedPlugin);
    } catch (cause) {
      if (!draft.error()) setFailure(String(cause));
    }
  };
  return (
    <>
      <GoalEditor
        {...props}
        onRegister={(value) => {
          draft = value;
        }}
        onSaveChoices={async (definition, selection) => {
          await props.onSave(definition, selection);
          return definition;
        }}
        onSave={save}
      />
      <button
        type="button"
        data-testid="goal-save"
        disabled={draft.pending()}
        onClick={save}
      >
        Save Changes
      </button>
      <Show when={failure()}>
        <p role="alert">{failure()}</p>
      </Show>
    </>
  );
}
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(name = "recall") {
  const definition = getBuiltInGoals().find((item) => item.name === name)!;
  const save = vi.fn().mockResolvedValue(undefined);
  render(() => <EditorHarness initial={definition} onSave={save} />);
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
  fireEvent.click(screen.getByTestId("goal-choice-edit-0"));
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
  expect((screen.getByTestId("goal-save") as HTMLButtonElement).disabled).toBe(
    false
  );
});

const selection: GoalPluginSelection = {
  plugin: {
    id: "selected",
    name: "Practice strategy",
    version: 1,
    script: "script-v1",
    capabilities: '{"scheduleGoal":true}',
  },
  manifest: {
    apiVersion: 1,
    stateVersion: 1,
    compatibleStateVersions: [1],
    actions: [
      { id: "advance", label: "Advance", description: "Review tomorrow" },
      { id: "repeat", label: "Repeat", description: "Review in six hours" },
    ],
  },
};
function setupPlugin(initial: EditableGoalDefinition = getBuiltInGoals()[0]) {
  const inspect = vi
    .fn<(id: string) => Promise<GoalPluginSelection>>()
    .mockResolvedValue(structuredClone(selection));
  const save = vi.fn().mockResolvedValue(undefined);
  render(() => (
    <EditorHarness
      initial={initial}
      plugins={[selection.plugin]}
      onInspectPlugin={inspect}
      onSave={save}
    />
  ));
  return { inspect, save };
}
it("offers named plugin effects with editable evaluation labels and descriptions", async () => {
  const { save } = setupPlugin();
  fireEvent.change(screen.getByTestId("goal-scheduler"), {
    target: { value: "plugin:selected" },
  });
  await waitFor(() =>
    expect(screen.getByTestId("goal-choice-summary-0").textContent).toBe(
      "Advance"
    )
  );
  fireEvent.click(screen.getByTestId("goal-choice-edit-0"));
  fireEvent.input(screen.getByTestId("goal-choice-label-0"), {
    target: { value: "Played smoothly" },
  });
  fireEvent.change(screen.getByTestId("goal-choice-action-0"), {
    target: { value: "repeat" },
  });
  expect(screen.getAllByText("Review in six hours").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByTestId("goal-choice-save"));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].config.evaluations[0]).toMatchObject({
    label: "Played smoothly",
    action: { kind: "plugin", actionId: "repeat" },
  });
  expect(save.mock.calls[0][1]).toEqual(selection);
});
it("retains the previous draft on plugin load failure and retries explicitly", async () => {
  const { inspect, save } = setupPlugin();
  inspect.mockRejectedValueOnce(new Error("Plugin unavailable"));
  fireEvent.change(screen.getByTestId("goal-scheduler"), {
    target: { value: "plugin:selected" },
  });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Plugin unavailable"
    )
  );
  expect(screen.getByTestId("goal-choice-summary-0").textContent).toBe("Again");
  fireEvent.submit(screen.getByTestId("goal-editor"));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^Retry$/ }));
  await waitFor(() =>
    expect(screen.getByTestId("goal-choice-summary-0").textContent).toBe(
      "Advance"
    )
  );
});
it("ignores plugin results after a different scheduler is selected", async () => {
  const { inspect, save } = setupPlugin();
  let finish!: (value: GoalPluginSelection) => void;
  inspect.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  fireEvent.change(screen.getByTestId("goal-scheduler"), {
    target: { value: "plugin:selected" },
  });
  expect((screen.getByTestId("goal-save") as HTMLButtonElement).disabled).toBe(
    true
  );
  fireEvent.change(screen.getByTestId("goal-scheduler"), {
    target: { value: "builtin:interval-ladder" },
  });
  finish(selection);
  await Promise.resolve();
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].config.scheduler.id).toBe(
    "builtin:interval-ladder"
  );
});
it("preserves existing plugin options, labels and evaluation identities when reloading actions", async () => {
  const initial: EditableGoalDefinition = structuredClone(getBuiltInGoals()[0]);
  initial.config.scheduler = {
    id: "plugin",
    version: 1,
    pluginId: "selected",
    options: { tempo: 100 },
  };
  initial.config.evaluations = [
    {
      id: "personal",
      label: "At tempo",
      description: "No hesitations",
      action: { kind: "plugin", actionId: "repeat" },
    },
  ];
  const { save } = setupPlugin(initial);
  await waitFor(() =>
    expect(screen.getByTestId("goal-plugin-reload")).toBeTruthy()
  );
  fireEvent.click(screen.getByTestId("goal-plugin-reload"));
  await waitFor(() =>
    expect(
      (screen.getByTestId("goal-save") as HTMLButtonElement).disabled
    ).toBe(false)
  );
  fireEvent.click(screen.getByTestId("goal-choice-edit-0"));
  expect(
    (screen.getByTestId("goal-choice-action-0") as HTMLSelectElement).value
  ).toBe("repeat");
  fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].config).toEqual(initial.config);
});
it("shows missing effects and rejects them without inventing a replacement action", async () => {
  const initial: EditableGoalDefinition = structuredClone(getBuiltInGoals()[0]);
  initial.config.scheduler = {
    id: "plugin",
    version: 1,
    pluginId: "selected",
    options: {},
  };
  initial.config.evaluations = [
    {
      id: "personal",
      label: "At tempo",
      description: "",
      action: { kind: "plugin", actionId: "removed" },
    },
  ];
  const { save } = setupPlugin(initial);
  await waitFor(() =>
    expect(screen.getByTestId("goal-plugin-reload")).toBeTruthy()
  );
  await waitFor(() =>
    expect(
      (screen.getByTestId("goal-choice-edit-0") as HTMLButtonElement).disabled
    ).toBe(false)
  );
  fireEvent.click(screen.getByTestId("goal-choice-edit-0"));
  expect(
    screen.getByRole("option", { name: "Unavailable effect — choose another" })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "available scheduling effect"
    )
  );
  expect(save).not.toHaveBeenCalled();
});

it("saves a choice immediately without saving an unrelated name draft", async () => {
  const { save, definition } = setup();
  fireEvent.input(screen.getByTestId("goal-name"), {
    target: { value: "Unfinished name" },
  });
  fireEvent.click(screen.getByTestId("goal-choice-edit-0"));
  fireEvent.input(screen.getByTestId("goal-choice-label-0"), {
    target: { value: "Try again" },
  });
  fireEvent.click(screen.getByTestId("goal-choice-save"));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].displayName).toBe(definition.displayName);
  expect(save.mock.calls[0][0].config.evaluations[0].label).toBe("Try again");
  expect((screen.getByTestId("goal-name") as HTMLInputElement).value).toBe(
    "Unfinished name"
  );
  await waitFor(() =>
    expect(screen.getByTestId("goal-choice-summary-0").textContent).toBe(
      "Try again"
    )
  );
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0].config.evaluations[0].label).toBe("Try again");
});
it("retains a choice while returning to complete a new goal's missing name", async () => {
  const initial = { ...getBuiltInGoals()[0], displayName: "" };
  const save = vi.fn().mockResolvedValue(undefined);
  render(() => <EditorHarness initial={initial} isNew onSave={save} />);
  fireEvent.click(screen.getByTestId("goal-choice-edit-0"));
  fireEvent.input(screen.getByTestId("goal-choice-label-0"), {
    target: { value: "Try again" },
  });
  fireEvent.click(screen.getByTestId("goal-choice-save"));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Complete Goal Details" })
    ).toBeTruthy()
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Complete Goal Details" })
  );
  expect(screen.getByTestId("goal-choice-summary-0").textContent).toBe(
    "Try again"
  );
  fireEvent.input(screen.getByTestId("goal-name"), {
    target: { value: "My goal" },
  });
  fireEvent.submit(screen.getByTestId("goal-editor"));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].config.evaluations[0].label).toBe("Try again");
});
it("keeps a choice busy and prevents duplicate submission until its save completes", async () => {
  const { save } = setup();
  let finish!: () => void;
  save.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    })
  );
  fireEvent.click(screen.getByTestId("goal-choice-edit-0"));
  fireEvent.input(screen.getByTestId("goal-choice-label-0"), {
    target: { value: "Try again" },
  });
  const button = screen.getByTestId("goal-choice-save") as HTMLButtonElement;
  fireEvent.click(button);
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.textContent).toContain("Saving…");
  fireEvent.submit(button.closest("form")!);
  expect(save).toHaveBeenCalledOnce();
  finish();
  await waitFor(() =>
    expect(screen.queryByTestId("goal-choice-save")).toBeNull()
  );
});

it("retains choice edits when their immediate save fails", async () => {
  const { save } = setup();
  save.mockRejectedValueOnce(new Error("Settings changed"));
  fireEvent.click(screen.getByTestId("goal-choice-edit-0"));
  fireEvent.input(screen.getByTestId("goal-choice-label-0"), {
    target: { value: "Try again" },
  });
  fireEvent.click(screen.getByTestId("goal-choice-save"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Settings changed")
  );
  expect(
    (screen.getByTestId("goal-choice-label-0") as HTMLInputElement).value
  ).toBe("Try again");
});
