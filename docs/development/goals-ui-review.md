# Goals UI review — first pass

Scope: #426 Goals settings, shared Settings entry points, goal assignment menus,
practice evaluation/recovery controls, mixed-goal Practice History, and the
FSRS retention view in Analysis. This is a feature review, not a whole-app audit.

The first interaction checkpoint began at `53a4d247` and was validated/pushed in
`ce7b0492`. The visual continuation passed the developer’s full local E2E run
on 2026-11-20 and is ready for manual inspection. Testing uses existing
local development servers and isolated Playwright test accounts. No personal
browser access or dev/preview server restarts were used.

## Current findings and remediation

| Surface / entry | Rules | Expected vs observed | Severity | Fix / shared cause | Evidence and retest |
| --- | --- | --- | --- | --- | --- |
| Settings → Goals → several editors | E6, F4 | One category draft/save; previously opening another editor replaced edits | P0 | User-approved category draft, retained collapsed editors, atomic batch save and shared footer | Previous desktop/mobile Goals tests pass for batch persistence, collapsed edits and reset/save/reload |
| Settings → Goals → close/category/navigation | E2, R2 | Dirty/pending guard and modal focus; previously custom nonmodal shell lacked the guard | P0 | Shared Settings shell and Router-boundary draft exit guard | Previous tests pass for Keep editing, confirmed navigation, safe focus, pending save and failure retention |
| Goals editor fields | V3, R2 | Readable help and unique associations when several editors are open | P2 | text-sm help and per-editor IDs | Typecheck and editor tests pass; light/dark screenshots inspected |
| Goals at 320px | R1, V3 | Sections overflowed and clipped Edit: 318px content, 428px scroll width | P1 | Remove fieldset minimum-content sizing; wrap summaries; stack footer actions | Layout suite passes: content and scroll width both 318px; long-name save exercised |
| Settings at intermediate/short sizes | R1, L2 | Navigation switched at 768px; short dialog needed whole-surface scrolling | P2 | 640px navigation breakpoint and whole-dialog scrolling below 480px height | Save and Close reachable in light/dark layout suite, including 667×320 |
| Grid → goal badges | V2, V3, R1 | Compact targets/help and duplicated palette | P2 | Shared categorical palette, preserved hues, readable/wrapping labels and 44px targets | User approved V2 exception. All 14 default text/background pairs exceed 6.3:1 in both themes; menu keyboard/focus checks pass |
| History → Add | A1, L3, R3, R5 | Parent navigation said Cancel; nested card and split actions | P2 | Back navigation, green Add, one form header, native submit and themed date input | Layout suite passes; populated-history test saves an actual entry and renders its analytics |
| History → Add → Cancel/navigation | E2, R2 | Unfinished entries were discarded without confirmation | P0 | User-approved shared draft exit guard | Previous CRUD/guard tests and current layout suite pass for Cancel, Keep editing, confirmed navigation and focus |
| History → Add at 667×320 | L2, R1 | Bottom tune-details panel intercepted Add/Cancel | P1 | User-approved temporary collapse at heights ≤480px; manual expansion retained, normal-height preference preserved | Both original failures pass after fix; explicit expansion/collapse/preference-restoration test passes |
| Populated History → charts at narrow widths | T1, R1 | Chart grid's intrinsic size overflowed the surrounding view by up to 140px | P1 | Explicit one-column track and min-width constraints; table retains its own horizontal scrolling | Populated light/dark layout checks pass at all five sizes |
| History / Analysis charts | R4, R5 | Fixed gray canvas labels were dim in dark mode; no reduced-motion handling | P2 | Shared chart wrapper uses inherited theme text color, observes theme changes and respects reduced-motion media preference | Populated screenshots inspected; live-theme canvas redraw test included in final suite; data alternatives retained |
| Practice submission recovery | V3, R1 | Compact Copy/Clear targets | P2 | 44px controls | Trial clicks verify controls are genuinely reachable, not merely inside viewport bounds; acknowledgement and focus checks pass |

## Coverage and limits

`Pass` describes the named checks, not every possible state on a surface.
Historical checkpoint results below remain relevant; the developer confirmed
full local E2E passes for this visual continuation.

