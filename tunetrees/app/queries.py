import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, NamedTuple
from tunetrees.models.tunetrees_pydantic import PlaylistTuneJoinedModel

from sqlalchemy import and_, desc, func
from sqlalchemy.engine.row import Row
from sqlalchemy.orm import Query, Session
from tabulate import tabulate

from tunetrees.models.tunetrees import (
    Playlist,
    PracticeRecord,
    Tune,
    PrefsSchedulingOptions,
    t_practice_list_staged,
)

from sqlalchemy import or_

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Time / Window helper structures (extracted for reuse by queue generation)
# ---------------------------------------------------------------------------
class SchedulingWindows(NamedTuple):
    """Computed UTC windows for a user's practice sit‑down.

    start_of_day_utc : UTC midnight for the user's local day (or UTC day if no offset)
    end_of_day_utc   : Exclusive end bound (start + 1 day)
    window_floor_utc : Earliest timestamp considered 'recently lapsed'
    start_ts / end_ts / window_floor_ts : Pre-formatted timestamps (YYYY-MM-DD HH:MM:SS)
    tz_offset_minutes : Echo of input for provenance
    """

    start_of_day_utc: datetime
    end_of_day_utc: datetime
    window_floor_utc: datetime
    start_ts: str
    end_ts: str
    window_floor_ts: str
    tz_offset_minutes: Optional[int]


def compute_scheduling_windows(
    review_sitdown_date: datetime,
    acceptable_delinquency_window: int,
    local_tz_offset_minutes: Optional[int],
) -> SchedulingWindows:
    """Derive canonical UTC scheduling windows from a sit‑down instant.

    Mirrors the logic previously embedded in query_practice_list_scheduled so that
    queue generation can share identical temporal boundaries.
    """
    sitdown_utc = review_sitdown_date.astimezone(timezone.utc)
    if local_tz_offset_minutes is not None:
        offset = timedelta(minutes=local_tz_offset_minutes)
        local_dt = sitdown_utc + offset
        local_start = datetime(local_dt.year, local_dt.month, local_dt.day)
        start_of_day_utc = (local_start - offset).replace(tzinfo=timezone.utc)
    else:
        start_of_day_utc = datetime(
            sitdown_utc.year, sitdown_utc.month, sitdown_utc.day, tzinfo=timezone.utc
        )
    end_of_day_utc = start_of_day_utc + timedelta(days=1)
    window_floor_utc = start_of_day_utc - timedelta(days=acceptable_delinquency_window)

    fmt = "%Y-%m-%d %H:%M:%S"
    start_ts = start_of_day_utc.strftime(fmt)
    end_ts = end_of_day_utc.strftime(fmt)
    window_floor_ts = window_floor_utc.strftime(fmt)
    return SchedulingWindows(
        start_of_day_utc,
        end_of_day_utc,
        window_floor_utc,
        start_ts,
        end_ts,
        window_floor_ts,
        local_tz_offset_minutes,
    )


def _build_base_filters(
    user_ref: int, playlist_ref: int, show_deleted: bool, show_playlist_deleted: bool
):
    filters: list[Any] = [
        t_practice_list_staged.c.user_ref == user_ref,
        t_practice_list_staged.c.playlist_id == playlist_ref,
    ]
    if not show_deleted:
        filters.append(t_practice_list_staged.c.deleted.is_(False))
    if not show_playlist_deleted:
        filters.append(t_practice_list_staged.c.playlist_deleted.is_(False))
    return filters


def _run_phase_query(
    db: Session,
    base_filters: list[Any],
    extra_filters: list[Any],
    order_by: Any,  # Accept SQLAlchemy order by expression
    limit_remaining: Optional[int],
    skip: int,
) -> List[Row[Any]]:
    q = db.query(t_practice_list_staged).filter(and_(*(*base_filters, *extra_filters)))
    q = q.order_by(order_by)
    if limit_remaining is not None and limit_remaining > 0:
        q = q.limit(limit_remaining)
    if skip:
        q = q.offset(skip)
    return q.all()


def _append_rows_dedup(
    rows: List[Row[Any]],
    results: List[Row[Any]],
    seen_ids: set[Any],
    max_reviews: int,
) -> None:
    def _get_row_id(row: Row[Any]) -> Any:
        # Prefer attribute lookup by common keys; fall back to first column index
        for key in ("id", "tune_id", "tune_ref"):
            try:
                val = getattr(row, key)
                if val is not None:
                    return val
            except Exception:
                continue
        return row[0]

    for r in rows:
        if max_reviews != 0 and len(results) >= max_reviews:
            break
        tune_id = _get_row_id(r)
        if tune_id not in seen_ids:
            seen_ids.add(tune_id)
            results.append(r)


# ---------------------------------------------------------------------------
# Scheduling Options Preferences Helpers
# ---------------------------------------------------------------------------
# These defaults mirror the auto-create logic in preferences API endpoints.
DEFAULT_ACCEPTABLE_DELINQUENCY_WINDOW = 7  # Matches server_default on model
DEFAULT_MIN_REVIEWS_PER_DAY = 3
DEFAULT_MAX_REVIEWS_PER_DAY = 10
DEFAULT_DAYS_PER_WEEK = 7
DEFAULT_WEEKLY_RULES = "{}"  # JSON object string placeholder
DEFAULT_EXCEPTIONS = "[]"  # JSON array string placeholder


def get_prefs_scheduling_options_or_defaults(
    db: Session, user_ref: int, persist_if_missing: bool = True
) -> PrefsSchedulingOptions:
    """Fetch a user's scheduling options preferences, creating defaults if absent.

    This mirrors the behaviour of the REST endpoint /prefs_scheduling_options but is
    available internally so other backend logic (e.g. scheduling queries) can rely
    on consistent preference retrieval without an HTTP round trip.

    Args:
        db (Session): Active SQLAlchemy session.
        user_ref (int): The user id.
        persist_if_missing (bool): If True (default) a new row is inserted when
            none exists; otherwise an unsaved transient instance is returned.

    Returns:
        PrefsSchedulingOptions: The existing or default (possibly newly persisted) row.
    """
    prefs = db.get(PrefsSchedulingOptions, user_ref)
    if prefs is None:
        prefs = PrefsSchedulingOptions(
            user_id=user_ref,
            acceptable_delinquency_window=DEFAULT_ACCEPTABLE_DELINQUENCY_WINDOW,
            min_reviews_per_day=DEFAULT_MIN_REVIEWS_PER_DAY,
            max_reviews_per_day=DEFAULT_MAX_REVIEWS_PER_DAY,
            days_per_week=DEFAULT_DAYS_PER_WEEK,
            weekly_rules=DEFAULT_WEEKLY_RULES,
            exceptions=DEFAULT_EXCEPTIONS,
        )
        if persist_if_missing:
            db.add(prefs)
            # Flush to obtain defaults (though acceptable_delinquency_window already set)
            try:
                db.flush()
            except Exception as e:  # pragma: no cover - defensive logging
                logging.getLogger().error(
                    "Error persisting default PrefsSchedulingOptions for user %s: %s",
                    user_ref,
                    e,
                )
                raise
    else:
        # Backfill any NULL legacy columns with in-memory defaults (do not persist silently)
        if prefs.acceptable_delinquency_window is None:
            prefs.acceptable_delinquency_window = DEFAULT_ACCEPTABLE_DELINQUENCY_WINDOW
        if prefs.min_reviews_per_day is None:
            prefs.min_reviews_per_day = DEFAULT_MIN_REVIEWS_PER_DAY
        if prefs.max_reviews_per_day is None:
            prefs.max_reviews_per_day = DEFAULT_MAX_REVIEWS_PER_DAY
        if prefs.days_per_week is None:
            prefs.days_per_week = DEFAULT_DAYS_PER_WEEK
        if prefs.weekly_rules is None:
            prefs.weekly_rules = DEFAULT_WEEKLY_RULES
        if prefs.exceptions is None:
            prefs.exceptions = DEFAULT_EXCEPTIONS
    return prefs


