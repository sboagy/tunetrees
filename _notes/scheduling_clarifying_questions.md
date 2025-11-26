**Clarifying Questions** (local CoPilot chat, Todo 4)
1. FSRS parameter profile: default weights or custom? Provide current `w` array if customized.

The initial FSRS weights are established initially by `DEFAULT_FSRS_WEIGHTS` defined in #file:spaced-repetition.tsx:18-20 .  There is a signal established at #file:spaced-repetition.tsx:26-27, and the user may modify those weights in user settings.  All parameters should be settable via user-settings.  I do need to change the Maximum Interval (days), it should default to 365 days.

2. Expected first-interval ranges for brand new tunes per rating (Again/Hard/Good/Easy).

I think this is totally determined by the [FSRS Algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm).  Also see https://expertium.github.io/Algorithm.html .  The only variation that TuneTrees my bring at the moment is that we want the minimal interval to be a day, though this should really be also settable in user settings.

3. Target growth multipliers for Review-state intervals (approximate acceptable bounds).

Again, you must understand the FSRS algorithm.

4. Is Bucket 4 (Old Lapsed) enabled in production now, and what delinquency threshold defines “old”?

Test suite for the four-bucket queue algorithm:
 - Q1: Due Today
 - Q2: Recently Lapsed (0-7 days overdue)
 - Q3: New/Unscheduled (never scheduled)
 - Q4: Old Lapsed (>7 days overdue)

Or, from src/lib/services/practice-queue.ts:

 - Bucket 1: Due Today (timestamp in [startOfDayUtc, endOfDayUtc))
 - Bucket 2: Recently Lapsed (timestamp in [windowFloorUtc, startOfDayUtc))
 - Bucket 3: New/Unscheduled (never scheduled, no practice history)
 - Bucket 4: Old Lapsed (timestamp < windowFloorUtc)

As far as I know, "Bucket 4 (Old Lapsed)" scheduling is deployed.

5. Should tests simulate timezone offsets (e.g., user shifts from UTC−5 to UTC+1 mid-sequence)?

I don't think so?  I guess timezone offset primarily affects day boundries?  But I think the tests should just assume a stable UTC offset, at least for now.

6. Performance thresholds to formalize: max queue gen time for 30 tunes, max FSRS calc per tune, acceptable submission latency.

I'm primarily worried about accuracy and correct function right now.  I don't think we need to fret about performance thresholds at the moment.

7. Any known patterns for past scheduling (specific ratings, rapid submissions, clock drift, multi-tab)?

I'm not sure.

8. Should we test multi-exposure (future feature) now or defer?

I don't know what "multi-exposure" is.

9. Confirm branch strategy: integrate tests into `feat/pwa1` or keep isolated until verified.

Um, this `copilot/fix-scheduling-issues` is based from `feat/pwa1`.  Once we're happy with both fixes and tests, we'll merge this branch into `feat/pwa1`, when the time comes.


===================

I'll pull the active PR details, fetch issue 291, and read practice_flow.md to summarize next steps.

Read pull request "Add comprehensive E2E test infrastructure for FSRS scheduling validation (#292)"

Fetching issue #291 and reading practice_flow.md for scheduling context.

