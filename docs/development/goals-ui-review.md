# Goals UI review — first pass

Scope: #426 goal settings, shared Settings entry points, goal assignment menus,
practice evaluation/recovery controls, mixed-goal Practice History and goal-related
Analysis. This is a feature review, not whole-app compliance. The user will inspect
this pass manually before a second review.

Baseline: `53a4d247`; this checkpoint contains the first interaction-remediation batch. Environment:
local development servers, isolated Playwright test accounts (no personal browser
access). Browser verification is in progress. The first focused run exposed router hooks in
the outside-Router overlay; those hooks were moved to a shared Router boundary.
That failed run is not counted as passing coverage.

## Findings and remediation

| Surface / entry | Rule | Expected vs observed | Evidence | Severity | Shared cause / remediation | Retest |
| --- | --- | --- | --- | --- | --- | --- |
| Settings → Goals → edit several goals | E6, F4 | One category draft/save; previously one editor and Save per goal, expansion replaced edits | Static: goals.tsx / GoalEditor.tsx at baseline | P0 | User approved category draft/shared footer; retained collapsed editors, atomic batch save | Pending |
| Settings → Goals → X/category/navigation | E2, R2 | Guard dirty/pending exits and trap modal focus; previously no dirty guard and custom nonmodal shell | Static: both Settings shells at baseline | P0 | Shared Settings shell and category registration, route/departure guard, discard confirmation | Pending |
| Goals → scheduler/help | V3, R2 | Readable help and unique associations with multiple editors; baseline help used text-xs and fixed IDs | Static: GoalEditor.tsx | P2 | text-sm help, per-editor IDs | Pending |
| Practice History → table | T1 | Numeric values aligned/tabular; baseline FSRS and ladder metrics left-aligned | Static: HistoryEventsTable.tsx | P2 | Implemented; verification pending | Not tested |
| Practice History → Add | A1, C1, L3 | Consistent action vocabulary/layout; baseline Cancel navigation and split Add header | Static: practice-history/index.tsx | P2 | Pending | Not tested |
| Practice History → Add → Cancel/navigation | E2, R2 | Unfinished entries previously discarded without confirmation | Focused desktop/mobile test | P0 | Shared draft exit guard; user approved | Pass for Cancel, Keep editing, confirmed navigation |
| Grid → goal badge | R1, V3 | Touch targets, wrapping labels and readable help; baseline compact trigger/menu | Static: GoalBadge.tsx | P2 | Pending | Not tested |
| Analysis → retention chart | R4, B3 | Text/data alternative and retry on error; baseline chart-only data and error message | Static: FsrsRetentionChart.tsx | P2 | Pending | Not tested |

## Coverage matrix

`Not tested` means no browser claim. Static findings do not establish runtime compliance.

| Surface | Editing / exits / persistence | Empty/loading/error | Keyboard/focus | 320/390/768/1280 | Light/dark | Long labels / short height / zoom / reduced motion |
| --- | --- | --- | --- | --- | --- | --- |
| Goals / both Settings entry points | Overlay batch save, collapsed edits, discard, offline plugin save: pass; direct route not tested | Validation: pass; remaining states not tested | Invalid field and safe confirmation focus: pass | Not tested | Not tested | Not tested |
| Goal assignment menus | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| Practice evaluations / recovery | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| Practice History / Add | Cancel/Keep editing/navigation discard and existing CRUD: pass | Empty/future-date validation: pass | Safe confirmation focus: pass | Not tested | Not tested | Not tested |
| Goal-related Analysis | N/A (read only) | Not tested | Not tested | Not tested | Not tested | Not tested |

Other Settings categories retain their existing save semantics; the shared shell
is checked as a representative consumer, not an audit of every category form.
No database schema or scheduler calculation changes are part of this review.

## Verification log

- Typecheck passes after the shared-draft and navigation-boundary changes.
- 44 focused unit/component/SQLite checks passed before the router-boundary
  correction: editor validation/plugin behavior, multiple-goal save, transaction
  rollback, category discard, pending saves, and failed-save draft retention.
- First browser launch stopped before Playwright due to 1Password timeout.
- Next launch reached desktop/mobile browsers and exposed the outside-Router
  hook error. Fixed at the shared boundary; targeted rerun pending.
- Practice History Add's missing dirty-exit guard is an additional E2 finding;
  user approved the guard. It now shares the Goals exit guard and has a focused
  Playwright case for Keep editing and confirmed navigation/discard.

- Subsequent desktop/mobile Goals run: 10 passed, 3 failed. Category batch save,
  collapsed draft persistence, dirty dismissal, same-day FSRS, plugin offline
  save, and custom-goal CRUD passed. Both invalid-field focus cases failed because
  `:invalid` selected a fieldset; corrected to select native input controls.
  The mobile badge test expected the collapsed navigation to be visible; it now
  checks the selected category's `aria-current` alongside visible Goals content.
- After those fixes and the shared Practice History exit guard: 46 focused tests
  pass (including retention chart data alternatives/retry), typecheck and lint pass.
  The combined desktop/mobile Goals and Practice History rerun is awaiting
  1Password authorization. These latest browser changes are not yet verified.

- Combined Goals/Practice History run: 27 passed, 2 failed on the newly extracted
  Goals confirmation focus. Removed the synchronous autofocus override and use
  the dialog primitive's deferred first-control focus (Keep editing is first).
- Targeted retest after that fix: **5 passed** (setup + both guard workflows on
  desktop and Mobile Chrome). All other combined-run cases had passed; no full
  E2E suite was run. Focused unit tests rerun: **46 passed**.
- Layout/theme/zoom/assistive verification remains outstanding; this report does
  not declare the first UI audit complete. The user authorized committing and pushing this validated checkpoint.
- User's subsequent full local E2E run: 846 passed, 61 skipped, 2 failed (the same
  old immediate-reset expectation on desktop/mobile). Updated that test for the
  approved staged Reset → Save changes contract, retaining saved-value assertions
  and adding draft-value, unchanged saved summary, and reload-persistence checks.
  No runtime change was needed. Entire `usersettings-001-forms.spec.ts` rerun:
  **23 passed** across desktop/mobile including setup; typecheck and focused Biome
  check pass. Existing Account tests include incomplete assertions, so their green
  result is not evidence of full Account validation/save compliance.
- User confirmed the subsequent full local E2E passed. Full unit rerun exposed
  four recovery tests failing before assertions because their router mock omitted
  the newly used `useBeforeLeave` hook. Updated that mock without changing the
  recovery assertions or runtime code. Full rerun: **111 files / 1462 tests pass**;
  typecheck and focused Biome check pass.
