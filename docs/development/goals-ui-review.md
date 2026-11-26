# Goals UI review

## Second design-system pass — started 2026-11-25

Baseline: `f4402cbe`, after the user completed manual review and reported local
E2E passing. Remote CI is still running; its outcome is not assumed. This pass
uses the current design contract, including independent goal/choice saves,
Close/X plus guarded Cancel, compact overlapping evaluation menus, and the
approved categorical goal colors. Earlier checkpoints below are historical.

Tracking destination: this report. Scope: Goals summary and editor, evaluation
choice editor/deletion, shared calendar, goal assignment, active/submitted
practice evaluation menus, repeat/recovery, Practice History/filter/details/Add,
and the FSRS retention chart. Shared primitives are checked through these
consumers; unrelated whole-app issues remain outside this feature audit.

Coverage starts **not tested** for this pass. Planned evidence: current source
inspection, focused Chromium/Mobile Chrome workflows, light/dark screenshots at
320/390/768/1280px and short landscape, keyboard/focus checks, and targeted
regressions for confirmed gaps. Real screen-reader output and physical on-screen
keyboard behavior require separate manual verification; do not infer them from
DOM assertions. Record findings and exact completed coverage here before handoff.

### Second-pass findings and fixes

| Surface / entry | Rules | Expected vs observed | Severity / root cause | Fix | Retest |
| --- | --- | --- | --- | --- | --- |
| Goals → Shared Practice Calendar → month arrows | A2, C1, R2 | Named icon controls also need hover/focus tooltips and ghost styling; these arrows had names only and outline styling | P2; calendar used bare icon buttons | Shared Tooltip primitives; Previous Month / Next Month labels; retain 44px targets and navigation | Six calendar unit tests pass; desktop/mobile calendar persistence, touch targets, focused tooltip and cross-month keyboard navigation pass |
| Grid → goal menu → current goal | V2, R2 | The visual checkmark must also expose selection to assistive technology; ordinary menu items had no checked state | P2; selection was rendered only as a decorative checkmark | Kobalte RadioGroup/RadioItem, retaining the existing labels, colors, checkmark and Edit Goals action | Desktop/mobile checked-state, assignment, Edit Goals entry and Escape/focus-return checks pass |

### Second-pass evidence and remaining coverage

- Baseline focused browser run: **69 passed**, Chromium and Mobile Chrome,
  `goals-001-settings-and-badge`, `goals-002-layout`, and `practice-history`.
  Log: `/tmp/426-ui-second-pass-baseline.log`. These results precede the two
  accessibility fixes above; they do not substitute for their retest.
- Calendar unit tests: **6 passed**; log `/tmp/426-ui-calendar-unit.log`.
- Post-change focused browser run: **16 passed, 1 failed**. The failed new
  desktop tooltip test used programmatic focus immediately after pointer-driven
  dialog opening. Revised it to move the pointer away, Tab from Previous Month,
  and assert focus before testing the tooltip. Its final desktop/mobile rerun
  passed (**3 including auth setup**). No assertions were removed. Logs:
  `/tmp/426-ui-access-review.log`, `/tmp/426-ui-calendar-keyboard.log`.
- Typecheck, repository lint, targeted Biome checks and `git diff --check` pass.
  Test setup also printed the existing local PostgreSQL collation-version and
  Node color-environment warnings; these are not UI failures, and no database
  maintenance or environment-wide changes were made in response.
- Source inspection covers the goal badge, calendar keyboard navigation,
  evaluation-choice dialog/save/delete controls, and goal editor field anatomy.
- Representative screenshots inspected: dark 390px goal editor; dark 320px
  populated History; light 390px goal menu; light mobile calendar; dark short
  landscape evaluation menu. The transient queue toast overlaps part of the
  last screenshot, so that capture alone is not evidence of all menu choices
  being unobstructed. Existing interaction checks exercise reachability.