Fetching item [#291](https://github.com/sboagy/tunetrees/issues/291) from GitHub
Completed with input: {
  "repo": {
    "owner": "sboagy",
    "name": "tunetrees"
  },
  "issueNumber": 291
}

Reading practice_flow.md to extract scheduling flow details.

Read [](file:///Users/sboag/gittt/tunetrees/docs/practice_flow.md)

Created 6 todos

**Issue & PR Alignment**

- Issue #291 reports two core failures: (a) practice evaluations sometimes schedule tunes in the past, (b) repeated “Easy” evaluations fail to advance dates.
- Active PR focuses on comprehensive E2E test infrastructure (multi-day, multi-tune FSRS validation) on branch `copilot/fix-scheduling-issues`, while broader rewrite work is on `feat/pwa1`. We should confirm whether scheduling validation should now live directly on `feat/pwa1` or remain isolated until green.
- Current test plan (in PR) directly addresses Issue #291 subtasks: plan → infra → scenarios → fixes.

**Key Invariants To Assert (from practice_flow.md)** (Will formalize under Todo 2)
- No `practice_record.due` earlier than its `practiced` timestamp or current frozen clock.
- Intervals for successive “Good”/“Easy” on same card must be non-decreasing; “Easy” should grow faster than “Good”.
- Unsubmitted staged evaluations must override historical fields in `practice_list_staged` (COALESCE visibility).
- Queue uniqueness: (user_ref, playlist_ref, window_start_utc, tune_ref).
- After commit: transient row deleted; `daily_practice_queue.completed_at` set; `playlist_tune.current` updated to match inserted record’s due.
- Sync order: no syncDown before successful syncUp when pending items exist.
- Timestamp format consistency: window queries must match ISO and legacy space format—tests should detect mixed-format regressions.

**Required Test API Extensions** (Todo 3)
Add functions to test-api.ts:
- `getPracticeRecords(tuneIds: string[]): Promise<PracticeRecord[]>`
- `getLatestPracticeRecord(tuneId: string, playlistId: string)`
- `getScheduledDates(playlistId: string, tuneIds?: string[])`
- `getPracticeQueue(playlistId: string, windowStartUtc?: string)`
- `getPlaylistTuneRow(tuneId: string, playlistId: string)`
- `seedEvaluations(evals: Array<{tuneId:string; rating:string}>)` (batch staging helper)
- `commitEvaluations(windowStartUtc?: string)`
- `getTransientFor(tuneId: string, playlistId: string)` (verify staging presence/absence)
- `getQueueWindows(playlistId: string)` (detect dual-format window anomalies)
All must return strictly typed interfaces—no `any`.

**Clarifying Questions** (Todo 4)
1. FSRS parameter profile: default weights or custom? Provide current `w` array if customized.
2. Expected first-interval ranges for brand new tunes per rating (Again/Hard/Good/Easy).
3. Target growth multipliers for Review-state intervals (approximate acceptable bounds).
4. Is Bucket 4 (Old Lapsed) enabled in production now, and what delinquency threshold defines “old”?
5. Should tests simulate timezone offsets (e.g., user shifts from UTC−5 to UTC+1 mid-sequence)?
6. Performance thresholds to formalize: max queue gen time for 30 tunes, max FSRS calc per tune, acceptable submission latency.
7. Any known patterns for past scheduling (specific ratings, rapid submissions, clock drift, multi-tab)?
8. Should we test multi-exposure (future feature) now or defer?
9. Confirm branch strategy: integrate tests into `feat/pwa1` or keep isolated until verified.

**Immediate Implementable Steps (Todo 5) Without Answers**
- Implement test API extensions (read-only + staging/commit wrappers).
- Add integrity test: commit single evaluation and assert all side-effects (record insert, queue completed_at, transient deletion, playlist_tune.current).
- Add window format detection test: create queue, verify only ISO format going forward (fail if space-only entries appear newly).
- Implement CLOCK foundational tests already partly done—extend with rapid sequence to ensure timestamp uniqueness logic triggers (+1s bump).
- Prototype “Easy” escalation mini-test (3 consecutive days) with generic growth assertions (non-decreasing plus >1.3× somewhere) to smoke out regression now.

**Potential Root Causes (Todo 6) For Past Scheduling**
- FSRS “due” derivation using `nextCard.due` may rely on `now` with incorrect timezone or stale base date (if `now` captured before clock install).
- Mixed window formats causing queue misalignment—tune may appear due “today” repeatedly because comparison fails when scheduled stored as space format yet queue uses ISO floor.
- Duplicate timestamp resolution loop increments practiced seconds but doesn’t recompute interval—if due derived earlier relative to original practiced timestamp, might become “past” relative to incremented practiced time.
- Failure to update `playlist_tune.current` consistently if commit filtering misses some staged evaluations (e.g., transient row updated but playlist_tune not).
- Staging view COALESCE precedence causing “latest_due” to show historical (past) due if transient row cleared prematurely.
- Race: syncDown pulling older remote record overwriting a just-committed local due before UI refresh (if syncUp fails and syncDown erroneously runs).
- Interval rounding (`Math.round(nextCard.scheduled_days)`) for very short intervals (<0.5 days) after time-of-day shift could produce 0 days leading to same-day due display.

Next: I can proceed with Todo 2 (formal invariant list) and start implementing the test API scaffolding unless you’d like to answer the clarifying questions first. Let me know if you approve moving ahead with the implementation tasks now or prefer to respond to the question list. 

Would you like me to proceed with API extensions and initial invariant tests while waiting on answers?