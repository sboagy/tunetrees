/**
 * Practice Queue Test Scenarios
 *
 * Helper functions to set up specific practice queue states for E2E testing.
 * Uses direct Supabase calls to manipulate database state before tests run.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * Practice scenario configurations
 */
export interface PracticeScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
}

/**
 * Get authenticated Supabase client for Alice
 * Uses Alice's test credentials from environment
 */
async function getAliceClient() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: "alice.test@tunetrees.test",
    password: process.env.ALICE_TEST_PASSWORD || "TestPassword123!",
  });

  if (error) {
    throw new Error(`Failed to authenticate Alice: ${error.message}`);
  }

  return { supabase, userId: data.user.id };
}

/**
 * Reset Alice's playlist_tune scheduled dates to NULL (unscheduled state)
 */
export async function resetScheduledDates() {
  const { supabase } = await getAliceClient();

  const { error } = await supabase
    .from("playlist_tune")
    .update({ current: null })
    .eq("playlist_ref", 9001);

  if (error) {
    throw new Error(`Failed to reset scheduled dates: ${error.message}`);
  }

  console.log("✅ Reset scheduled dates to NULL");
}

/**
 * Delete Alice's active practice queue
 */
export async function deleteActivePracticeQueue() {
  const { supabase } = await getAliceClient();

  const { error } = await supabase
    .from("daily_practice_queue")
    .delete()
    .eq("user_ref", 9001)
    .eq("playlist_ref", 9001);

  if (error) {
    throw new Error(`Failed to delete practice queue: ${error.message}`);
  }

  console.log("✅ Deleted active practice queue");
}

/**
 * Schedule Alice's tunes for practice (sets playlist_tune.current)
 *
 * @param daysAgo - How many days in the past to schedule (0 = today)
 * @param tuneRefs - Specific tune IDs to schedule (defaults to all Alice's tunes)
 */
export async function scheduleTunesForPractice(
  daysAgo: number = 0,
  tuneRefs: number[] = [9001, 9002]
) {
  const { supabase } = await getAliceClient();

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() - daysAgo);
  const scheduledStr = scheduledDate.toISOString();

  for (const tuneRef of tuneRefs) {
    const { error } = await supabase
      .from("playlist_tune")
      .update({ current: scheduledStr })
      .eq("playlist_ref", 9001)
      .eq("tune_ref", tuneRef);

    if (error) {
      throw new Error(`Failed to schedule tune ${tuneRef}: ${error.message}`);
    }
  }

  console.log(`✅ Scheduled ${tuneRefs.length} tunes (${daysAgo} days ago)`);
}

/**
 * SCENARIO: Fresh account with unscheduled tunes
 * - Tunes exist in repertoire but not scheduled for practice
 * - Practice queue should be empty
 */
export async function setupFreshAccountScenario() {
  await resetScheduledDates();
  await deleteActivePracticeQueue();
  console.log("📋 Scenario: Fresh Account (unscheduled tunes)");
}

/**
 * SCENARIO: Account with lapsed tunes (overdue for practice)
 * - Tunes scheduled 7 days ago (beyond today but within delinquency window)
 * - Should appear in Q2 (recently lapsed) bucket
 */
export async function setupLapsedTunesScenario() {
  await resetScheduledDates();
  await deleteActivePracticeQueue();
  await scheduleTunesForPractice(7); // 7 days ago
  console.log("📋 Scenario: Lapsed Tunes (7 days overdue)");
}

/**
 * SCENARIO: Account with tunes due today
 * - Tunes scheduled for today
 * - Should appear in Q1 (due today) bucket
 */
export async function setupDueTodayScenario() {
  await resetScheduledDates();
  await deleteActivePracticeQueue();
  await scheduleTunesForPractice(0); // Today
  console.log("📋 Scenario: Tunes Due Today");
}

/**
 * SCENARIO: Mixed - one tune due today, one lapsed
 */
export async function setupMixedScenario() {
  await resetScheduledDates();
  await deleteActivePracticeQueue();
  await scheduleTunesForPractice(0, [9001]); // Tune 9001 due today
  await scheduleTunesForPractice(7, [9002]); // Tune 9002 lapsed 7 days ago
  console.log("📋 Scenario: Mixed (1 due today, 1 lapsed)");
}

/**
 * Available test scenarios
 */
export const PRACTICE_SCENARIOS = {
  freshAccount: setupFreshAccountScenario,
  lapsedTunes: setupLapsedTunesScenario,
  dueToday: setupDueTodayScenario,
  mixed: setupMixedScenario,
} as const;