| Coverage | Current result |
| --- | --- |
| Goal editing, validation, immediate choice persistence, custom scheduler offline behavior, badge assignment | Pass in baseline focused workflows; post-change badge checks also pass |
| History Add, mixed-goal filtering, readonly view, deletion, future date, guarded cancellation, return navigation | Pass in baseline focused workflows |
| Light/dark layout geometry at 320/390/768/1280px and 667×320; long labels; reduced-motion setting | Pass in baseline layout suite; representative screenshots inspected, not a pixel-baseline comparison |
| Calendar dirty guard, persistence/reload, 44px date targets | Pass in baseline suite and focused units; new tooltip/cross-month keyboard checks also pass |
| Goal/evaluation menu Escape and focus return; history information popup focus | Pass in baseline layout suite; goal checked-state retest also passes |
| Notes recovery control reachability | Pass in baseline layout suite; not every conflict/failure variant was rerun in this audit |
| Retention chart theme switching and populated layout | Pass at all five audit sizes in both themes; data disclosure keyboard operation and last-row viewport reachability also pass in the continuation |
| 200% browser zoom; physical mobile keyboard; actual screen-reader announcements | **Not tested**; viewport resizing and DOM semantics do not prove these cases |
| Full matrix of incoming edits, failed writes, denied/loading states and concurrent changes | **Not rerun in this pass**; retain existing regression coverage without claiming new audit evidence |

### Review checkpoint — 2026-11-25

The user confirmed manual inspection of these changes and a passing full local
E2E run. CodeRabbit then reviewed all seven changed files and found one valid
regression: Kobalte radio menu items default to remaining open after selection.
Explicit `closeOnSelect` restores the previous goal-assignment interaction while
retaining checked semantics. A component regression test keeps the badge mounted
and verifies assignment, menu dismissal and focus return. The focused component
run passes **7 tests** across the badge and calendar suites. Full unit validation
passes **119 files / 1,521 tests**; typecheck, lint, formatting and diff whitespace
checks pass. The full unit log also contains nine jsdom `Window.scrollTo()`
not-implemented diagnostics without test attribution; the focused badge/calendar
run is quiet. Their source is not established by this run, so this is not a claim
of diagnostic-free full-suite output. Log: `/tmp/426-second-pass-fix-all-unit.log`.
The full local E2E
result predates this final one-property correction; it has not been rerun after
that correction. Review log: `/tmp/426-second-pass-coderabbit.log`.

The user reviewed the finding/fix checkpoint and authorized committing and
pushing it before continuing the remaining audit.

This pass remains **in progress**, not a complete Q2 compliance certification.
No server was restarted and no personal browser profile was accessed.

### Continuation after checkpoint `40103243`

The accessibility checkpoint was committed and pushed as `40103243`. The user
confirmed manual inspection and a passing full local E2E run for the continuation
below, and authorized committing and pushing it on 2026-11-25.

| Surface / entry | Rules | Expected vs observed | Severity / root cause | Fix | Retest |
| --- | --- | --- | --- | --- | --- |
| Goals → Edit → Evaluation Choice | F1 | Explanation accepts an empty value but was not marked optional; mixed required/optional guidance was absent | P3; form copy did not expose the existing validation contract | Label Explanation (optional), with required-fields guidance; no validation or persistence changes | Goal editor's 14 unit cases pass, including independent choice saves and failed-save draft retention |
| Analysis → retention estimate → data disclosure | C1 | App-owned disclosure label used sentence capitalization | P3; older label predates the agreed copy convention | View Retention Estimate Data | Chart's two unit tests and desktop/mobile browser checks pass |

- Expanded the populated retention test to 320/390/768/1280px and 667×320,
  light/dark, including keyboard disclosure and data-table content. Combined
  focused browser run: **7 passed including auth setup** (also verifies the
  committed goal assignment workflow). Log `/tmp/426-ui-continuation-browser.log`.
