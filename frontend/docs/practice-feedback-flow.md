## Practice Feedback Submission & Scheduled Tunes Refresh Flow

High-level sequence from user clicking "Submit Practiced Tunes" (in `TunesGridScheduled.tsx`) through to refreshed scheduled tunes being displayed.

### Narrative Overview
1. User clicks the Submit Practiced Tunes button (enabled only if at least one tune has a non-empty `recall_eval`).
2. `submitPracticeFeedbacksHandler` builds an `updates` map (tune id -> `{ feedback, goal }`) from the in-memory `tunes` array / table rows.
3. If the currently selected tune equals one being submitted, it clears the current tune locally and asynchronously calls `updateCurrentTuneInDb` to persist clearing (`current_tune = -1`) in the settings service.
4. It captures the `sitdownDate` from browser storage (`getSitdownDateFromBrowser`).
5. It calls `submitPracticeFeedbacks` (client-side helper) which POSTs JSON to: `POST {TT_API_BASE_URL}/tunetrees/practice/submit_feedbacks/{playlistId}?sitdown_date=...`.
6. In parallel (fire-and-forget) it calls `deleteTableTransientData(userId, -1, playlistId, 'practice')` to purge transient per-tune scratch data (notes / recall_eval caches) from the settings service.
7. On successful feedback submission promise resolution:
   - Fires `triggerRefresh()` from `useTuneDataRefresh` context, incrementing a shared `refreshId`.
   - Shows success toast.
8. The `TunesGridScheduled` component has a `useEffect` that watches `{playlistId, refreshId}`; when `refreshId !== tunesRefreshId` it proceeds to fetch fresh scheduled tunes.
9. That effect invokes the server action `getScheduledTunesOverviewAction(userId, playlistId, sitdownDate, showDeleted, acceptableDelinquencyWindow)`.
10. The action delegates to `getScheduledTunesOverview` (server module in `queries.ts`), which validates the `sitdownDate` (must be a Date) and performs: `GET /tunetrees/scheduled_tunes_overview/{userId}/{playlistId}` with query params (`show_playlist_deleted`, `sitdown_date`, `acceptable_delinquency_window`).
11. Axios response (array of `ITuneOverviewScheduled`) is returned to the client; component sets state: `setTunes(result)` and `setTunesRefreshId(refreshId)`.
12. A separate `useEffect` on `tunes` recalculates `isSubmitEnabled` (true if any tune has `recall_eval`). UI re-renders with updated grid / flashcard panel.

### Mermaid Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant TG as TunesGridScheduled (Client React)
    participant Tbl as TanStack Table State
    participant Cfg as Settings Service (/settings)
    participant Prac as Practice API (/tunetrees/practice)
    participant SAct as Server Action getScheduledTunesOverviewAction
    participant Q as queries.ts (getScheduledTunesOverview)

    U->>TG: Click Submit Practiced Tunes
    TG->>Tbl: Iterate rows & collect recall_eval + goal
    alt Current tune among submitted
        TG->>Cfg: PATCH /table_state ... current_tune = -1 (updateCurrentTuneInDb)
    end
    TG->>Prac: POST submit_feedbacks/{playlistId}\n{ updates, sitdown_date }
    par Fire-and-forget cleanup
        TG->>Cfg: DELETE /table_transient_data/{userId}/-1/{playlistId}/practice
    and Await submission
        Prac-->>TG: 200 OK (string result)
    end
    TG->>TG: triggerRefresh() (refreshId++)
    note over TG: refreshId ≠ tunesRefreshId triggers effect
    TG->>SAct: getScheduledTunesOverviewAction(userId, playlistId, sitdownDate,...)
    SAct->>Q: getScheduledTunesOverview(...)
    Q->>Prac: GET /scheduled_tunes_overview/{userId}/{playlistId}\n?sitdown_date=...&acceptable_delinquency_window=...
    Prac-->>Q: 200 OK JSON [ITuneOverviewScheduled]
    Q-->>SAct: Array of scheduled tunes
    SAct-->>TG: Array of scheduled tunes
    TG->>TG: setTunes(result); setTunesRefreshId(refreshId)
    TG->>TG: Recompute isSubmitEnabled
    TG-->>U: Updated grid / flashcard view
```

### Key State / Identifiers
- `refreshId`: Global counter from `useTuneDataRefresh` indicating data freshness triggers.
- `tunesRefreshId`: Local memo of last applied refresh to avoid duplicate fetches.
- `updates`: Map<string, ITuneUpdate> only including tunes with a non-empty `recall_eval`.
- `acceptableDelinquencyWindow`: Passed through to backend to include slightly delinquent reviews.

### Error Handling Notes
- Submission: Catches Axios/other errors; displays toast via `handleError` without throwing.
- Fetch Scheduled: If fetch fails, logs error and sets `tunes` to empty array, ensuring UI degrades gracefully.
- Table State / Current Tune updates: Failures logged; return status 500 but do not block the main flow.

### Potential Enhancements
- Add optimistic UI clearing of submitted recall evaluations while awaiting new data.
- Bundle delete + submit into a single backend transaction to reduce race conditions.
- Surface transient delete failures in UI (currently silent aside from console log + toast).

---
Last updated: automatically generated documentation.
