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