def query_result_to_diagnostic_dict(
    rows: list[Any], table_name: str
) -> List[Dict[str, Any]]:
    rows_list = []
    for row in rows:
        column_names = row.metadata.tables[table_name].columns.keys()
        row_dict = {k: getattr(row, k) for k in column_names}
        rows_list.append(row_dict)
    return rows_list


def get_tune_table(
    db: Session, skip: int = 0, limit: int = 100, print_table=False
) -> List[Tune]:
    query: Query[Any] = db.query(Tune)
    rows = query.offset(skip).limit(limit).all()
    if print_table:
        rows_list = query_result_to_diagnostic_dict(rows, table_name="tune")
        print("\n----------")
        print(tabulate(rows_list, headers="keys"))
    return rows


def get_practice_record_table(
    db: Session, skip: int = 0, limit: int = 100, print_table=False
) -> List[PracticeRecord]:
    query: Query[Any] = db.query(PracticeRecord)
    rows = query.offset(skip).limit(limit).all()

    if print_table:
        rows_list = query_result_to_diagnostic_dict(rows, table_name="practice_record")
        print(tabulate(rows_list, headers="keys"))

    return rows


def get_playlist_ids_for_user(session: Session, user_ref: str) -> List[int]:
    playlist_ids = (
        session.query(Playlist.playlist_id).filter(Playlist.user_ref == user_ref).all()
    )
    return [playlist_id[0] for playlist_id in playlist_ids]


def get_most_recent_review_date(session: Session, playlist_ref: int) -> None | datetime:
    most_recent_review_date = (
        session.query(PracticeRecord)
        .filter(PracticeRecord.playlist_ref == playlist_ref)
        .order_by(desc(PracticeRecord.review_date))
        .first()
    )
    if most_recent_review_date is None:
        return None
    most_recent_review_date_str = most_recent_review_date.review_date
    most_recent_review_date = datetime.fromisoformat(most_recent_review_date_str)
    return most_recent_review_date


def get_most_recent_practiced(session: Session, playlist_ref: int):
    most_recent_practice = (
        session.query(PracticeRecord)
        .filter(PracticeRecord.playlist_ref == playlist_ref)
        .order_by(desc(PracticeRecord.practiced))
        .first()
    )
    if most_recent_practice is None:
        return None
    most_recent_practice_date_str = most_recent_practice.practiced
    most_recent_practice_date = datetime.fromisoformat(most_recent_practice_date_str)
    return most_recent_practice_date


def find_dict_index(data: list[Any], key: str, value: Any) -> int:
    for i, item in enumerate(data):
        if item[key] == value:
            return i
    return -1


