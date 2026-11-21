/** Template for explicit goal-selected schedulers and the developer test runner. */
export const GOAL_PLUGIN_SCRIPT = `// Select this plugin in a goal and pair evaluations with its named actions.
// Increment stateVersion when the state format changes. List only versions that
// scheduleGoalV1 actually knows how to read in compatibleStateVersions.
function describeGoalSchedulerV1() {
  return {
    apiVersion: 1,
    stateVersion: 1,
    compatibleStateVersions: [1],
    actions: [
      { id: "tomorrow", label: "Tomorrow", description: "Review in one day" },
      { id: "three-days", label: "Three days", description: "Review in three days" }
    ]
  };
}

function scheduleGoalV1(input) {
  const intervals = { tomorrow: 1, "three-days": 3 };
  const days = intervals[input.evaluation.actionId];
  if (!days) throw new Error("Choose a supported scheduling action");
  const previousCount = input.previousState?.data?.count ?? 0;
  return {
    due: new Date(Date.parse(input.practiced) + days * 86400000).toISOString(),
    state: { count: previousCount + 1 }
  };
}
`;
