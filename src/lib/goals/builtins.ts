import { DEFAULT_MAXIMUM_INTERVAL } from "ts-fsrs";
import { FSRS6_DEFAULT_WEIGHTS } from "ts-fsrs/models/fsrs-6";
import {
  type EvaluationChoice,
  type GoalConfig,
  type GoalScheduler,
  type LadderAction,
  parseGoalConfig,
} from "./config";

const customDailyDefaults = {
  minimum: 0,
  maximum: 2,
  autoNew: true,
  delinquencyDays: 7,
};

export interface BuiltInGoalDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  config: GoalConfig;
}

// Keep IDs aligned with the existing goal seed. Labels and all numeric defaults
// live here; migrations will serialize this source rather than duplicate it.
const ladders = [
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "initial_learn",
    displayName: "Learn",
    description:
      "Learn the tune well enough to play it through independently, without frequent prompts.",
    intervalsDays: [0.1, 0.5, 1, 2, 4],
    choices: [
      ["cannot_play", "Incomplete", "Unable to complete the tune", "reset"],
      ["prompted", "Prompted", "Needs repeated help to continue", "back"],
      [
        "effortful",
        "Effortful",
        "Completes the tune with concentration",
        "stay",
      ],
      [
        "independent",
        "Independent",
        "Completes the tune without prompts",
        "advance",
      ],
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "fluency",
    displayName: "Fluency",
    description:
      "Build smooth, accurate playing at your intended tempo, with fewer stops and less effort.",
    intervalsDays: [1, 3, 7, 14, 21],
    choices: [
      ["fragmented", "Fragmented", "Frequent stops or errors", "reset"],
      ["uneven", "Uneven", "Interruptions or inconsistent tempo", "back"],
      ["fluent", "Fluent", "Smooth and accurate at intended tempo", "stay"],
      [
        "effortless",
        "Effortless",
        "Consistently controlled at intended tempo",
        "advance",
      ],
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    name: "session_ready",
    displayName: "Session",
    description:
      "Prepare to join in confidently and keep the tune flowing when playing with others.",
    intervalsDays: [0.5, 1, 2, 3, 5],
    choices: [
      [
        "cannot_join",
        "Unready",
        "Cannot maintain the tune with others",
        "reset",
      ],
      ["loses_flow", "Faltering", "Drops out or loses the tune", "back"],
      [
        "keeps_up",
        "Following",
        "Stays with the group through the tune",
        "stay",
      ],
      [
        "session_ready",
        "Confident",
        "Plays confidently with others",
        "advance",
      ],
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    name: "performance_polish",
    displayName: "Polish",
    description:
      "Refine a familiar tune into a reliable, controlled and expressive performance.",
    intervalsDays: [2, 5, 10, 15, 21],
    choices: [
      [
        "rebuild",
        "Rebuild",
        "Fundamental problems interrupt the performance",
        "reset",
      ],
      ["inconsistent", "Inconsistent", "Control or expression varies", "back"],
      [
        "performance_ready",
        "Reliable",
        "Reliable and controlled performance",
        "stay",
      ],
      [
        "expressive",
        "Expressive",
        "Reliable performance with clear musical intent",
        "advance",
      ],
    ],
  },
] satisfies Array<{
  id: string;
  name: string;
  displayName: string;
  description: string;
  intervalsDays: number[];
  choices: Array<[string, string, string, LadderAction]>;
}>;

/** Fresh instances prevent edits to one goal from changing another's defaults. */
export function getBuiltInGoals(): BuiltInGoalDefinition[] {
  const recall: BuiltInGoalDefinition = {
    id: "00000000-0000-0000-0000-000000000001",
    name: "recall",
    displayName: "Recall",
    description:
      "Keep a learned tune available in memory so you can play it without needing a reminder.",
    config: parseGoalConfig({
      version: 1,
      daily: { minimum: 3, maximum: 10, autoNew: true, delinquencyDays: 7 },
      scheduler: {
        id: "builtin:fsrs6",
        version: 1,
        // Select FSRS-6 explicitly; the default scheduler now uses FSRS-7.
        weights: [...FSRS6_DEFAULT_WEIGHTS],
        retention: 0.9,
        maximumIntervalDays: DEFAULT_MAXIMUM_INTERVAL,
        learningStepsMinutes: [1, 10],
        relearningStepsMinutes: [10],
        fuzz: false,
      },
      evaluations: [
        {
          id: "again",
          label: "Again",
          description: "Could not recall",
          action: { kind: "fsrs", rating: 1 },
        },
        {
          id: "hard",
          label: "Hard",
          description: "Recalled with difficulty",
          action: { kind: "fsrs", rating: 2 },
        },
        {
          id: "good",
          label: "Good",
          description: "Recalled correctly",
          action: { kind: "fsrs", rating: 3 },
        },
        {
          id: "easy",
          label: "Easy",
          description: "Recalled effortlessly",
          action: { kind: "fsrs", rating: 4 },
        },
      ],
    }),
  };
  return [
    recall,
    ...ladders.map((goal) => ({
      id: goal.id,
      name: goal.name,
      displayName: goal.displayName,
      description: goal.description,
      config: parseGoalConfig({
        version: 1,
        daily: customDailyDefaults,
        scheduler: {
          id: "builtin:interval-ladder",
          version: 1,
          intervalsDays: goal.intervalsDays,
        },
        evaluations: goal.choices.map(
          ([id, label, description, kind]): EvaluationChoice => ({
            id,
            label,
            description,
            action: { kind },
          })
        ),
      }),
    })),
  ];
}

/** Generic custom-goal choices state their scheduling effect, not a skill level. */
export function getCustomGoalConfig(
  scheduler: GoalScheduler,
  createChoiceId: () => string = () => crypto.randomUUID()
): GoalConfig {
  if (scheduler.id === "plugin")
    throw new Error(
      "Plugin goal choices must come from its named action declaration"
    );
  const recall = getBuiltInGoals().find((goal) => goal.name === "recall");
  if (!recall) throw new Error("Recall defaults are unavailable");
  const evaluations: EvaluationChoice[] =
    scheduler.id === "builtin:fsrs6"
      ? recall.config.evaluations.map((choice) => ({
          ...choice,
          id: createChoiceId(),
        }))
      : (
          [
            ["reset", "Restart", "Return to the first interval"],
            ["back", "Step back", "Use the previous, shorter interval"],
            ["stay", "Keep interval", "Repeat the current interval"],
            ["advance", "Advance", "Use the next, longer interval"],
          ] satisfies Array<[LadderAction, string, string]>
        ).map(([kind, label, description]) => ({
          id: createChoiceId(),
          label,
          description,
          action: { kind },
        }));
  return parseGoalConfig({
    version: 1,
    daily: customDailyDefaults,
    scheduler,
    evaluations,
  });
}