def query_practice_list_scheduled(  # noqa: C901 - complexity temporarily tolerated during debug
    db: Session,
    skip: int = 0,
    review_sitdown_date: Optional[datetime] = None,
    playlist_ref: int = 1,
    user_ref: int = 1,
    show_deleted: bool = True,
    show_playlist_deleted: bool = False,
    local_tz_offset_minutes: Optional[int] = None,
    enable_backfill: bool = False,
) -> List["PlaylistTuneJoinedModel"]:
    """Daily practice list: three-phase interval-based scheduling algorithm.

    PURPOSE
    =======
    Selects a user's tunes for a practice sit‑down using an override‑aware,
    interval (time range) based algorithm with three chronologically ordered
    buckets (Q1/Q2/Q3). It respects user preferences for minimum and maximum
    daily reviews and an acceptable delinquency window that defines how far
    back we treat recently missed ("lapsed") items before resorting to older
    backlog material.

    HIGH-LEVEL FLOW
    ---------------
    1. Determine the effective "local day" boundaries for the practice session.
    - If the client supplies a timezone offset (``local_tz_offset_minutes``),
         convert the UTC sit‑down instant into that local zone, truncate to
         local midnight, then transform back to UTC to obtain ``start_of_day_utc``.
    - Else, treat the UTC calendar date of the sit‑down timestamp as the day.
    2. Construct three half‑open UTC intervals:
    Today (Q1):       [start_of_day_utc, end_of_day_utc)
    Lapsed window:    [window_floor_utc, start_of_day_utc)
    Older backlog:    (< window_floor_utc)
    where::
    end_of_day_utc     = start_of_day_utc + 1 day
    window_floor_utc   = start_of_day_utc - acceptable_delinquency_window days
    3. Execute phases in order (Q1 -> Q2 -> Q3) while enforcing capacity rules
    and deduplicating tunes.

    KEY CONCEPTS
    ------------
    Override vs Fallback:
    - ``scheduled`` (explicit future/target review time) acts as an override.
    - If ``scheduled`` is NULL we fall back to ``latest_review_date`` for both
    classification AND ordering.
    - Conceptually we operate on COALESCE(scheduled, latest_review_date).

    Buckets / Phases (detailed)
    ---------------------------
    Q1 (Due Today / On-schedule):
    Include any tune whose override or fallback timestamp lies within
    [start_of_day_utc, end_of_day_utc). These are today's due (or newly
    reviewed but still within the day) items. Order ASCENDING by the
    coalesced timestamp so earlier due items appear first.

    Q2 (Recently Lapsed):
    If capacity remains (haven't met max; still below min), include items
    whose coalesced timestamp is in the lapsed interval
    [window_floor_utc, start_of_day_utc). These were missed in the recent
    acceptable delinquency window. Order DESCENDING (most recently missed
    first) to promote catch-up while still leaning toward recency.

    Q3 (Older Backfill):
    Only if the minimum daily requirement is still unmet after Q1 & Q2.
    Pull tunes whose coalesced timestamp < window_floor_utc. Order DESCENDING
    (less old first) to avoid surfacing the stalest material before moderately
    stale items. Limit strictly to the number needed to reach the minimum (or
    remaining headroom before max, if there is a max).

    CAPACITY RULES
    --------------
    - ``min_reviews_per_day`` (min_reviews): Attempt to reach at least this many
    total tunes (across all phases). If 0, no minimum.
    - ``max_reviews_per_day`` (max_reviews): Hard cap; 0 means uncapped.
    - After each phase:
         * If max (non-zero) reached: return immediately.
         * After Q2, if min reached (or exceeded): return without Q3.

    DEDUPLICATION STRATEGY
    ----------------------
    - Maintain a set of tune identifiers (preferring id, then tune_id, then
    tune_ref). A tune selected in an earlier bucket is never added again.

    ORDERING RATIONALE
    ------------------
    - Q1 ascending: Aligns with "do earliest due first" principle.
    - Q2 & Q3 descending: Favors more recently missed/less stale material.

    PERFORMANCE NOTES
    -----------------
    - Each phase is a single filtered SELECT referencing the same staged view.
    - Early exit reduces unnecessary queries when max is already satisfied.

    FUTURE EXTENSIONS
    -----------------
    - Weekly rules / days_per_week could pre-populate future ``scheduled`` values
    powering Q1 instead of relying solely on historical latest_review_date.
    - A later refactor might merge the phase queries into a window function +
    single pass ranking, though current clarity is prioritized.

    PARAMETERS (selected)
    ---------------------
    review_sitdown_date : datetime | None
    Anchor timestamp for this session (defaults to now UTC if None).
    local_tz_offset_minutes : int | None
    Client's local offset minutes relative to UTC (e.g. -300 for UTC-5).
    Presence activates local-day mapping; absence uses UTC calendar day.

    RETURNS
    -------
    list[PlaylistTuneJoinedModel]
        Ordered merged list: Q1 (asc) + Q2 (desc) + Q3 (desc) subject to
        min/max constraints and deduplication. Each model is annotated with
        a computed ``bucket`` classification (1=due today, 2=recently lapsed,
        3=backfill) using the same window logic as the practice queue.

    INVARIANTS / GUARANTEES
    -----------------------
    - No duplicate tunes in the result.
    - Never exceeds ``max_reviews`` when non-zero.
    - If possible, reaches ``min_reviews`` by combining phases; if content is
    insufficient overall, returns all available prior to exceeding caps.
    - Lexicographical string comparison safe because timestamps formatted as
    YYYY-MM-DD HH:MM:SS.
    """
    # --- Initialization & Preferences ---
    if review_sitdown_date is None:
        review_sitdown_date = datetime.now(timezone.utc)
        logger.debug(
            "review_sitdown_date defaulted to now UTC: %s", review_sitdown_date
        )
    assert isinstance(review_sitdown_date, datetime)

    prefs_scheduling_options = get_prefs_scheduling_options_or_defaults(
        db, user_ref, persist_if_missing=False
    )
    acceptable_delinquency_window = (
        prefs_scheduling_options.acceptable_delinquency_window
    )
    min_reviews = prefs_scheduling_options.min_reviews_per_day or 0
    max_reviews = prefs_scheduling_options.max_reviews_per_day or 0  # 0 => uncapped

    # --- Time Boundaries (Option B interval: precise UTC ranges derived from local offset) ---
    sitdown_utc = review_sitdown_date.astimezone(timezone.utc)
    if local_tz_offset_minutes is not None:
        offset = timedelta(minutes=local_tz_offset_minutes)
        local_dt = sitdown_utc + offset  # convert to local
        local_start = datetime(local_dt.year, local_dt.month, local_dt.day)
        start_of_day_utc = (local_start - offset).replace(tzinfo=timezone.utc)
    else:
        start_of_day_utc = datetime(
            sitdown_utc.year, sitdown_utc.month, sitdown_utc.day, tzinfo=timezone.utc
        )
    end_of_day_utc = start_of_day_utc + timedelta(days=1)
    window_floor_utc = start_of_day_utc - timedelta(days=acceptable_delinquency_window)

    fmt = "%Y-%m-%d %H:%M:%S"
    start_ts = start_of_day_utc.strftime(fmt)
    end_ts = end_of_day_utc.strftime(fmt)
    window_floor_ts = window_floor_utc.strftime(fmt)

    logger.debug(
        "Scheduling intervals local/utc: start=%s end=%s window_floor=%s offset_minutes=%s",
        start_of_day_utc,
        end_of_day_utc,
        window_floor_utc,
        local_tz_offset_minutes,
    )

    # --- Column references ---
    scheduled_ts_col = t_practice_list_staged.c.scheduled
    latest_ts_col = t_practice_list_staged.c.latest_review_date
    coalesced_col = func.coalesce(scheduled_ts_col, latest_ts_col)

    base_filters = _build_base_filters(
        user_ref, playlist_ref, show_deleted, show_playlist_deleted
    )

    results: List[Row[Any]] = []
    seen_ids: set[Any] = set()

    # --- Q1 (Today Local) ---
    q1_filters = [
        and_(
            scheduled_ts_col.isnot(None),
            scheduled_ts_col >= start_ts,
            scheduled_ts_col < end_ts,
        )
        | and_(
            scheduled_ts_col.is_(None),
            latest_ts_col >= start_ts,
            latest_ts_col < end_ts,
        )
    ]
    q1_limit = None if max_reviews == 0 else max_reviews
    q1_rows = _run_phase_query(
        db, base_filters, q1_filters, coalesced_col.asc(), q1_limit, skip
    )
    if q1_rows:
        sample = []
        for r in q1_rows[:5]:
            sample.append(
                (
                    getattr(r, "scheduled", None)
                    or getattr(r, "latest_review_date", None)
                    or ""
                )[:19]
            )
        logger.debug(
            "Q1(today) count=%d interval=[%s,%s) sample=%s",
            len(q1_rows),
            start_ts,
            end_ts,
            sample,
        )
    _append_rows_dedup(q1_rows, results, seen_ids, max_reviews)
    if max_reviews != 0 and len(results) >= max_reviews:
        # Early exit; convert accumulated rows to models with bucket
        windows = compute_scheduling_windows(
            review_sitdown_date,
            acceptable_delinquency_window=prefs_scheduling_options.acceptable_delinquency_window,
            local_tz_offset_minutes=local_tz_offset_minutes,
        )
        annotated: List[PlaylistTuneJoinedModel] = []
        for r in results:
            m = PlaylistTuneJoinedModel.model_validate(r)
            coalesced_raw = (
                getattr(r, "scheduled", None)
                or getattr(r, "latest_review_date", None)
                or windows.start_ts
            )
            m.bucket = _classify_queue_bucket(coalesced_raw, windows)
            annotated.append(m)
        return annotated

    # --- Q2 (Lapsed Window) ---
    remaining_capacity = None if max_reviews == 0 else max_reviews - len(results)
    q2_filters = [
        and_(
            scheduled_ts_col.isnot(None),
            scheduled_ts_col >= window_floor_ts,
            scheduled_ts_col < start_ts,
        )
        | and_(
            scheduled_ts_col.is_(None),
            latest_ts_col >= window_floor_ts,
            latest_ts_col < start_ts,
        )
    ]
    q2_rows = _run_phase_query(
        db, base_filters, q2_filters, coalesced_col.desc(), remaining_capacity, skip
    )
    if q2_rows:
        sample = []
        for r in q2_rows[:5]:
            sample.append(
                (
                    getattr(r, "scheduled", None)
                    or getattr(r, "latest_review_date", None)
                    or ""
                )[:19]
            )
        logger.debug(
            "Q2(lapsed-window) count=%d window=[%s,%s) sample=%s",
            len(q2_rows),
            window_floor_ts,
            start_ts,
            sample,
        )
    _append_rows_dedup(q2_rows, results, seen_ids, max_reviews)
    if (min_reviews == 0 or len(results) >= min_reviews) or (
        max_reviews != 0 and len(results) >= max_reviews
    ):
        windows = compute_scheduling_windows(
            review_sitdown_date,
            acceptable_delinquency_window=prefs_scheduling_options.acceptable_delinquency_window,
            local_tz_offset_minutes=local_tz_offset_minutes,
        )
        annotated: List[PlaylistTuneJoinedModel] = []
        for r in results:
            m = PlaylistTuneJoinedModel.model_validate(r)
            coalesced_raw = (
                getattr(r, "scheduled", None)
                or getattr(r, "latest_review_date", None)
                or windows.start_ts
            )
            m.bucket = _classify_queue_bucket(coalesced_raw, windows)
            annotated.append(m)
        return annotated

    # --- Q3 (Backfill Older) --- (now opt-in via enable_backfill)
    if enable_backfill and min_reviews > 0 and len(results) < min_reviews:
        remaining_needed = min_reviews - len(results)
        backfill_cap = (
            remaining_needed
            if max_reviews == 0
            else min(remaining_needed, max_reviews - len(results))
        )
        if backfill_cap > 0:
            q3_filters = [
                and_(
                    scheduled_ts_col.isnot(None),
                    scheduled_ts_col < window_floor_ts,
                )
                | and_(
                    scheduled_ts_col.is_(None),
                    latest_ts_col < window_floor_ts,
                )
            ]
            q3_rows = _run_phase_query(
                db,
                base_filters,
                q3_filters,
                coalesced_col.desc(),
                backfill_cap,
                skip,
            )
            if q3_rows:
                sample = []
                for r in q3_rows[:5]:
                    sample.append(
                        (
                            getattr(r, "scheduled", None)
                            or getattr(r, "latest_review_date", None)
                            or ""
                        )[:19]
                    )
                logger.debug(
                    "Q3(backfill,opt-in) count=%d older_than<%s sample=%s",
                    len(q3_rows),
                    window_floor_ts,
                    sample,
                )
            _append_rows_dedup(q3_rows, results, seen_ids, max_reviews)

    windows = compute_scheduling_windows(
        review_sitdown_date,
        acceptable_delinquency_window=prefs_scheduling_options.acceptable_delinquency_window,
        local_tz_offset_minutes=local_tz_offset_minutes,
    )
    annotated_final: List[PlaylistTuneJoinedModel] = []
    for r in results:
        m = PlaylistTuneJoinedModel.model_validate(r)
        coalesced_raw = (
            getattr(r, "scheduled", None)
            or getattr(r, "latest_review_date", None)
            or windows.start_ts
        )
        m.bucket = _classify_queue_bucket(coalesced_raw, windows)
        annotated_final.append(m)
    return annotated_final