- Strengthened the retention coverage further to explicitly scroll to and assert
  viewport reachability of both the disclosure and the last data row. This avoids
  confusing DOM visibility with unobstructed access in the docked-panel layout;
  final strengthened rerun passes on both projects in both themes (**5 passed
  including auth setup**). Log `/tmp/426-ui-retention-reachability.log`.
- Rechecked draft/recovery behavior through **18 passing component tests**:
  Goals save boundaries, pending-write exit guards, failed persistence retry,
  incoming goal updates, calendar recovery, and History failures across
  repertoire switches. Log `/tmp/426-ui-continuation-recovery.log`. These tests
  use mocked persistence and do not certify real network or screen-reader behavior.
- Editor/chart focused units: **16 passed**. No unexpected console diagnostics
  in either focused unit run. Typecheck and targeted Biome checks pass.
- Screenshot inspection confirms the last retention row is reachable at short
  landscape height. It also reveals an unrelated shared-header defect at 667px:
  repertoire text overlaps the account email (R1, P2). Recorded for the whole-app
  #600 review; no shared navigation redesign is included in this goal-specific
  batch. Evidence: `retention-667.png` in the dark Chromium populated-layout run.
- Real 200% browser zoom, physical on-screen keyboard and screen-reader output
  remain untested. Do not interpret responsive viewport tests as those checks.

### Save-feedback continuation after `924c06cf`

The preceding continuation was committed and pushed as `924c06cf` after the
user's manual inspection and full local E2E pass. Further source review found
an E3 pending-state inconsistency: evaluation-choice and calendar Save buttons
showed Saving… but retained the Save icon. Both now use the existing
reduced-motion-aware spinner pattern, expose `aria-busy`, and reserve the usual
minimum Save Changes button width. Persistence and validation are unchanged.

Typecheck, targeted Biome and diff
whitespace checks pass; all **20** goal-editor/calendar component tests pass
with no unexpected console output. Logs: `/tmp/426-ui-save-feedback-unit.log`
and `/tmp/426-ui-save-feedback-typecheck.log`. The new pending presentation has
not yet been visually verified in a browser; the user's earlier E2E result
predates this small follow-up. Remaining manual accessibility coverage above
is still outstanding. The user subsequently confirmed normal save/close behavior
by manual inspection; local saves completed too quickly to inspect the spinner.
CodeRabbit reviewed all three changed files and reported **zero findings**
(`/tmp/426-save-feedback-coderabbit.log`). Final typecheck, targeted Biome and
all 20 focused unit tests pass again, with quiet unit output. The user authorized
committing and pushing this clean review checkpoint.

### Recovery coverage closeout after `c506da58`

The save-feedback fixes were committed and pushed as `c506da58`. The user
requested continued review. Controlled pending-save component tests now hold
calendar persistence and evaluation-choice saving open, verify Saving…,
`aria-busy`, disabled commit controls and duplicate-submit protection, then
release the operation and verify the editor closes. This checks the transient
state that was too quick to inspect manually without slowing real persistence.

All **34 tests across four suites** pass: goal editing, calendar, Goals route
save/conflict/recovery boundaries, and History recovery across repertoires.
Typecheck, targeted Biome and diff whitespace checks pass; no unexpected console
diagnostics in `/tmp/426-final-audit-recovery.log`. No new production defect was
found in this continuation. The user authorized committing and pushing these
test-only changes and this report update.

This closes the controlled pending-save coverage gap, not the entire Q2 matrix.
Real browser zoom, physical on-screen keyboard, actual screen-reader output and
the full browser failure/denied/stale matrix remain unverified as listed above.
The shared-header overlap remains a separate whole-app finding. No additional
goal UI redesign is proposed from this review checkpoint.

## First-pass historical record


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

### Manual feedback round two — header help (2026-11-24)

Source: https://github.com/sboagy/tunetrees/pull/940#issuecomment-7137338740
Base: `9206ea43`; working-tree changes, existing local dev server.

- Practice History header help (T1/R2/C2): previously static headings did not
  explain recorded state. Headers now open the shared popover, including an
  explicit distinction between recorded due dates and the current schedule.
  Sorting/resizing/column visibility are unchanged.
