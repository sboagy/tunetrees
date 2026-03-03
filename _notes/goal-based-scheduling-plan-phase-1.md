# Plan: Issue #426 — User-Defined Goals, Goal Badge UX, and Scheduling Integration

<!-- DRAFT v2 — Q&A resolved 2026-02-25 -->

**TL;DR:** Add a first-class `goal` table keyed by `(name, private_for)` with system built-ins seeded at NULL owner and user-defined goals per user. Surface goal selection as an interactive dropdown badge (with a subtle `⌃` chevron) in both the practice and repertoire grids, with an "Edit Goals…" escape hatch that opens user-settings in a new `<Dialog>` modal overlay. Convert the entire user-settings shell to a Dialog modal as a prerequisite. Wire `calculateGoalSpecificDue` into the scheduling pipeline as a middle fallback between plugins and pure FSRS. Remove the hard-coded `"recall"` / `"fsrs"` strings from `handleRecallEvalChange` in [src/routes/practice/Index.tsx](../src/routes/practice/Index.tsx). The Goals settings page will also expose per-goal technique assignment (FSRS / base-interval-ladder / plugin).

---

## Part 0 — Convert user-settings to a `<Dialog>` modal overlay

This is a prerequisite for "Edit Goals…" returning the user to their in-progress session with staged evaluations intact.

**Steps**

1. Wrap `UserSettingsLayout` so the settings panel renders as a large-sheet `@kobalte/core` `Dialog` (or shadcn-solid `<Dialog>`) overlaying the current page rather than navigating away. The open/close state is managed by a new `UserSettingsDialogContext` signal (avoids polluting the URL; internal navigation between settings sub-routes still works via the router inside the Dialog).

2. Trigger the Dialog from all existing settings entry points (avatar button, gear icon, etc.) by calling `openUserSettings()` from the context. Provide an optional `openTo(tab: string)` variant so "Edit Goals…" can deep-link directly to the Goals tab.

3. On Dialog close (× button, Escape, backdrop click), the user returns to exactly where they were. In-progress staged evaluations on the practice page survive because the page was never unmounted.

4. All existing user-settings sub-routes and their internal SolidJS Router `<A>` links continue to work inside the Dialog. The new `/goals` sub-route follows the same pattern.

> **Scope note:** This refactor is isolated to routing + layout and does not touch scheduling or schema code. Including it in this PR is recommended because the "Edit Goals…" UX requires it. If timeline is constrained it can be a follow-up PR, but the goal badge "Edit Goals…" flow will be degraded without it.

---

## Part 1 — `goal` table: schema + migrations + codegen

**Steps**

5. Write Supabase/Postgres migration `supabase/migrations/20260226000000_create_goal_table.sql` defining:
   - `id` UUID PK `DEFAULT gen_random_uuid()`
   - `name` text NOT NULL
   - `private_for` text REFERENCES `user_profile(id)` NULL — NULL = system goal visible to all; non-NULL = user-private
   - `default_technique` text — one of `"fsrs"`, `"base_interval"`, or a plugin `id` string
   - `base_intervals` text — JSON array of day values; used when `default_technique = "base_interval"`; NULL otherwise
   - `deleted` integer NOT NULL DEFAULT 0
   - Standard `pgSyncColumns` (`sync_version`, `last_modified_at`, `device_id`)
   - **Unique constraint on `(name, private_for)`**
   - Seed five built-in goals with `private_for = NULL`:

     | name | default_technique | base_intervals |
     |------|-------------------|---------------|
     | `recall` | `fsrs` | NULL |
     | `initial_learn` | `base_interval` | `[0.1, 0.5, 1, 2, 4]` |
     | `fluency` | `base_interval` | `[1, 3, 7, 14, 21]` |
     | `session_ready` | `base_interval` | `[0.5, 1, 2, 3, 5]` |
     | `performance_polish` | `base_interval` | `[2, 5, 10, 15, 21]` |

6. Add `goal` table to [oosync.codegen.config.json](../oosync.codegen.config.json):
   - `changeCategoryByTable.goal = "user"`
   - Pull rule: `orEqUserIdOrTrue` on `private_for`, excluding `deleted = 1`
   - Push rule: standard upsert, `bindAuthUserIdProps: ["private_for"]`, `denyDelete: false` (soft-delete via `deleted`)

7. Run `npm run codegen:schema` to regenerate [drizzle/schema-sqlite.generated.ts](../drizzle/schema-sqlite.generated.ts), `shared/generated/sync/table-meta.generated.ts`, and worker config artifacts. Run `npm run codegen:schema:check` to verify no drift.