## ---------------------------------------------------------------------------
## Daily Practice Queue helpers (extracted to reduce complexity)
## ---------------------------------------------------------------------------


def _classify_queue_bucket(
    coalesced_raw: Optional[str], windows: SchedulingWindows
) -> int:
    """Classify timestamp vs window boundaries (robust parsing).

    See detailed rationale in previous inline docstring: we avoid lexicographic
    comparison pitfalls ("T" vs space) by parsing to ``datetime`` then comparing.
    Any parse failure returns bucket 1 (lenient default).
    """
    if not coalesced_raw:
        return 1
    raw = coalesced_raw.strip()
    norm = raw.replace("T", " ")
    norm_19 = norm[:19] if len(norm) >= 19 else norm
    dt: Optional[datetime]
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        try:
            dt = datetime.strptime(norm_19, "%Y-%m-%d %H:%M:%S")
        except Exception:
            return 1
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    if windows.start_of_day_utc <= dt < windows.end_of_day_utc:
        return 1
    if windows.window_floor_utc <= dt < windows.start_of_day_utc:
        return 2
    return 3


def _fetch_existing_active_queue(
    db: Session,
    user_ref: int,
    playlist_ref: int,
    window_start_key: str,
) -> list[
    Any
]:  # list[DailyPracticeQueue]; typed loosely to avoid circular import hints
    from sqlalchemy import select
    from tunetrees.models.tunetrees import DailyPracticeQueue

    return list(
        db.execute(
            select(DailyPracticeQueue).where(
                DailyPracticeQueue.user_ref == user_ref,
                DailyPracticeQueue.playlist_ref == playlist_ref,
                DailyPracticeQueue.window_start_utc == window_start_key,
                DailyPracticeQueue.active.is_(True),
            )
        )
        .scalars()
        .all()
    )


