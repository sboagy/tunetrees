import { camelizeKeys } from "oosync/sync/casing";
import { getBuiltInGoals } from "../../src/lib/goals/builtins.ts";
import { prepareGoalCutoverPlan } from "./goal-cutover/cutover-plan.ts";
import {
  prepareLegacyGoalDefinition,
  validateCustomGoalKeys,
} from "./goal-cutover/legacy-goals.ts";
import { prepareLegacyRecallSettings } from "./goal-cutover/legacy-preferences.ts";
import { prepareQueueCompletions } from "./goal-cutover/queue-completions.ts";
import {
  hasNewEventMetadata,
  prepareGoalReferenceBackfill,
} from "./goal-cutover/reference-backfill.ts";
import { legacyPreferences } from "./goal-cutover-snapshot.mjs";

function auditRecallPreferences(users, result) {
  for (const user of users) {
    try {
      const prepared = prepareLegacyRecallSettings(legacyPreferences(user));
      if (prepared === null) result.existingRecallSettingsPreserved++;
      else result.recallSettingsReady++;
    } catch {
      // Report identifiers only; do not dump saved preferences or payloads.
      result.invalidRecallPreferenceUserIds.push(user.id);
    }
  }
}

function auditGoalDefinition(goal, builtins, result) {
  if (
    goal.private_for !== null &&
    builtins.some((builtin) => builtin.name === goal.name)
  ) {
    result.collidingCustomGoalIds.push(goal.id);
  }
  const legacy =
    goal.default_config === null &&
    !builtins.some(
      (builtin) => builtin.id === goal.id && goal.private_for === null
    );
  if (legacy) result.legacyCustomGoalIds.push(goal.id);
  try {
    const prepared = prepareLegacyGoalDefinition(camelizeKeys(goal));
    if (prepared && prepared.name !== goal.name) result.customGoalKeysReady++;
    if (legacy) result.convertibleCustomGoalIds.push(goal.id);
  } catch {
    if (legacy) result.blockedLegacyGoalIds.push(goal.id);
    else result.invalidConfiguredGoalIds.push(goal.id);
  }
}

export function hasCutoverBlockers(report) {
  return (
    report.customKeyConflict ||
    report.incompleteNewEventIds.length ||
    report.stagedWork.length ||
    report.invalidRecallPreferenceUserIds.length ||
    report.blockedLegacyGoalIds.length ||
    report.collidingCustomGoalIds.length ||
    report.invalidConfiguredGoalIds.length ||
    report.missingBuiltInGoalIds.length
  );
}

/** Shared by the diagnostic audit and the one-command migration. No writes. */
export function inspectGoalCutover(snapshot) {
  const builtins = getBuiltInGoals();
  const { users, goals, references, stagedWork, queues } = snapshot;
  const result = {
    users: users.length,
    customKeyConflict: false,
    incompleteNewEventIds: references
      .filter(
        (source) =>
          source.kind === "history" &&
          source.goalId === null &&
          hasNewEventMetadata(source)
      )
      .map((source) => source.key),
    customGoalKeysReady: 0,
    stagedWork,
    stagedWorkGuidance:
      "Submit or explicitly discard pending drafts through a compatible app and synchronize all devices. An empty server table does not certify device-local work is safe.",
    recallSettingsReady: 0,
    existingRecallSettingsPreserved: 0,
    invalidRecallPreferenceUserIds: [],
    legacyCustomGoalIds: [],
    convertibleCustomGoalIds: [],
    blockedLegacyGoalIds: [],
    collidingCustomGoalIds: [],
    invalidConfiguredGoalIds: [],
    missingBuiltInGoalIds: builtins
      .filter(
        (builtin) =>
          !goals.some(
            (goal) =>
              goal.id === builtin.id &&
              goal.private_for === null &&
              !goal.deleted &&
              goal.default_config !== null
          )
      )
      .map((goal) => goal.id),
  };
  try {
    validateCustomGoalKeys(goals.map(camelizeKeys));
  } catch {
    result.customKeyConflict = true;
  }
  auditRecallPreferences(users, result);
  for (const goal of goals) auditGoalDefinition(goal, builtins, result);
  const attribution = prepareGoalReferenceBackfill(
    goals.map(camelizeKeys),
    references
  );
  const completions = prepareQueueCompletions(queues, references);
  result.queueCompletionsReady = completions.updates.length;
  result.unresolvedQueueCompletions = completions.unresolved;
  result.goalReferencesReady = attribution.updates.length;
  result.unresolvedGoalReferences = attribution.unresolved;
  return result;
}

export class GoalCutoverBlocked extends Error {
  constructor(report) {
    super("Goal cutover preflight blocked");
    this.report = report;
  }
}

export function prepareCompleteGoalCutover(snapshot) {
  const report = inspectGoalCutover(snapshot);
  if (hasCutoverBlockers(report)) throw new GoalCutoverBlocked(report);
  const plan = prepareGoalCutoverPlan(
    snapshot.goals.map(camelizeKeys),
    snapshot.users.map((user) => ({
      id: user.id,
      preferences: legacyPreferences(user),
    })),
    snapshot.references,
    snapshot.queues
  );
  return { report, plan };
}