| Surface | Editing / persistence / recovery | Layout / themes | Keyboard / perception | Still not tested in this pass |
| --- | --- | --- | --- | --- |
| Goals / Settings | Pass: batch save, collapsed edits, reset/save/reload, offline custom goal save, dirty and pending guards, validation focus | Pass: 320/390/768/1280 and 667×320, both themes, long labels | Pass: safe confirmation focus and measured goal-palette contrast | Complete keyboard-only category editing; screen-reader announcements; real on-screen keyboard; 200% browser zoom |
| Goal assignment menus | Existing assignment/navigation test passes; current tests do not change assignment | Light/dark screenshots at all five sizes | Pass: keyboard open, Escape and focus return | Long custom-name assignment after rename; screen-reader selection announcement |
| Evaluations / recovery | Existing failure/recovery tests cover draft preservation; current suite exercises notes recovery without deleting notes | Light/dark screenshots at all five sizes | Pass: Escape/focus return, unobstructed Copy/acknowledgement/Clear controls | Screen-reader announcement timing; every error variant visually; real on-screen keyboard |
| History / Add | Pass: actual FSRS entry save; earlier tests cover mixed-goal filtering, deletion and exit guards | Pass: populated table/charts and Add at all five sizes, both themes | Data tables remain available; charts hidden from assistive technology when equivalent event details exist | Full keyboard-only table traversal; screen-reader table/chart experience; 200% browser zoom |
| Analysis retention | Read-only; previous focused checks cover data alternative and error retry | Populated light/dark screenshots at 1280px; empty-state screenshots captured earlier | Live theme redraw and reduced-motion configuration covered | Narrow Analysis layout, screen-reader data alternative, numerical model accuracy (separate issue) |

The automated/visual implementation batch has passed its checks and is ready
for the developer’s manual inspection. This is **not full Q2 compliance certification**: the explicitly
untested manual cases remain for the planned user inspection and subsequent
second review. Other Settings categories and unrelated Analysis widgets are not
being redesigned by this feature audit.

## Validation and review

- User confirmed full local E2E passed for the previous checkpoint. Its remaining
  reset test was updated for the approved staged Reset → Save contract, retaining
  saved-value assertions and adding reload checks. Four unit failures were fixed
  by supplying the existing Router hook in the recovery-test mock.
- Current full unit suite: **112 files / 1,469 tests pass**.
- Current typecheck, formatting, lint and diff whitespace checks pass.
- New persistent suite: `e2e/tests/goals-002-layout.spec.ts`. Before the latest
  review fixes, all Chromium scenarios passed across the full run plus targeted
  reruns. The initial short-height and populated-chart overflow failures were
  fixed in runtime code. A resize-related stale-row test failure was fixed using
  a trial click that waits for a reachable replacement; no forced clicks or
  weakened assertions were used.
- Final Chromium + Mobile Chrome run (31 tests including setup): **passed**.
- CodeRabbit reviewed tracked and untracked changes. Both findings were valid
  and fixed: own-property lookup for named goal colors, and respecting custom
  chart axis bindings instead of adding unused x/y axes. Seven regression tests
  cover those edges in `tests/lib/goal-ui-appearance.test.ts`.

## Evidence

- `test-results/goals-002-layout-*`: current screenshots/traces for forms,
  populated history/charts, retention, goal menus, evaluations and recovery.
- `logs/goals-ui-audit/`: earlier screenshots, contrast measurements (14 pairs
  per theme), and `coderabbit.txt` with the completed review. These artifacts are
  ignored locally; the E2E suite reproduces the visual checks.
- The chart change preserves scheduler calculations and recorded practice data.
  The palette change preserves existing built-in hues and deterministic custom
  colors. The short-height layout does not write the temporary collapsed state
  into the saved normal-height preference.


## Manual review round 1 — in progress (2026-11-20)