def _serialize_queue_rows(rows: list[Any]) -> list[dict[str, Any]]:
    # Enrich with joined tune fields (title, type, structure, learned, goal, scheduled, latest_* etc.)
    # NOTE: Fields like favorite_url, recall_eval, has_staged are sourced dynamically from the
    # staged overlay view (t_practice_list_staged). They are intentionally not persisted in the
    # DailyPracticeQueue snapshot rows to avoid duplication and potential drift; instead we rely
    # on this enrichment step so the API can return a composite PracticeQueueEntryModel.
    from sqlalchemy import select
    from tunetrees.models.tunetrees import (
        t_practice_list_staged as _t_view_staged,
    )

    if not rows:
        return []

    # Build map keyed by tune id using staged overlay view (already includes staged latest_* + recall_eval)
    tune_ids = {r.tune_ref for r in rows if getattr(r, "tune_ref", None) is not None}
    joined_map: dict[int, Any] = {}
    try:  # pragma: no cover - defensive, never fail whole serialization
        from tunetrees.app.database import SessionLocal

        with SessionLocal() as _db:  # lightweight new session
            joined_rows = (
                _db.execute(
                    select(_t_view_staged).where(_t_view_staged.c.id.in_(tune_ids))
                )
                .mappings()
                .all()
            )
            for jr in joined_rows:
                tid = jr.get("id")
                if tid is not None:
                    joined_map[int(tid)] = jr
    except Exception:  # pragma: no cover
        joined_map = {}

    enriched: list[dict[str, Any]] = []
    for r in rows:
        base = {
            "id": r.id,
            "user_ref": r.user_ref,
            "playlist_ref": r.playlist_ref,
            "mode": r.mode,
            "queue_date": r.queue_date,
            "window_start_utc": r.window_start_utc,
            "window_end_utc": r.window_end_utc,
            "tune_ref": r.tune_ref,
            "bucket": r.bucket,
            "order_index": r.order_index,
            "snapshot_coalesced_ts": r.snapshot_coalesced_ts,
            "scheduled_snapshot": r.scheduled_snapshot,
            "latest_review_date_snapshot": r.latest_review_date_snapshot,
            "acceptable_delinquency_window_snapshot": r.acceptable_delinquency_window_snapshot,
            "tz_offset_minutes_snapshot": r.tz_offset_minutes_snapshot,
            "generated_at": r.generated_at,
            "completed_at": r.completed_at,
            "exposures_required": r.exposures_required,
            "exposures_completed": r.exposures_completed,
            "outcome": r.outcome,
            "active": r.active,
        }
        jr = joined_map.get(r.tune_ref) or {}

        # Stable, explicit fields the frontend expects (provide None fallback if absent)
        # Prefix tune_* only where needed to avoid colliding with queue fields.
        base["tune_title"] = jr.get("title") if jr else None
        base["type"] = jr.get("type") if jr else None
        base["structure"] = jr.get("structure") if jr else None
        base["mode_key"] = (
            jr.get("mode") if jr else None
        )  # avoid clobbering mode (queue mode)
        base["incipit"] = jr.get("incipit") if jr else None
        base["genre"] = jr.get("genre") if jr else None
        base["learned"] = jr.get("learned") if jr else None
        base["goal"] = jr.get("goal") if jr else None
        base["scheduled"] = jr.get("scheduled") if jr else None
        base["latest_practiced"] = jr.get("latest_practiced") if jr else None
        base["latest_quality"] = jr.get("latest_quality") if jr else None
        base["latest_easiness"] = jr.get("latest_easiness") if jr else None
        base["latest_difficulty"] = jr.get("latest_difficulty") if jr else None
        base["latest_interval"] = jr.get("latest_interval") if jr else None
        base["latest_step"] = jr.get("latest_step") if jr else None
        base["latest_repetitions"] = jr.get("latest_repetitions") if jr else None
        base["latest_review_date"] = jr.get("latest_review_date") if jr else None
        base["latest_goal"] = jr.get("latest_goal") if jr else None
        base["latest_technique"] = jr.get("latest_technique") if jr else None
        base["tags"] = jr.get("tags") if jr else None
        base["playlist_deleted"] = jr.get("playlist_deleted") if jr else None
        base["notes"] = jr.get("notes") if jr else None
        base["favorite_url"] = jr.get("favorite_url") if jr else None
        base["has_override"] = jr.get("has_override") if jr else None
        base["deleted"] = jr.get("deleted") if jr else None
        base["private_for"] = jr.get("private_for") if jr else None
        # Provide tune_id separate from queue row id for clarity
        if "id" in jr:
            base["tune_id"] = jr.get("id")
        # recall_eval & has_staged from staged view
        base["recall_eval"] = jr.get("recall_eval") if jr else None
        base["has_staged"] = jr.get("has_staged") if jr else None

        enriched.append(base)
    return enriched


def _build_queue_rows(
    rows: list[Any],
    windows: SchedulingWindows,
    prefs: Any,
    user_ref: int,
    playlist_ref: int,
    mode: str,
    local_tz_offset_minutes: Optional[int],
) -> list[Any]:
    from tunetrees.models.tunetrees import DailyPracticeQueue

    results: list[DailyPracticeQueue] = []
    fmt = "%Y-%m-%d %H:%M:%S"
    for order_index, row in enumerate(rows):
        scheduled_val = getattr(row, "scheduled", None)
        latest_val = getattr(row, "latest_review_date", None)
        coalesced_raw = scheduled_val or latest_val or windows.start_ts
        bucket = _classify_queue_bucket(coalesced_raw, windows)
        results.append(
            DailyPracticeQueue(
                user_ref=user_ref,
                playlist_ref=playlist_ref,
                mode=mode,
                queue_date=windows.start_ts[:10] if mode == "per_day" else None,
                window_start_utc=windows.start_ts,
                window_end_utc=windows.end_ts,
                tune_ref=getattr(row, "id", None) or getattr(row, "tune_ref", None),
                bucket=bucket,
                order_index=order_index,
                snapshot_coalesced_ts=coalesced_raw,
                scheduled_snapshot=scheduled_val,
                latest_review_date_snapshot=latest_val,
                acceptable_delinquency_window_snapshot=prefs.acceptable_delinquency_window,
                tz_offset_minutes_snapshot=local_tz_offset_minutes,
                generated_at=datetime.now(timezone.utc).strftime(fmt),
                exposures_required=None,
                exposures_completed=0,
                outcome=None,
                active=True,
            )
        )
    return results


def _persist_queue_rows(
    db: Session,
    rows: list[Any],
    user_ref: int,
    playlist_ref: int,
    windows: SchedulingWindows,
) -> list[Any]:
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy import select
    from tunetrees.models.tunetrees import DailyPracticeQueue as DPQ

    for r in rows:
        db.add(r)
    try:
        db.commit()
        return rows
    except Exception as e:  # pragma: no cover
        db.rollback()
        if isinstance(e, IntegrityError):
            return list(
                db.execute(
                    select(DPQ).where(
                        DPQ.user_ref == user_ref,
                        DPQ.playlist_ref == playlist_ref,
                        DPQ.window_start_utc == windows.start_ts,
                        DPQ.active.is_(True),
                    )
                )
                .scalars()
                .all()
            )
        raise


# ---------------------------------------------------------------------------
# Daily Practice Queue Generation (Phase 1 - basic snapshot using existing logic)
# ---------------------------------------------------------------------------
def generate_or_get_practice_queue(
    db: Session,
    user_ref: int,
    playlist_ref: int,
    review_sitdown_date: Optional[datetime] = None,
    local_tz_offset_minutes: Optional[int] = None,
    mode: str = "per_day",
    force_regen: bool = False,
) -> list[dict[str, Any]]:
    """Generate (or fetch existing active) daily practice queue snapshot."""

    if review_sitdown_date is None:
        review_sitdown_date = datetime.now(timezone.utc)

    prefs = get_prefs_scheduling_options_or_defaults(
        db, user_ref, persist_if_missing=False
    )
    windows = compute_scheduling_windows(
        review_sitdown_date,
        acceptable_delinquency_window=prefs.acceptable_delinquency_window,
        local_tz_offset_minutes=local_tz_offset_minutes,
    )
    window_start_key = windows.start_ts

    existing = _fetch_existing_active_queue(
        db,
        user_ref=user_ref,
        playlist_ref=playlist_ref,
        window_start_key=window_start_key,
    )
    if existing and not force_regen:
        return _serialize_queue_rows(existing)

    if force_regen and existing:
        # deactivate before regenerating
        for r in existing:
            r.active = False
        try:
            db.flush()
        except Exception:  # pragma: no cover
            db.rollback()
            raise

    # NOTE: Automatic backfill (legacy Q3) disabled for initial snapshot to keep
    # the daily queue focused on due + recently lapsed material. Users can
    # explicitly request more via the refill endpoint.
    scheduled_rows = query_practice_list_scheduled(
        db,
        review_sitdown_date=review_sitdown_date,
        playlist_ref=playlist_ref,
        user_ref=user_ref,
        local_tz_offset_minutes=local_tz_offset_minutes,
        enable_backfill=False,
    )
    built = _build_queue_rows(
        scheduled_rows,
        windows,
        prefs,
        user_ref,
        playlist_ref,
        mode,
        local_tz_offset_minutes,
    )
    persisted = _persist_queue_rows(db, built, user_ref, playlist_ref, windows)
    return _serialize_queue_rows(persisted)