8. **`repertoire_tune.goal` stays as a plain name string** — no UUID FK migration needed. Goal resolution at service layer: if a row exists with `(name = goal AND private_for = userId)` use that; otherwise fall back to `(name = goal AND private_for IS NULL)`. "Private goals win" enforced in service helpers, not as a DB FK.

---

## Part 2 — Goals management page in user-settings

**Steps**

9. Create `src/routes/user-settings/goals.tsx` with:
   - **Goal list:** system goals (read-only, "Built-in" badge, `private_for IS NULL`) and user goals (editable/deletable) sorted `private_for NULLS LAST, name ASC`
   - **Add Goal form:** name (required), technique selector (see below)
   - **Edit in-place:** click a user goal row to expand inline edit of name + technique
   - **Technique selector per goal** (three mutually exclusive options):
     - `FSRS` — full spaced-repetition scheduling; `base_intervals = NULL`
     - `Base Intervals` — reveals an editable JSON array field with explanation: *"Steps advance on Good/Easy, reset on Again. The last value repeats indefinitely."*
     - `Plugin` — dropdown of enabled scheduling plugins from the `plugin` table
   - System goals display their current technique and base_intervals read-only; cannot be edited or deleted

10. Add `{ title: "Goals", href: "/user-settings/goals" }` to `sidebarNavItems` in [src/routes/user-settings/index.tsx](../src/routes/user-settings/index.tsx).

11. Lazy-import `GoalsPage` and register `<Route path="/goals" component={GoalsPage} />` inside the `/user-settings` nested block in [src/App.tsx](../src/App.tsx).

12. Add to `src/lib/db/queries/user-settings.ts`:
    - `getGoals(db, userId)` — returns system + user goals, ordered, no deleted rows
    - `upsertGoal(db, userId, goal)` — insert or update, enforcing user ownership
    - `softDeleteGoal(db, userId, goalId)` — sets `deleted = 1` on a user-owned goal only

---

## Part 3 — Interactive goal badge in practice + repertoire grids

**Steps**

13. Create `src/components/grids/GoalBadge.tsx`:
    - **Read-only** (no `onGoalChange`): renders the existing colored pill unchanged
    - **Editable** (`onGoalChange` provided): appends a small muted `⌃` chevron to the pill (innocuous indicator); wraps the pill in a `@kobalte/core` `DropdownMenu`
    - Dropdown items = goal list from `goals` prop; current goal gets a checkmark
    - Last item: separator + **"Edit Goals…"** → calls `openUserSettings("goals")` (Part 0 context)
    - Color map extended: for unrecognized goal names, derive a stable pastel color from the name string

