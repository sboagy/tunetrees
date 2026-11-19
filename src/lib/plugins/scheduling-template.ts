/** Legacy scheduler fixture for transitional runtime regression tests only. */
export const DEFAULT_PLUGIN_SCRIPT = `// TuneTrees Scheduling Plugin Template
// Define createScheduler() to return processFirstReview/processReview.

function addDays(isoDate, days) {
  const base = new Date(isoDate);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

async function getRecentQualities(queryDb, input) {
  const rows = await queryDb(
    "SELECT quality FROM practice_record " +
      "WHERE repertoire_ref = '" +
      input.repertoireRef +
      "' AND tune_ref = '" +
      input.tuneRef +
      "' ORDER BY practiced DESC LIMIT 6"
  );
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => Number(r.quality)).filter((q) => Number.isFinite(q));
}

function pickIntervalDays(qualities) {
  let goodStreak = 0;
  let easyStreak = 0;
  for (const q of qualities) {
    if (q < 3) break;
    // Easy counts only while every newer rating was Easy too.
    if (q >= 4 && easyStreak === goodStreak) easyStreak += 1;
    goodStreak += 1;
  }

  if (easyStreak >= 3) return 7; // weekly
  if (goodStreak >= 3) return 4; // every four days
  if (goodStreak >= 1) return 2; // every other day
  return 1; // daily
}

function buildSchedule(fallback, practicedIso, intervalDays) {
  return {
    ...fallback,
    nextDue: addDays(practicedIso, intervalDays),
    interval: intervalDays,
    scheduledDays: intervalDays,
    lastReview: practicedIso,
  };
}

function createScheduler({ fsrsScheduler, queryDb }) {
  async function schedule(payload) {
    const { input, fallback } = payload;
    const qualities = await getRecentQualities(queryDb, input);
    const intervalDays = pickIntervalDays([input.quality, ...qualities]);
    return buildSchedule(fallback, input.practiced, intervalDays);
  }

  return {
    async processFirstReview(payload) {
      return schedule(payload);
    },
    async processReview(payload) {
      return schedule(payload);
    },
  };
}
`;

/** Template for explicit goal-selected schedulers. The older template above is
 * retained only for transitional service tests until their removal before merge. */
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