def get_active_practice_queue_bucket_counts(
    db: Session, user_ref: int, playlist_ref: int, window_start_utc: str
) -> dict[int, int]:
    """Return counts per bucket for the active queue window (diagnostic)."""
    from sqlalchemy import select
    from tunetrees.models.tunetrees import DailyPracticeQueue

    rows = (
        db.execute(
            select(DailyPracticeQueue.bucket).where(
                DailyPracticeQueue.user_ref == user_ref,
                DailyPracticeQueue.playlist_ref == playlist_ref,
                DailyPracticeQueue.window_start_utc == window_start_utc,
                DailyPracticeQueue.active.is_(True),
            )
        )
        .scalars()
        .all()
    )
    counts: dict[int, int] = {1: 0, 2: 0, 3: 0}
    for b in rows:
        counts[b] = counts.get(b, 0) + 1
    return counts


# ---------------------------------------------------------------------------
# Explicit Backfill / Refill Support (user-triggered)
# ---------------------------------------------------------------------------
def refill_practice_queue(
    db: Session,
    user_ref: int,
    playlist_ref: int,
    review_sitdown_date: Optional[datetime] = None,
    local_tz_offset_minutes: Optional[int] = None,
    count: int = 5,
) -> list[dict[str, Any]]:
    """Append additional older (backfill) tunes to an existing active queue snapshot.

    This replaces the previous automatic Q3 behaviour with a deliberate user action.
    Only rows whose coalesced timestamp (scheduled OR latest_review_date) lies strictly
    before the lapsed window floor (older backlog) and which are not already present
    in the active queue are eligible.

    Args:
        db: Session
        user_ref: user id
        playlist_ref: playlist id
        review_sitdown_date: anchor sit‑down (defaults to now UTC)
        local_tz_offset_minutes: optional client offset
        count: number of additional backlog tunes to append (capped >=1)

    Returns:
        list[dict[str, Any]]: Serialized newly appended queue rows (NOT the full queue).
    """
    if count <= 0:
        return []
    if review_sitdown_date is None:
        review_sitdown_date = datetime.now(timezone.utc)

    prefs = get_prefs_scheduling_options_or_defaults(
        db, user_ref, persist_if_missing=False
    )
    windows = compute_scheduling_windows(
        review_sitdown_date,
        acceptable_delinquency_window=prefs.acceptable_delinquency_window,
        local_tz_offset_minutes=local_tz_offset_minutes,
    )
    window_start_key = windows.start_ts

    existing = _fetch_existing_active_queue(
        db,
        user_ref=user_ref,
        playlist_ref=playlist_ref,
        window_start_key=window_start_key,
    )
    if not existing:
        # No active queue to refill.
        return []

    existing_tune_ids = {r.tune_ref for r in existing}
    scheduled_ts_col = t_practice_list_staged.c.scheduled
    latest_ts_col = t_practice_list_staged.c.latest_review_date
    coalesced_col = func.coalesce(scheduled_ts_col, latest_ts_col)

    # Older-than backlog filter (legacy Q3 definition)
    backlog_filters = [
        and_(
            scheduled_ts_col.isnot(None),
            scheduled_ts_col < windows.window_floor_ts,
        )
        | and_(
            scheduled_ts_col.is_(None),
            latest_ts_col < windows.window_floor_ts,
        )
    ]
    base_filters = _build_base_filters(
        user_ref=user_ref,
        playlist_ref=playlist_ref,
        show_deleted=True,
        show_playlist_deleted=False,
    )
    backlog_rows = _run_phase_query(
        db, base_filters, backlog_filters, coalesced_col.desc(), None, 0
    )
    # Filter out tunes already present & cap to count
    new_rows_raw: list[Any] = []
    for r in backlog_rows:
        tune_id = getattr(r, "id", None) or getattr(r, "tune_ref", None)
        if tune_id in existing_tune_ids:
            continue
        new_rows_raw.append(r)
        if len(new_rows_raw) >= count:
            break

    if not new_rows_raw:
        return []

    # Determine next order_index start
    max_order = max((r.order_index for r in existing), default=-1)
    built = _build_queue_rows(
        new_rows_raw,
        windows,
        prefs,
        user_ref,
        playlist_ref,
        mode="per_day",
        local_tz_offset_minutes=local_tz_offset_minutes,
    )
    # Adjust order indices to append sequentially
    for offset, row in enumerate(built):
        row.order_index = max_order + 1 + offset

    persisted = _persist_queue_rows(db, built, user_ref, playlist_ref, windows)
    return _serialize_queue_rows(persisted)


