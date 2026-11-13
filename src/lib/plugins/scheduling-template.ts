/** Default Fluency scheduler shared by the editor and runtime regression tests. */
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