- Verification: typecheck, focused Biome and diff whitespace checks pass.
  Five focused Playwright checks pass (setup plus populated history/retention
  layouts in light/dark on Chromium/Mobile Chrome). Added assertions for due-date
  help and Escape restoring header focus. Existing layout checks remain intact.
- Pending discussion: submitted-state checkmark/alignment, sentence-case label
  consistency, History toolbar/count/filter simplification, calendar save scope
  versus currently unsupported calendar scheduling, and choice-dialog draft scope.
  No changes to those behaviors in this checkpoint. No server restart or commit.
- Screen-reader and physical-device verification remain untested.

### Round two — immediate evaluation-choice saves (in progress)

Approved behavior: choices appear in a compact table and open a separate editing
dialog. Save Changes persists through the existing goal settings service. A new
goal is created with the choice; an existing goal retains unrelated unsaved parent
fields. Missing new-goal details preserve the choice and offer Complete Goal Details.
Parent cancellation does not undo saved choices. Deletion confirms and preserves
recorded practice. The design-system E6 exception records this save boundary.

All 1,499 unit tests pass (including 52 focused editor/route/persistence tests),
along with typecheck, lint, and formatting. Cases include missing-name recovery,
unrelated parent drafts, saved choices surviving parent Cancel, and save failure.
The authorized browser retry passed all five checks: setup plus desktop/mobile
custom-goal CRUD and named plugin actions saved offline and retained after reload.
These flows also verify that parent Cancel keeps the newly saved goal/choice.
The remaining round-two UI requests are not claimed complete by this checkpoint.

CodeRabbit reviewed this working tree. Fixed its accessible-name and E2E-wait
findings, and prevented a sync update during choice persistence from giving a stale
parent draft permission to overwrite newer data: the user must close/reopen the goal.
Its other save-lifetime questions were checked with regressions: new goals retain
their identity and change to existing-goal save scope; failed disk persistence
freezes the choice and retries persistence only; Settings navigation respects the
child draft/pending state. Final typecheck/lint/format and all 1,499 unit tests pass.
No commit/push. Focused browser verification passed; the full local E2E suite has
not been rerun for this batch.

### Round two — remaining feedback implementation

- Submitted evaluations have a compact checkmark and accessible “Submitted” label;
  their chevrons use the same right inset as unsubmitted controls.
- Practice History places Add in the Goal/filter toolbar, aligns its one session
  count and removes the redundant Clear Filters and Sessions in View controls.
- Shared Practice Calendar edits the existing days/weekly-rules/exceptions fields,
  saves through the existing preferences/sync path, guards unsaved exits and retries
  disk persistence without repeating the database update. It explicitly discloses
  that calendar rules do not yet affect scheduling; that work is tracked in #959.
- Affected menus, actions, labels and discard guards use title-style capitalization.
  This is a goal-related pass, not certification of every application string.

All 1,503 unit tests, typecheck, lint and formatting pass. New calendar tests cover
save scope, malformed JSON, guarded navigation and persistence-only retry.
The first browser launch timed out at 1Password; the authorized retry and
completed CodeRabbit results are recorded below. Existing choice-dialog browser
validation above remains valid for that earlier checkpoint.
No servers restarted and no commit/push performed.

CodeRabbit completed this follow-up review. Fixed optional calendar fields failing
to clear (explicit null now reaches SQLite), blocked Reset to Defaults while a
choice save needs persistence recovery, and invalidated old-session choice receipts
on auth/database changes. Both editor call sites already supply choice persistence;
existing retry tests verify the mutation is not repeated. A new real-SQLite test
verifies clearing/reloading all three optional calendar fields and preserving omitted
preferences. Final validation: all 1,504 unit tests across 117 files, typecheck,
lint and formatting pass. The authorized browser retry passed all 35 checks
(setup plus Chromium/Mobile Chrome): light/dark form layouts at narrow, desktop
and short-landscape sizes; populated History and retention layouts; goal menus
and recovery; calendar save/reload and guarded cancellation; and Practice Again
with its submitted accessible label and preserved history. Inspected generated
light/dark calendar and desktop History screenshots. Log:
`/tmp/426-round2-layout-retry.log`. Full local E2E has not been rerun for this batch.