# ---------------------------------------------------------------------------
# Explicit Add (manual override) from Repertoire into active queue
# ---------------------------------------------------------------------------
def add_tunes_to_practice_queue(  # noqa: C901 - complexity accepted for now (mirrors other scheduling helpers)
    db: Session,
    user_ref: int,
    playlist_ref: int,
    tune_ids: list[int],
    review_sitdown_date: Optional[datetime] = None,
    local_tz_offset_minutes: Optional[int] = None,
) -> dict[str, Any]:
    """Manually add (or surface) specific tunes into today's active practice queue.

    Behaviour (agreed specification):
      * Always set PlaylistTune.scheduled to the sitdown moment for tunes NOT already present
        in the active queue (priority explicit override) regardless of previous value.
      * Do NOT modify scheduled for tunes already present in the queue (idempotent no-op).
      * Insert new queue rows with bucket derived from the scheduled timestamp (will be 1)
        and priority ordering (appear before existing rows). Existing rows have their
        order_index shifted uniformly to preserve relative order.
      * Exceeding max_reviews_per_day preference is allowed (user explicit override).
      * Skips deleted / missing PlaylistTune rows silently.

    Returns structure with bookkeeping for client toast / UX:
        {
          'added': [<serialized_new_queue_rows>],
          'skipped_existing': [tune_id...],  # already in queue
          'missing': [tune_id...],           # no playlist_tune row or deleted
          'duplicate_request_ignored': [tune_id...],  # duplicates inside payload
        }
    """
    if not tune_ids:
        return {
            "added": [],
            "skipped_existing": [],
            "missing": [],
            "duplicate_request_ignored": [],
        }
    if review_sitdown_date is None:
        review_sitdown_date = datetime.now(timezone.utc)

    # Deduplicate input while preserving order
    seen_in_payload: set[int] = set()
    deduped: list[int] = []
    dup_ignored: list[int] = []
    for tid in tune_ids:
        if tid in seen_in_payload:
            dup_ignored.append(tid)
            continue
        seen_in_payload.add(tid)
        deduped.append(tid)

    prefs = get_prefs_scheduling_options_or_defaults(
        db, user_ref, persist_if_missing=False
    )
    windows = compute_scheduling_windows(
        review_sitdown_date,
        acceptable_delinquency_window=prefs.acceptable_delinquency_window,
        local_tz_offset_minutes=local_tz_offset_minutes,
    )
    window_start_key = windows.start_ts

    existing_active = _fetch_existing_active_queue(
        db,
        user_ref=user_ref,
        playlist_ref=playlist_ref,
        window_start_key=window_start_key,
    )

    # If no active queue yet, generate a base snapshot (without backfill) so priority insert semantics are consistent.
    if not existing_active:
        generate_or_get_practice_queue(
            db,
            user_ref=user_ref,
            playlist_ref=playlist_ref,
            review_sitdown_date=review_sitdown_date,
            local_tz_offset_minutes=local_tz_offset_minutes,
            force_regen=False,
        )
        # Refetch as model instances
        existing_active = _fetch_existing_active_queue(
            db,
            user_ref=user_ref,
            playlist_ref=playlist_ref,
            window_start_key=window_start_key,
        )

    existing_tune_ids = {r.tune_ref for r in existing_active}

    from tunetrees.models.tunetrees import (
        PlaylistTune,
        DailyPracticeQueue,
    )  # local import to avoid cycle

    fmt = "%Y-%m-%d %H:%M:%S"
    scheduled_override = review_sitdown_date.astimezone(timezone.utc).strftime(fmt)

    skipped_existing: list[int] = []
    missing: list[int] = []
    to_add: list[int] = []

    # Collect playlist_tune rows to update scheduled (only for those not already in queue)
    for tid in deduped:
        if tid in existing_tune_ids:
            skipped_existing.append(tid)
            continue
        pt = (
            db.query(PlaylistTune)
            .filter(
                PlaylistTune.playlist_ref == playlist_ref,
                PlaylistTune.tune_ref == tid,
                PlaylistTune.deleted.is_(False),
            )
            .first()
        )
        if not pt:
            missing.append(tid)
            continue
        # Set scheduled override (unconditional for new additions)
        pt.scheduled = scheduled_override
        to_add.append(tid)

    # Shift existing order_index upward to make room for priority insert (maintain relative ordering)
    if to_add and existing_active:
        shift = len(to_add)
        for row in existing_active:
            row.order_index = row.order_index + shift

    # Build new queue rows
    new_queue_rows: list[DailyPracticeQueue] = []
    for idx, tid in enumerate(to_add):
        bucket = _classify_queue_bucket(scheduled_override, windows)
        new_queue_rows.append(
            DailyPracticeQueue(
                user_ref=user_ref,
                playlist_ref=playlist_ref,
                window_start_utc=windows.start_ts,
                window_end_utc=windows.end_ts,
                tune_ref=tid,
                bucket=bucket,
                order_index=idx,  # priority at front
                snapshot_coalesced_ts=scheduled_override,
                generated_at=scheduled_override,  # reuse timestamp; acceptable for diagnostics
                mode="per_day",
                queue_date=windows.start_ts[:10],
                scheduled_snapshot=scheduled_override,
                latest_review_date_snapshot=None,
                acceptable_delinquency_window_snapshot=prefs.acceptable_delinquency_window,
                tz_offset_minutes_snapshot=local_tz_offset_minutes,
                completed_at=None,
                exposures_required=None,
                exposures_completed=0,
                outcome=None,
                active=True,
            )
        )
        db.add(new_queue_rows[-1])

    # Persist
    try:
        db.commit()
    except Exception:  # pragma: no cover - defensive
        db.rollback()
        raise

    serialized_new = _serialize_queue_rows(new_queue_rows) if new_queue_rows else []
    return {
        "added": serialized_new,
        "skipped_existing": skipped_existing,
        "missing": missing,
        "duplicate_request_ignored": dup_ignored,
    }


def query_practice_list_scheduled_original(
    db: Session,
    skip: int = 0,
    limit: int = 16,
    print_table=False,
    review_sitdown_date: Optional[datetime] = None,
    acceptable_delinquency_window: Optional[int] = None,
    playlist_ref=1,
    user_ref=1,
    show_deleted=True,
    show_playlist_deleted=False,
) -> List[Row[Any]]:
    """Get a list of tunes to practice on the review_sitdown_date.

    FIXED: Now uses playlist_tune.scheduled column for filtering with fallback to practice_record.latest_review_date.
    This ensures scheduling is based on the current scheduled date (mutable) when available, but gracefully
    falls back to historical practice record data during the transition period when scheduled column may be null.

    Uses the practice_list_staged view to get all tunes scheduled between the
    acceptable_delinquency_window and review_sitdown_date, limited by the `limit` parameter.

    Args:
        db (Session): Database session
        skip (int, optional): Number of results to skip for pagination. Defaults to 0.
        limit (int, optional): Maximum number of results to return. Defaults to 16.
        print_table (bool, optional): Whether to print debug table. Defaults to False.
        review_sitdown_date (datetime, optional): Target practice date. Defaults to now().
        acceptable_delinquency_window (int, optional): Days before sitdown_date to include. Defaults to 7.
        playlist_ref (int, optional): The playlist ID to filter on. Defaults to 1.
        user_ref (int, optional): The user ID to filter on. Defaults to 1.
        show_deleted (bool, optional): Whether to include deleted tunes. Defaults to True.
        show_playlist_deleted (bool, optional): Whether to include tunes from deleted playlists. Defaults to False.

    Returns:
        List[Row[Any]]: Tunes scheduled for practice within the specified time window.
    """
    if review_sitdown_date is None:
        review_sitdown_date = datetime.now(timezone.utc)
        print("review_sitdown_date is None, using today: ", review_sitdown_date)
    else:
        print("review_sitdown_date: ", review_sitdown_date)

    assert isinstance(review_sitdown_date, datetime)

    # This is really strange, but it seems to be necessary to add a
    # day to the review_sitdown_date to get this to agree with the
    # older code. I don't know why this is necessary!  Probably
    # a bad hack.
    # review_sitdown_date = review_sitdown_date + timedelta(days=1)
    print("review_sitdown_date: ", review_sitdown_date)

    prefs_scheduling_options = get_prefs_scheduling_options_or_defaults(
        db, user_ref, persist_if_missing=False
    )
    effective_window = (
        acceptable_delinquency_window
        if acceptable_delinquency_window is not None
        else prefs_scheduling_options.acceptable_delinquency_window
        or DEFAULT_ACCEPTABLE_DELINQUENCY_WINDOW
    )
    lower_bound_date = review_sitdown_date - timedelta(days=effective_window)

    # Create the query - FIXED: Use scheduled column with fallback to latest_review_date
    # This handles the transition period where scheduled column may be null
    try:
        # Base time column used for inclusion window (scheduled date or latest/next review date)
        base_time_col = func.coalesce(
            t_practice_list_staged.c.scheduled,
            t_practice_list_staged.c.latest_review_date,
        )

        # We normally include tunes whose (scheduled OR latest_review_date) fall inside the window.
        # However, when a tune is "staged" we have already computed a *future* next review date and
        # overlaid it into latest_review_date. That would prematurely exclude the row from the
        # current practice list after a refresh (user complaint: rows disappear immediately after staging).
        # Fix: add an OR branch that keeps staged rows visible based on their practiced timestamp
        # (which represents the current sitdown) even if the newly staged next review date is in the future.
        # This preserves visibility until the user commits (or clears) the staged feedback.

        staged_visibility_predicate = and_(
            t_practice_list_staged.c.has_staged == 1,
            # latest_practiced is overlaid with the sitdown_date when staging.
            t_practice_list_staged.c.latest_practiced
            <= review_sitdown_date.strftime("%Y-%m-%d %H:%M:%S"),
            t_practice_list_staged.c.latest_practiced
            > lower_bound_date.strftime("%Y-%m-%d %H:%M:%S"),
        )

        window_predicate = and_(
            base_time_col > lower_bound_date.strftime("%Y-%m-%d %H:%M:%S"),
            base_time_col <= review_sitdown_date.strftime("%Y-%m-%d %H:%M:%S"),
        )

        filters = [
            t_practice_list_staged.c.user_ref == user_ref,
            t_practice_list_staged.c.playlist_id == playlist_ref,
            or_(window_predicate, staged_visibility_predicate),
        ]
        if not show_deleted:
            filters.append(t_practice_list_staged.c.deleted.is_(False))
        if not show_playlist_deleted:
            filters.append(t_practice_list_staged.c.playlist_deleted.is_(False))

        practice_list_query = db.query(t_practice_list_staged).filter(and_(*filters))

    except Exception as e:
        logging.getLogger().error(
            f"An error occurred while querying the practice list: {e}"
        )
        raise

    scheduled_rows_query_sorted = practice_list_query.order_by(
        func.DATE(
            func.coalesce(
                t_practice_list_staged.c.scheduled,
                t_practice_list_staged.c.latest_review_date,
            )
        ).desc()
    )
    # scheduled_rows_query_clipped = scheduled_rows_query_sorted.offset(skip).limit(limit)
    scheduled_rows_query_clipped = scheduled_rows_query_sorted.offset(skip)

    scheduled_rows: List[Row[Any]] = scheduled_rows_query_clipped.all()

    tune_type_column_index = find_dict_index(
        scheduled_rows_query_clipped.column_descriptions, "name", "type"
    )
    scheduled_rows = sorted(scheduled_rows, key=lambda row: row[tune_type_column_index])

    # aged_limit = limit - len(scheduled_rows)
    # if aged_limit <= 0:
    #     aged_limit = 2
    # aged_limit = 2

    # practice_list_query2 = db.query(t_practice_list_staged).filter(
    #     and_(
    #         t_practice_list_staged.c.user_ref == user_ref,
    #         t_practice_list_staged.c.playlist_ref == playlist_ref,
    #     )
    # )

    # aged_rows: List[Tune] = (
    #     practice_list_query2.order_by(
    #         func.DATE(t_practice_list_staged.c.Practiced).asc()
    #     )
    #     .offset(skip)
    #     .limit(aged_limit)
    #     .all()
    # )
    # rows = scheduled_rows + aged_rows
    rows = scheduled_rows

    # if print_table:
    #     print("\n--------")
    #     print(tabulate(rows, headers=t_practice_list_staged.columns.keys()))

    return rows


