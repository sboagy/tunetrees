I can’t write files while stuck in planning mode. To unblock you now, here is the exact markdown content to paste into _notes/date-rollover-banner-e2e-plan.md.

# Date Rollover Banner E2E Plan

## Overview
Define deterministic Playwright coverage for `DateRolloverBanner` to ensure correct banner visibility, queue persistence rules, queue refresh behavior, and top‑nav accessibility while the banner is visible. Tests will use `setStableDate` time control and explicit `data-testid` selectors.

## Assumptions
- We will add explicit `data-testid` hooks to the banner container and “Refresh Now” button in DateRolloverBanner.tsx, and add corresponding locators in TuneTreesPage.ts.
- Deterministic queue population is achieved with fixed test data plus `setStableDate`, and assertions must be strict (no permissive retries beyond necessary stability polling).
- On rollover with a completed queue, the banner remains hidden and a new queue is generated and displayed, consistent with practice_flow.md.

## Test Setup
- Use `setStableDate` from clock-control.ts to freeze time on a known base date, matching the pattern in scheduling-003-repeated-easy.spec.ts.
- Use deterministic practice setup via practice-scenarios.ts with a fixed repertoire and predictable due tunes.
- Ensure local storage is cleared or controlled as needed, especially keys `TT_PRACTICE_QUEUE_DATE` and `TT_PRACTICE_QUEUE_DATE_MANUAL` referenced in Index.tsx.
- Do not rely on page reload unless necessary to apply a new frozen date; if a reload is required, persist DB state before reload using the same patterns used in scheduling-003-repeated-easy.spec.ts.

## Selector Additions
- Add `data-testid` attributes to the banner container and refresh button in DateRolloverBanner.tsx.
- Add locators for these elements in TuneTreesPage.ts to keep selectors centralized.
- Use existing top‑nav selectors already defined in TuneTreesPage.ts for TuneTrees menu, Repertoire menu, DB menu, and User menu.

## Scenarios and Assertions

### 1) Banner appears on day change with incomplete queue
- Load Practice with a non‑completed queue and confirm banner is hidden.
- Advance the frozen date by one day with `setStableDate`.
- Wait for the banner to appear (respecting the component’s polling interval).
- Assert banner text and `data-testid` presence.
- Assert queue remains unchanged in both:
  - UI grid content and order.
  - Local storage keys `TT_PRACTICE_QUEUE_DATE` and `TT_PRACTICE_QUEUE_DATE_MANUAL`.

### 2) Queue persists across multiple days without refresh
- With the queue still incomplete, advance the frozen date across multiple days.
- Each day:
  - Banner appears.
  - Queue remains unchanged in UI and local storage.
- Ensure assertions are strict and deterministic, with no conditional behavior that could let the test pass on unexpected states.

### 3) “Refresh Now” hides banner and regenerates queue
- With banner visible, click “Refresh Now”.
- Assert the banner disappears.
- Assert the queue is refreshed:
  - UI grid content changes as expected for the new day.
  - Local storage `TT_PRACTICE_QUEUE_DATE` updates to the new day and `TT_PRACTICE_QUEUE_DATE_MANUAL` remains consistent with expected behavior.
- Confirm this does not require page reload unless the time‑freeze mechanism requires it.

### 4) Completed queue suppresses banner and auto‑generates new queue
- Complete the practice queue for the current day, confirming completion via UI and data.
- Advance the frozen date to the next day.
- Assert the banner does not appear.
- Assert a new queue is generated and displayed (grid repopulated), consistent with practice_flow.md.

### 5) Playlist switching preserves original queue
- With an incomplete queue in playlist A, switch to playlist B:
  - Assert the queue for playlist B is generated for the current day.
- Switch back to playlist A:
  - Assert the original queue for playlist A is restored (same tunes and order).
- If a banner is active, verify it reflects the correct date state for the active playlist.

### 6) Banner does not block top‑nav controls
- With the banner visible, verify that the following menus can be opened and interacted with:
  - TuneTrees menu.
  - Repertoire menu.
  - DB menu.
  - User menu.
- Use existing locators in TuneTreesPage.ts and assert their panels open while the banner remains visible.

## Non‑cheating Requirements
- All expectations must be deterministic and exact; no permissive retries that could mask failures.
- Polling should only be used to allow for expected UI updates and must fail if the expected state does not occur.
- Queue changes must be validated via both UI data and storage keys where feasible.