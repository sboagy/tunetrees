## Goal-based scheduling extensions plan (subtask for this PR)

### Scope (this PR)
- Focus on goal-based scheduling extensions using the existing hook in
	[src/lib/services/practice-recording.ts](src/lib/services/practice-recording.ts#L128-L138).
- Introduce a scheduling interface modeled after `FSRSService` and implement
	it in both `FSRSService` and the plugin-backed service.
- Provide UI for installing/editing scheduling extensions (code + metadata).
- Add E2E coverage for the scheduling extension behavior and UI.
- Light polish pass (UX copy, error handling, loading states).

### Out of scope (this PR)
- Full import plugin development (beyond current rudiments).
- Extensive plugin marketplace/discovery.

### Work plan
1) **Define scheduling interface + contract**
	 - Create an interface aligned with `FSRSService` (constructor shape +
			 `processFirstReview` + `processReview`).
	 - Update `FSRSService` to implement the interface.
	 - Implement a plugin-backed scheduler that also implements the interface.
	 - Move or re-export shared types (`RecordPracticeInput`,
			 `NextReviewSchedule`, etc.) from a new interface file as needed.
	 - Decide how plugin instantiation works in QuickJS (see open questions).

2) **DB access gatekeeper for plugins**
	 - Remove direct `SqliteDatabase` usage from `FSRSService` constructor.
	 - Add a read-only query gatekeeper for plugins (SELECT-only + user scoping).
	 - Ensure the plugin runtime exposes only the gatekeeper API, not the raw DB.

3) **Schema + matching rules for goals**
	 - Add `goal` (or goals list) to `plugin` table.
	 - Extend plugin capabilities JSON to include supported goals.
	 - Update plugin matching to select by capability + goal list.
	 - Regenerate schema artifacts (codegen + formatted outputs).

4) **UI: manage scheduling extensions**
	 - Add/edit/delete scheduling plugins within the existing Plugins UI.
	 - Provide a focused “Scheduling” capability filter or view.
	 - Add validation feedback for invalid scripts / missing entry points.
	 - Add a “Test run” panel for scheduling with sample inputs.
	 - Provide a default example template (likely goal: `fluency`).

5) **Scheduling pipeline behavior**
	 - Verify that `evaluatePractice()` calls the scheduling plugin and
			 falls back to FSRS on errors or missing output.
	 - Ensure plugin can call FSRS explicitly when desired (see open questions).
	 - Surface plugin runtime errors via dismissible toast (line number if
			 available) without breaking practice flow.

6) **E2E tests**
	 - Create a scheduling plugin via UI, run a test, and save.
	 - Simulate practice evaluations over multiple days using a deterministic
			 plugin and assert expected schedule changes.
	 - Ensure fallback works when plugin throws.

7) **Polish**
	 - Copy tweaks, empty states, and basic help text.
	 - Small UX details: disable save while validating; show last run status.

8) **Docs**
	 - Update [docs/practice_flow.md](docs/practice_flow.md) to include plugin
			 scheduling path.
	 - Update [docs/reference/scheduling.md](docs/reference/scheduling.md) with
			 plugin scheduling contract and examples.

### Risks / dependencies
- Codegen + schema artifacts must stay in sync with plugin table.
- Need to keep worker sandbox safe and deterministic for tests.

### Decisions captured
- Scheduling API should mirror `FSRSService` (constructor +
	`processFirstReview` + `processReview`).
- Plugins should be able to override the full `NextReviewSchedule`.
- Add `goal` (or goals list) to `plugin` and match by goals.
- Runtime plugin errors should show a dismissible toast with details.
- Provide a default example plugin template (likely `fluency`).
- E2E should use a deterministic plugin and verify schedule outputs across days.
- QuickJS instantiation should use a factory function that returns
	`processFirstReview`/`processReview` handlers.
- Gatekeeper API should be a `queryDb(sql)` wrapper returning JSON.
- `plugin.goals` should be an array (single-goal focus for now).
- Expose an explicit `fsrsScheduler` helper for plugin fallback.
- Default template: `fluency` goal with staged cadence (daily → every other day
	→ every four days → weekly) based on repeated “Good/Easy” streaks.
- Gatekeeper allowlist tables: `practice_record`, `playlist_tune`,
	`daily_practice_queue`, `user_profile`, `prefs_scheduling_options`,
	`prefs_spaced_repetition`.
- `queryDb` should be SQL-string only (no params) for now.
- `fsrsScheduler` should mirror the full interface and be callable directly
	from plugins.
- Plugin scheduling functions should be async.
- Column access should use a disallow-list (TBD), with a 500-row limit on
	`queryDb` results.

### Open questions
- None for now.
