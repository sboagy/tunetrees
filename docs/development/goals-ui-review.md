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