# def get_practice_list_scheduled_dynamic_view_construction(
#     db: Session,
#     skip: int = 0,
#     limit: int = 10,
#     print_table=False,
#     review_sitdown_date: Optional[datetime] = None,
#     acceptable_delinquency_window=7,
#     playlist_ref=1,
#     user_ref=1,
# ) -> List[Row[Any]]:
#     """Get a list of tunes to practice on the review_sitdown_date.
#     (This version constructs a view via the get_practice_list_query function
#     instead of the practice_list_joined view.)
#     (Note: This version of the function is not used at this time.)

#     Get all tunes scheduled between the acceptable_delinquency_window and review_sitdown_date, but limit number to the `limit` var.

#     Args:
#         db (Session): _description_
#         skip (int, optional): _description_. Defaults to 0.
#         limit (int, optional): _description_. Defaults to 10.
#         print_table (bool, optional): _description_. Defaults to False.
#         review_sitdown_date (_type_, optional): _description_. Defaults to datetime.today().
#         acceptable_delinquency_window (int, optional): _description_. Defaults to 7 days.
#         playlist_ref (int, optional): The playlist ID to filter on. Defaults to 1.
#         user_ref (int, optional): The user ID to filter on. Defaults to 1.

#     Returns:
#         List[Tune]: tunes scheduled between the acceptable_delinquency_window and review_sitdown_date, but limit number to the `limit` var.
#     """
#     if review_sitdown_date is None:
#         review_sitdown_date = datetime.today()
#         print("review_sitdown_date is None, using today: ", review_sitdown_date)
#     assert isinstance(review_sitdown_date, datetime)

#     # This is really strange, but it seems to be necessary to add a
#     # day to the review_sitdown_date to get this to agree with the
#     # older code. I don't know why this is necessary.
#     review_sitdown_date = review_sitdown_date + timedelta(days=1)

#     practice_list_query = get_practice_list_query(db, playlist_ref, user_ref)

# practice_list_query_scheduled = practice_list_query.where(
#     and_(
#         PracticeRecord.review_date
#         > (review_sitdown_date - timedelta(acceptable_delinquency_window)),
#         PracticeRecord.review_date <= review_sitdown_date,
#     )
# )
# scheduled_rows_query_sorted = practice_list_query_scheduled.order_by(
#     func.DATE(PracticeRecord.review_date).desc()
# )
# scheduled_rows_query_clipped = scheduled_rows_query_sorted.offset(skip).limit(limit)

#     scheduled_rows: List[Row] = scheduled_rows_query_clipped.all()

#     tune_type_column_index = find_dict_index(
#         scheduled_rows_query_clipped.column_descriptions, "name", "TuneType"
#     )
#     scheduled_rows = sorted(scheduled_rows, key=lambda row: row[tune_type_column_index])

#     aged_limit = limit - len(scheduled_rows)
#     if aged_limit <= 0:
#         aged_limit = 2
#     aged_limit = 2
#     aged_rows: List[Tune] = (
#         practice_list_query.order_by(func.DATE(PracticeRecord.Practiced).asc())
#         .offset(skip)
#         .limit(aged_limit)
#         .all()
#     )
#     rows = scheduled_rows + aged_rows

#     # if print_table:
#     #     print("\n--------")
#     #     print(tabulate(rows, headers=t_practice_list_staged.columns.keys()))

#     return rows

# def _run_experiment():
#     db = None
#     try:
#         db = SessionLocal()
#         tunes = get_practice_list_scheduled(db, limit=10, print_table=True)
#         for tune in tunes:
#             for column_name in practice_list_columns:
#                 column_index = practice_list_columns[column_name]
#                 if column_index != 0:
#                     print("   ", end="")
#                 print(f"{column_name}: {tune[column_index]}")
#                 # assert tunes
#     finally:
#         if db:
#             db.close()


# if __name__ == "__main__":
#     _run_experiment()