14. Replace the static `<span>` at [TuneColumns.tsx line 506](../src/components/grids/TuneColumns.tsx#L506) with `<GoalBadge>`, threading `goals` and `onGoalChange` props through the column definition.

15. **Practice grid** (`PracticeIndex`):
    - Add `createResource` over `getGoals` to load the goals list
    - Provide `onGoalChange` callback to the column
    - Implement `handleGoalChange` (currently a TODO stub): Drizzle `update(repertoireTune).set({ goal: newGoalName })` for `tuneRef + repertoireRef`, then call `incrementPracticeListStagedChanged()`
    - Goal change does **not** trigger re-staging; new goal is picked up at the next `stagePracticeEvaluation` call
    - When goal changes, **auto-clear** any existing staged evaluation for that tune by calling `clearStagedEvaluation` in `handleGoalChange` (so the stale preview from the old goal is discarded silently)

16. **Repertoire grid**:
    - Similarly provide `onGoalChange` callback + goals list
    - If multiple rows are selected when a goal is chosen, show a confirmation popover "Apply to N tunes?" and bulk-update all selected `repertoire_tune` rows in a single transaction
    - If no multi-selection, single-row update only

17. `history` and `catalog` grids: leave `GoalBadge` read-only (no `onGoalChange` prop).

---

## Part 4 — Wire `calculateGoalSpecificDue` into the scheduling pipeline

**Steps**

18. In `evaluatePractice` ([src/lib/services/practice-recording.ts](../src/lib/services/practice-recording.ts#L90)), extend the resolution chain:

    ```
    // Plugin scheduling (if active) takes full precedence over goal heuristic and FSRS
    resolved = pluginSchedule ?? goalHeuristicSchedule ?? fsrsSchedule
    ```

    - `goalHeuristicSchedule`: populated when `goal !== "recall"` AND the goal's `base_intervals` array is non-empty (from DB row or `GOAL_BASE_INTERVALS` compile-time fallback). Calls `fsrsService.calculateGoalSpecificDue(normalizedInput, latestRecord)` for `nextDue`; constructs a partial override keeping FSRS `stability`, `difficulty`, `state`, `reps`, `lapses` from `fsrsSchedule` but replacing `nextDue` and `interval`.
    - User-defined goals with no matching `base_intervals` (technique = `"fsrs"` or unresolved) fall through to pure FSRS.

19. Export `buildGoalHeuristicOverride(fsrsSchedule: NextReviewSchedule, goalSpecificDue: Date): NextReviewSchedule` from [src/lib/scheduling/fsrs-service.ts](../src/lib/scheduling/fsrs-service.ts) for unit testability.

20. `GOAL_BASE_INTERVALS` in `fsrs-service.ts` stays as compile-time fallback for system goals. When the goal DB row provides `base_intervals`, that overrides the constant.

---

## Part 5 — Remove hardcoded goal/technique from `handleRecallEvalChange`

**Steps**

21. In `handleRecallEvalChange` ([Index.tsx](../src/routes/practice/Index.tsx)), resolve the tune's `goal` from `practiceListData()` by `tuneId` (already present via `repertoire_tune.goal` in the practice list VIEW).

22. Resolve `default_technique` from the in-memory goals map (a `createMemo` over the goals resource from step 15):
    - `"fsrs"` → pass `"fsrs"` as technique
    - `"base_interval"` → pass `"base_interval"` as technique
    - plugin ID → pass the plugin ID string as technique
    - unresolved → default to `"fsrs"`

23. Pass resolved `goal` and `technique` to `stagePracticeEvaluation`, replacing the hardcoded `"recall"` / `"fsrs"` at [Index.tsx lines 741–750](../src/routes/practice/Index.tsx#L741).

---

## Verification

- `npm run codegen:schema && npm run codegen:schema:check` passes cleanly after step 7
- `npm run lint` (Biome) passes after all edits
- `npm run test:unit`: add unit tests for `buildGoalHeuristicOverride` with `fluency` inputs; assert interval matches ladder not FSRS output
- E2E: open "Edit Goals…" from badge dropdown → Dialog opens to Goals tab → create custom goal → close Dialog → new goal appears in badge dropdown
- E2E: stage an evaluation for a tune with `goal = "fluency"` → verify `calculateGoalSpecificDue` is exercised (interval matches base-interval ladder)
- E2E: change goal on a tune that has a staged evaluation → verify staged preview is not disrupted
- E2E: multi-select rows in repertoire grid, change goal via badge → verify all selected `repertoire_tune.goal` rows updated

---

## Decisions

| # | Decision |
|---|----------|
| D1 | `goal` table uses `(name, private_for)` as the logical key; `repertoire_tune.goal` stays as a name string. No UUID FK or data migration required. |
| D2 | Unique constraint on `(name, private_for)`. A user cannot have two goals with the same name. A private goal with the same name as a system goal is allowed and takes precedence at service layer. |
| D3 | Goal badge is interactive in **practice grid** and **repertoire grid**. History and catalog grids are read-only. |
| D4 | Editable badge shows a subtle `⌃` chevron alongside the pill — no other visual change. |
| D5 | Goal change does not trigger re-staging. New goal is effective at next `stagePracticeEvaluation` call. |
| D6 | `FSRS` is a first-class user-visible technique option. Goals settings page exposes: FSRS / Base Intervals (editable ladder with explanation) / Plugin. |
| D7 | `default_technique` encodes `"fsrs"`, `"base_interval"`, or a plugin ID string. `base_intervals` JSON column stores the ladder when `default_technique = "base_interval"`. |
| D8 | Scheduling precedence: Plugin → Goal heuristic → FSRS. |
| D9 | All user-settings convert to a `<Dialog>` modal overlay (Part 0) in this PR. |
| D10 | `GOAL_BASE_INTERVALS` in `fsrs-service.ts` remains as compile-time fallback; DB `base_intervals` column overrides it when present. |
| D11 | On goal change, auto-clear any existing staged evaluation for the tune (`clearStagedEvaluation` called in `handleGoalChange`). Stale previews from the old goal are discarded silently. |
| D12 | `base_intervals` user input is validated to contain only positive numbers; sorted order is **not** required. Repeating values are valid (e.g., `[1, 1, 3, 7, 3, 7, 21, 21]`). |
| D13 | When `technique = "base_interval"` is committed to `practice_record`, goal name + technique string is sufficient. No ladder snapshot stored. |
| D14 | If Part 0 (Dialog conversion) proves significantly more complex than expected, the implementor stops and asks for direction rather than proceeding unilaterally or deferring silently. |

---

<!-- All open questions resolved 2026-02-25 -->