### Re-practice preview comparison fix — 2026-11-24

Manual review exposed Submit rejecting Again drafts after sync/reload. Read-only
local Postgres inspection and the PostgreSQL JS client confirmed 25/24 days is
returned as 1.04166666666667, versus JS 1.0416666666666667. Exact event-content
comparison rejected that transport rounding. A SQLite-WASM staging/commit test
reproduced the same error before the fix. Event comparison now normalizes only
intervalDays to millisecond resolution; timestamps, labels and scheduler state
remain exact. Four rating regressions cover a rounded re-practice draft; an
additional regression confirms a genuine one-second interval change is rejected
without writing an event or losing the draft. No schema or database data changed.
All 1,509 unit tests, typecheck and targeted Biome checks pass. Existing drafts
can be retried after loading the updated app. Browser tests were not rerun for
this fix. Changes remain uncommitted.

### Round-two reviewed checkpoint — 2026-11-24

The user confirmed the full local E2E suite passes. A final CodeRabbit review
reported eight findings. Four referenced the old committed implementation:
both GoalEditor callers already provide independent choice saving, shared
discard labels match the tests, calendar updates preserve explicit nulls, and
the approved History toolbar explicitly uses All Goals to clear its sole filter.

Fixed the four remaining findings: calendar JSON errors now identify and focus
the invalid field; an account/database change releases obsolete calendar save
recovery and ignores late results; interval help correctly describes partial
days; checked plugin previews use the same millisecond interval normalization
as event receipts, accepting transport rounding without accepting changed dates
or state. Added regression coverage for account changes and synced plugin
intervals, and strengthened invalid-field accessibility assertions.

Post-review validation: all 1,511 unit tests across 117 files pass, as do
typecheck, lint, formatting, and diff checks. The full browser suite was not
rerun after these final review fixes. More user-requested manual UI tweaks
come next; the second design-system audit has not begun.

### Manual review: Shared Practice Calendar pickers (2026-11-25)

Settings → Goals → Shared Practice Calendar (F/E/R): weekday toggles replace the
numeric target and weekly JSON editor. Selecting weekdays derives the count;
date exceptions use an inline, multi-select month calendar. Month navigation
does not change the draft. Both selections save together, and neither changes
queue scheduling (#959). An older count without named days is preserved until
the user chooses weekdays; unsupported stored rules are not overwritten.

Focused component tests (6) and typecheck passed. Desktop/mobile browser tests
were updated but not run for this change. Visual, keyboard-only, and assistive
technology checks remain open for manual review.

### Short evaluation defaults — 2026-11-25

Practice → Evaluation chooser (C1/R): approved single-word ladder labels now
use Incomplete/Prompted/Effortful/Independent for Learn,
Unready/Faltering/Following/Confident for Session, and
Rebuild/Inconsistent/Reliable/Expressive for Polish. Recall and Fluency are
unchanged. Descriptions, IDs, action mappings, intervals, overrides and
historical snapshots are preserved.

Generated a new data-only seed migration from the canonical built-in source,
plus the two restore seeds and current-seed reference. This introduces no schema,
Worker contract, adapter or scheduling changes; old bundles can read the same
IDs/configuration shape. Existing applied migrations were not edited. As with
the earlier goal-name seed, timestamp-preserving updates require the coordinated
full download; a browser refresh alone will not pick up older local defaults.

Validation: 80 calculation/configuration tests, typecheck, focused Biome checks
and generated-seed check pass. Executed the migration in local PostgreSQL with
ROLLBACK and verified all five goals' labels. No database update was committed,
no local reset performed, and no browser/E2E run performed for this label-only
change. Uncommitted; second design-system audit has not begun.