Source: [user review](https://github.com/sboagy/tunetrees/pull/940#issuecomment-7055146074).
Approved changes: shorter default names, violet Polish identity, independent goal dialogs (superseding the earlier category draft), read-only calendar dialog, sole-goal History default, full-row Details, and task-based Close/Cancel/Back rules. Implementation and focused validation are in progress; this is not a completed second audit.

Follow-ups: [#954](https://github.com/sboagy/tunetrees/issues/954) tracks other Settings footer/save consistency (RhizomeEcosystem, Invited Alpha); [#955](https://github.com/sboagy/tunetrees/issues/955) tracks queue removal and toolbar clarity.

Outcome colors are restored from recorded FSRS ratings/ladder actions, independently of the current goal. Custom-plugin picker choices use declared order; old plugin events do not preserve that order, so unknown historical outcomes remain neutral rather than borrowing a potentially changed definition.

Round-one validation so far: 114 unit files / 1,478 tests pass; typecheck, lint, formatting, and goal seed validation pass. Added regression coverage for return-path loops and outcome colors. CodeRabbit completed with zero findings across 30 files. The additional browser navigation scenario was added after the review started. Dialog layout and modal save/dirty-exit cases are now browser-verified. Navigation destination and focus-return checks now pass on Chromium and Mobile Chrome.

Browser retry: 83 tests ran across Chromium/Mobile Chrome; 79 passed, four failed (two cases in both browsers). History navigation, dirty-entry guards, full-row details, sole-goal analytics, and all responsive layout scenarios passed. Fixed the shared X accessible name (Kobalte supplied “Dismiss” despite visible “Close”) and changed the reset test to the stable Recall row ID because the background heading is intentionally inaccessible during modal editing; all saved-value assertions remain. Typecheck, focused Goals unit tests, and changed-file Biome checks pass. After another authorization attempt, the targeted rerun passed all five tests (setup plus both corrected scenarios on Chromium/Mobile Chrome). All previously failing cases are now confirmed; the full 83-test selection was not repeated after these two fixes. Inspected light desktop and dark narrow goal-dialog screenshots.

Focus-return follow-up: the explicit assertions reproduced lost focus in all four desktop/mobile navigation cases while URL restoration passed. Added a validated invoking-control identity to tune-task route state, preserved through History → Edit, and a one-shot ref-based focus restoration when the destination button renders. No timers or DOM polling. Typecheck, eight navigation unit tests, and changed-file Biome checks pass. The authorized post-fix browser rerun passed all five tests (setup plus Close and History → Edit → Cancel on Chromium/Mobile Chrome), including explicit original-trigger focus assertions, in 10.5 seconds.

### Ladder menu clipping — 2026-11-21

User screenshot exposed the evaluation menu’s fixed 288px cap. Removed it in favor of Kobalte’s available viewport height, with 16px viewport padding, wrapped text, and scrolling only when needed. Added a desktop/mobile regression asserting the full ladder menu fits after due estimates load, then asserting the final choice is fully visible and selectable in short landscape. All three browser tests (setup + two projects), four picker unit tests, typecheck, and changed-file Biome checks pass.

Selected evaluation label follow-up: the closed picker now displays only the goal-provided label, retaining its outcome color. Descriptions and scheduling effects remain in open menu items. Five focused picker tests, typecheck, and changed-file Biome checks pass.


### Compact evaluation chooser trial — 2026-11-21

User approved trying a bounded, compact version of the existing chooser, without a separate dialog. Choices retain their labels/colors and show a current-selection checkmark; ladder effects and relative due estimates remain visible. Explain choices reveals descriptions, full ladder semantics, and exact due times without selecting or closing. Clear evaluation is separated at the bottom. Applied V1/V3, F3, C2/C3, R2/R3; recorded the menu disclosure semantics in C3.

Six component tests pass, including keyboard disclosure without a value change and explicit clearing. Typecheck and focused Biome checks pass. Desktop/mobile layout and disclosure E2E coverage was updated, but its launch timed out at 1Password before Playwright started. Browser layout, theme, and pointer interaction verification remain pending, as does the user's visual acceptance of this trial.


Overlay placement trial: the user approved positioning the menu over its trigger, aligning the current choice where room permits. Kobalte retains viewport shifting and size constraints; actual choice heights determine alignment, with the opening offset retained during explanation disclosure. The initial browser run exposed pointerdown-open/pointerup-select on the newly overlaid option. A capture-phase opening-release guard now prevents that accidental selection without changing intentional choice activation. The expanded regression verifies unchanged value on opening/disclosure, popup overlap, selected-choice alignment (including the 16px viewport boundary), short-landscape reachability, selection, Escape, and focus restoration. Final Chromium/Mobile Chrome run: three passed (including setup). Six component tests, typecheck and focused Biome checks pass. Inspected the light-theme screenshot; broader theme/zoom audit and user acceptance remain pending. Changes remain an uncommitted trial.


Submitted-menu follow-up: shared the raised surface, bounded width, wrapping/scrolling, overlap placement, and opening-release protection with the submitted evaluation action menu. Extracted shared menu classes and positioning/pointer behavior into evaluation-menu.ts. Practice again remains an ordinary menu item; further actions need no layout redesign. Eleven unit tests, typecheck, Biome, and five focused E2E tests (setup plus chooser/layout and Practice again on Chromium/Mobile Chrome) pass, including cancellation preserving the prior completion and explicitly appending a new event.


### Full E2E regression investigation — 2026-11-21

The full local run reported 60 failures. Fifty-nine involve the shared grid or
flashcard evaluation helpers: they still expected a colon after labels (for
example `Good:`), while the approved closed-picker presentation is label-only
(`Good`). Updated both helpers to match the complete label and retained their
selection/menu/Submit checks. Also awaited existing retry delays that otherwise
continued after timed-out tests. All 1,483 unit tests, typecheck, lint, and
formatting pass. The focused browser rerun stopped at a 1Password authorization
timeout before Playwright; browser verification is still pending.

The remaining failure is Mobile Chrome sign-out in `topnav-003-user-menu`: sync
accessed SQLite after it closed. The installed oosync service's stop method only
clears periodic timers; its startup retry loop and in-flight operations can
continue, and `destroy()` does not drain them. This needs a lifecycle fix in
oosync plus awaited teardown before TuneTrees closes the database. The sync
guard remains unchanged. Awaiting the user's chosen oosync worktree; no runtime
workaround or test suppression was added.


Sign-out follow-up: the next full local run had one failure, on Chromium. This
failure contained only Playwright's unreadable-response-body error after
navigation, not the earlier closed-database errors. The logout test inherited
shared-account setup and immediately unloaded it in `gotoLogin()` to create its
disposable account. Moved logout into its own describe scope without that
unrelated setup; retained real signup/logout, redirect and shared-session
assertions, and the unchanged sync-error guard. Three repetitions each on
Chromium and Mobile Chrome passed (seven tests including setup). Typecheck and
changed-file Biome checks pass. This does not resolve or dismiss the separately
identified oosync shutdown race.


Runtime shutdown follow-up: implemented oosync's permanent `destroy()` drain in
`/Users/sboag/gittt/oosync.worktrees/426_goals_2_oo`, with regression tests for
active operations, persistence, startup retries, online listeners, periodic
outbox probes, and Realtime debounce. TuneTrees now awaits teardown before
closing SQLite/revoking credentials and serializes replacement sign-in with
cleanup. Overlapping reset/sign-out share the same outstanding drain. This is
schema-independent and applicable to main. The dependency has not been pinned
yet: oosync must be reviewed/committed/pushed first, then TuneTrees pinned before
claiming browser verification of the new runtime. Existing dev/preview servers
have not been restarted.


Shutdown review/validation: CodeRabbit reviewed both runtime repositories. Fixed
its startup retry, Realtime retry, failed-cleanup retry, and sign-out recovery
findings. Confirmed Rhizome retains the authenticated user when revocation
rejects; TuneTrees restores that user's DB only after successful cleanup.
Credential revocation is still attempted after a cleanup failure, while failed
teardown resources remain available for retry. The dependency-contract finding
is addressed in the oosync worktree and remains a rollout prerequisite until
published/pinned. Final validation: 70 oosync unit tests and 1,488 TuneTrees unit
tests pass; both repositories pass typecheck and Biome checks. No commits,
pushes, dependency changes, server restarts, or browser-validation claims for
this runtime fix.

### Anonymous sign-in after sign-out regression (2026-11-21)

After merging oosync #86, TuneTrees pins oosync `2b57c68f` and Rhizome
`9eae7d08`; all 1,488 unit tests and static/schema-contract checks pass.
The subsequent full E2E run failed anonymous re-entry on both Chromium and
Mobile Chrome. Both traces show the login route rendering, the test clicking
anonymous sign-in, then TopNav's redundant full-document `/login` navigation
reloading that form. Removed that navigation: existing auth route guards own
the redirect. This preserves the login destination (L4) without interrupting a
new action (B2). Existing E2E assertions and synchronization enforcement remain
unchanged. Typecheck and focused Biome checks pass; repeated anonymous and
registered sign-out browser verification is pending 1Password authorization.

The authorized rerun exposed a second issue after the duplicate navigation was
removed: CurrentRepertoireProvider survived sign-out and retained the previous
account's repertoire ID, leaving the fresh account on “Loading repertoire.”
It now clears selection on user-ID changes (including sign-out), while preserving
selection for auth refreshes of the same user. Three unit regression cases cover
those boundaries. No E2E assertions or waits were changed. Final verification:
13 focused Playwright tests pass (setup plus three repetitions of anonymous
re-entry and registered sign-out on Chromium and Mobile Chrome); all 1,491 unit
tests, typecheck, and focused Biome checks pass. Full local E2E remains for the
next user-run verification.

Checkpoint acceptance: the developer reports the full local CI run passing after
these fixes. Committing this evaluation-chooser and shutdown/re-entry batch for
hosted CI; manual UI review and the final design-system review remain open.
