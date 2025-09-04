#!/usr/bin/env python3
"""
Dump and fix up practice_record groups by tune_ref from a SQLite DB copy.

What this does:
- Connects to the provided SQLite DB path (default: tunetrees_production_manual.sqlite3 in repo root)
- Finds tune_refs where at least one row has technique == 'fsrs' (case-insensitive; null/empty ignored)
- For each such tune_ref:
    - Prints rows sorted by id with key fields (original view)
    - Expands each row into a sequence of simulated FSRS repetitions:
        • Simulate `repetitions` reviews, scheduling each at the previous card's due date.
        • Interim reviews use Rating.Good; final review uses the rating mapped from original `quality` (0–5 scale).
        • Each simulated row gets technique='fsrs' and an enumerated repetitions counter (1..N).
        • Practiced timestamps are made unique within (tune_ref, playlist_ref, practiced).
- Shows a second table with the simulated sequence overlay.

Persistence behavior:
- Dry-run by default (no writes). Use --apply to INSERT the simulated rows and DELETE the original row(s) so the sequence is clean.
- Timestamps are preserved/normalized to UTC-naive strings; uniqueness is ensured without altering existing rows.
- A single commit is issued per tune_ref group when --apply is set.

Output:
- Rich tables printed to stdout. Use --output <file> to write the rendered output to a file instead.
- Optionally export a colorized HTML report with --html-output <file> (uses inline styles).
- Groups are preceded by a summary count and separated by rules for readability.

Run from repo root:
    python scripts/fixup_practice_record_groups.py
    python scripts/fixup_practice_record_groups.py --db path/to/db.sqlite3 --limit 5
    python scripts/fixup_practice_record_groups.py --tune 123 --apply --output fsrs_fixup_123.txt

Notes:
- Uses SQLAlchemy ORM models and the project's SessionLocal (via TUNETREES_DB).
- Avoids altering unique practiced timestamps; new rows are created with distinct times when needed.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta
import os
from pathlib import Path
import sys
from typing import ContextManager, List, Sequence, TYPE_CHECKING, Tuple

from tunetrees.app.schedule import TT_DATE_FORMAT
from tunetrees.models.tunetrees import PracticeRecord

if TYPE_CHECKING:  # imports for type checking only
    from tunetrees.models.tunetrees import PracticeRecord

from fsrs import Card, Rating, Scheduler, State
from sqlalchemy import select, func
from sqlalchemy.orm import Session
import warnings
from sqlalchemy.exc import SAWarning
from rich.console import Console
from rich.table import Table

# Suppress benign SQLAlchemy warning from model inheritance name collision
warnings.filterwarnings(
    "ignore",
    message=r".*Implicitly combining column user.acceptable_delinquency_window.*",
    category=SAWarning,
)

# Rich console for table output
console = Console()


def repo_root() -> Path:
    # scripts/ -> repo root
    return Path(__file__).resolve().parent.parent


# Ensure repo root is on sys.path for direct script execution
_RR = repo_root()
if str(_RR) not in sys.path:
    sys.path.insert(0, str(_RR))


def parse_args() -> argparse.Namespace:
    default_db = repo_root() / "tunetrees_production_manual.sqlite3"
    parser = argparse.ArgumentParser(
        description=(
            "Dump and fix up practice_record rows grouped by tune_ref that contain at least one 'fsrs' technique."
        )
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=default_db,
        help=f"Path to SQLite DB file (default: {default_db})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional limit on number of tune_ref groups to output",
    )
    parser.add_argument(
        "--tune",
        type=int,
        default=None,
        help="Optional specific tune_ref to dump (overrides filter)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply normalized repetitions and FSRS repairs back to the database (otherwise dry-run)",
    )
    parser.add_argument(
        "--nofixup",
        action="store_true",
        help="Skip fixup (no normalized table, no FSRS repair computation). Prints only the original tables.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional path to write the rendered tables/output (defaults to stdout)",
    )
    parser.add_argument(
        "--html-output",
        dest="html_output",
        type=Path,
        default=None,
        help=(
            "Optional path to write a colorized HTML report. When provided, output is also recorded and exported "
            "as HTML with inline styles."
        ),
    )
    parser.add_argument(
        "--fsrsonly",
        action="store_true",
        default=False,
        help=(
            "Only include and display rows where technique is 'fsrs' (case-insensitive). "
            "By default, all practice records are processed regardless of technique."
        ),
    )
    return parser.parse_args()


def get_session_from_database_module(db_path: Path) -> ContextManager[Session]:
    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found: {db_path}")
    # Set env var BEFORE importing database module so it picks up the path
    os.environ["TUNETREES_DB"] = str(db_path)
    # Import locally after env is set
    from tunetrees.app import database  # type: ignore

    # Use the project's SessionLocal context manager
    return database.SessionLocal()


def _build_group_select_stmt(tune_ref: int, fsrsonly: bool):
    """Build base SELECT for a tune_ref with optional FSRS-only filter."""
    from tunetrees.models.tunetrees import PracticeRecord

    stmt = select(PracticeRecord).where(PracticeRecord.tune_ref == tune_ref)
    if fsrsonly:
        # Restrict to rows where technique is exactly 'fsrs' (case-insensitive, trimmed)
        stmt = stmt.where(func.lower(func.trim(PracticeRecord.technique)) == "fsrs")
    return stmt.order_by(PracticeRecord.id.asc())


def find_all_fsrs_tune_refs(db: Session, limit: int | None = None) -> List[int]:
    from tunetrees.models.tunetrees import PracticeRecord

    # Count rows where technique is exactly 'fsrs' (case-insensitive, trimmed)
    # tech_normalized: Function[Any] = func.lower(func.trim(PracticeRecord.technique))
    # good_count = func.sum(case(((tech_normalized == "fsrs"), 1), else_=0))

    stmt = (
        select(PracticeRecord.tune_ref)
        .group_by(PracticeRecord.tune_ref)
        # .having(good_count > 0)
        .order_by(PracticeRecord.tune_ref)
    )
    if limit is not None and limit > 0:
        stmt = stmt.limit(limit)
    return [row[0] for row in db.execute(stmt).all()]


def _render_rows_table(
    rows: Sequence["PracticeRecord"],
    title: str,
    *,
    title_style: str | None = None,
    row_style: str | None = None,
) -> None:
    table = Table(title=title, title_style=title_style)
    for col in [
        "tune_ref",
        "id",
        "state",
        "practiced",
        "repetitions",
        "technique",
        "quality",
        "stability",
        "difficulty",
        "review_date",
        "-",
        "easiness",
        "interval",
        "step",
    ]:
        table.add_column(col)
    for _, pr in enumerate(rows):
        table.add_row(
            str(pr.tune_ref),
            str(pr.id),
            str(pr.state or State.Learning),
            str(pr.practiced or ""),
            str(pr.repetitions or ""),
            str(pr.technique or ""),
            str(pr.quality if pr.quality is not None else ""),
            str(pr.stability if pr.stability is not None else ""),
            str(pr.difficulty if pr.difficulty is not None else ""),
            str(pr.review_date if pr.review_date is not None else ""),
            str(" "),
            str(pr.easiness if pr.easiness is not None else ""),
            str(pr.interval if pr.interval is not None else ""),
            str(pr.step if pr.step is not None else ""),
            style=row_style,
        )
    console.print(table)


# def _compute_normalized_reps(rows: Sequence["PracticeRecord"]) -> List[Optional[int]]:
#     orig_reps: List[Optional[int]] = [
#         (r.repetitions if isinstance(r.repetitions, int) else None) for r in rows
#     ]
#     norm_reps: List[Optional[int]] = orig_reps.copy()

#     start_idx: Optional[int] = None
#     for i, rv in enumerate(orig_reps):
#         if rv is not None and rv != 0:
#             start_idx = i
#             break
#     if start_idx is not None:
#         for j in range(start_idx + 1, len(norm_reps)):
#             prev = norm_reps[j - 1]
#             prev_int = int(prev) if prev is not None else 0
#             norm_reps[j] = prev_int + 1
#     else:
#         for j in range(len(norm_reps)):
#             norm_reps[j] = j + 1
#     return norm_reps


def _quality_to_fsrs_rating(quality_int: int) -> Rating:
    """Convert quality value to FSRS Rating.

    This expects normalized 6-value quality input (0-5 scale):
    - 0,1 -> Again
    - 2 -> Hard
    - 3 -> Good
    - 4,5 -> Easy
    """
    if quality_int in (0, 1):
        return Rating.Again
    elif quality_int == 2:
        return Rating.Hard
    elif quality_int == 3:
        return Rating.Good
    elif quality_int in (4, 5):
        return Rating.Easy
    else:
        raise ValueError(f"Unexpected quality value: {quality_int}")


def _subtract_months(dt: datetime, months: int) -> datetime:
    # Preserve tzinfo if present
    tz = dt.tzinfo
    year = dt.year
    month = dt.month - months
    while month <= 0:
        month += 12
        year -= 1

    # Determine last day of target month
    if month == 12:
        next_month = 1
        next_month_year = year + 1
    else:
        next_month = month + 1
        next_month_year = year
    next_month_first = datetime(next_month_year, next_month, 1, tzinfo=tz)
    last_day = (next_month_first - timedelta(days=1)).day

    day = min(dt.day, last_day)
    return datetime(
        year, month, day, dt.hour, dt.minute, dt.second, dt.microsecond, tzinfo=tz
    )


def fsrs_fixup(  # noqa: C901
    db: Session,
    rows: Sequence[PracticeRecord],
    *,
    apply: bool,
) -> Tuple[Sequence[PracticeRecord], bool]:
    """Expand each input row into a sequence of simulated FSRS practice records.

    - Simulate `repetitions` reviews per input row.
    - Interim reviews use a realistic random distribution; final review uses rating mapped from r.quality.
    - Each simulated row is technique='fsrs' with enumerated repetitions (1..N).
    - Practiced timestamps are unique per (tune_ref, playlist_ref, practiced).
    - When apply=True, INSERT new rows and DELETE originals; otherwise dry-run.
    """

    from datetime import timezone
    import random

    def ensure_aware_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def fmt_tt(dt: datetime) -> str:
        # Store as UTC-naive string in TT_DATE_FORMAT
        aware = ensure_aware_utc(dt)
        return aware.replace(tzinfo=None).strftime(TT_DATE_FORMAT)

    def normalize_practiced(v: str | datetime | None) -> datetime:
        if v is None:
            return datetime.now(timezone.utc)
        if isinstance(v, datetime):
            return ensure_aware_utc(v)
        parsed = datetime.strptime(v, TT_DATE_FORMAT)
        return ensure_aware_utc(parsed)

    def exists_in_db(prac_str: str, tune_ref: int, playlist_ref: int) -> bool:
        stmt = select(PracticeRecord.id).where(
            PracticeRecord.tune_ref == tune_ref,
            PracticeRecord.playlist_ref == playlist_ref,
            PracticeRecord.practiced == prac_str,
        )
        return db.execute(stmt).first() is not None

    def ensure_unique_practiced(
        base_dt: datetime, tune_ref: int, playlist_ref: int, used: set[str]
    ) -> tuple[str, datetime]:
        s = fmt_tt(base_dt)
        if s not in used and not exists_in_db(s, tune_ref, playlist_ref):
            used.add(s)
            return s, base_dt
        bump = 1
        while True:
            candidate = base_dt + timedelta(seconds=bump)
            s2 = fmt_tt(candidate)
            if s2 not in used and not exists_in_db(s2, tune_ref, playlist_ref):
                used.add(s2)
                return s2, candidate
            bump += 1

    fsrs_updated = False
    scheduler = Scheduler()

    simulated_sitdown_date = datetime.fromisoformat("2024-12-31 11:47:57.671465-00:00")

    # Seed scheduler with a baseline due (aware UTC)
    due_seed = _subtract_months(simulated_sitdown_date, 9)
    previous_card = Card(due=ensure_aware_utc(due_seed))
    previous_card.due = ensure_aware_utc(due_seed)

    # Gather existing practiced strings to avoid collisions
    used_practiced: set[str] = set(
        [p for p in (r.practiced for r in rows) if isinstance(p, str) and p]
    )

    new_rows: List[PracticeRecord] = []
    for r in rows:
        tech = (r.technique or "").lower()
        final_rating = (
            _quality_to_fsrs_rating(int(r.quality or 0))
            if tech != "fsrs"
            else Rating(int(r.quality or 1))
        )

        current_dt = normalize_practiced(r.practiced)
        # Clamp to sitdown date if any input exceeds it
        if current_dt > ensure_aware_utc(simulated_sitdown_date):
            current_dt = ensure_aware_utc(simulated_sitdown_date)
        total_reps = int(r.repetitions or 1)
        if total_reps < 1:
            total_reps = 1

        for i in range(1, total_reps + 1):
            # Final repetition uses mapped rating; interim use randomized distribution
            if i == total_reps:
                rating_i = final_rating
            else:
                # Split early vs later repetitions for realism
                early_phase = i <= max(1, total_reps // 2)
                if early_phase:
                    # Bias toward Again/Hard: 60% Hard(2), 40% Again(1)
                    rating_i = Rating.Hard if random.random() < 0.6 else Rating.Again
                else:
                    # Bias toward Good/Easy: 70% Good(3), 30% Easy(4)
                    rating_i = Rating.Good if random.random() < 0.7 else Rating.Easy
            # Advance scheduler with aware UTC datetime
            previous_card, _ = scheduler.review_card(
                previous_card, rating_i, review_datetime=ensure_aware_utc(current_dt)
            )

            # Ensure practiced time never exceeds sitdown date
            if current_dt > ensure_aware_utc(simulated_sitdown_date):
                current_dt = ensure_aware_utc(simulated_sitdown_date)
            prac_str, current_dt = ensure_unique_practiced(
                current_dt, r.tune_ref, r.playlist_ref, used_practiced
            )

            pr_new = PracticeRecord(
                playlist_ref=r.playlist_ref,
                tune_ref=r.tune_ref,
                practiced=prac_str,
                quality=rating_i.value,
                easiness=r.easiness if i == total_reps else None,
                interval=r.interval if i == total_reps else None,
                repetitions=r.repetitions  # has the effect of allowing 0
                if i == total_reps
                else i,
                review_date=fmt_tt(previous_card.due),
                backup_practiced=None,
                stability=previous_card.stability,
                elapsed_days=None,
                lapses=None,
                state=previous_card.state,
                difficulty=previous_card.difficulty,
                step=previous_card.step,
                goal=r.goal or "recall",
                technique="fsrs",
            )
            new_rows.append(pr_new)
            if apply:
                db.add(pr_new)

            # Next review at the due date; keep aware UTC for scheduler
            due_next = previous_card.due
            current_dt = ensure_aware_utc(due_next)
            # Clamp next review to sitdown date
            if current_dt > ensure_aware_utc(simulated_sitdown_date):
                current_dt = ensure_aware_utc(simulated_sitdown_date)

        if apply:
            db.delete(r)
        fsrs_updated = True

    return new_rows, fsrs_updated


def dump_group(
    db: Session,
    tune_ref: int,
    *,
    apply: bool = False,
    nofixup: bool = False,
    fsrsonly: bool = False,
) -> None:
    rows: Sequence[PracticeRecord] = (
        db.execute(_build_group_select_stmt(tune_ref, fsrsonly)).scalars().all()
    )
    if not rows:
        return

    _render_rows_table(
        rows,
        title=f"tune_ref={tune_ref} (rows={len(rows)}) — original",
        row_style="blue",
    )

    if nofixup:
        console.rule()
        return

    # Replace each row with a simulated sequence of repetitions using FSRS scheduling
    rep_updates = 0  # Not used in simulation mode; retained for summary output
    rows, fsrs_updated = fsrs_fixup(db, rows, apply=apply)

    _render_rows_table(
        rows,
        title=f"tune_ref={tune_ref} (rows={len(rows)}) — simulated repetitions",
        row_style="green",
    )
    # Apply normalized values back to DB if requested
    if apply:
        try:
            if fsrs_updated or rep_updates:
                db.commit()
                console.print(
                    f"[green]Applied[/green] updates for tune_ref={tune_ref}"
                    f" (FSRS: {'yes' if fsrs_updated else 'no'}, reps: {rep_updates})."
                )
        except Exception as e:  # noqa: BLE001
            db.rollback()
            console.print(
                f"[red]Failed to apply updates for tune_ref={tune_ref}: {e}[/red]"
            )
    else:
        console.print(
            f"[cyan]DRY-RUN[/cyan]: would update FSRS: {'yes' if fsrs_updated else 'no'},"
            f" reps: {rep_updates} for tune_ref={tune_ref}. Use --apply to commit."
        )

    # End of grouped set: rule separator
    console.rule()


def main() -> None:
    args = parse_args()

    def run() -> None:
        with get_session_from_database_module(args.db) as db:
            if args.tune is not None:
                dump_group(
                    db,
                    args.tune,
                    apply=args.apply,
                    nofixup=args.nofixup,
                    fsrsonly=args.fsrsonly,
                )
                return

            tune_refs = find_all_fsrs_tune_refs(db, limit=args.limit)
            console.print(
                f"[bold]Found {len(tune_refs)} tune_ref group(s) containing at least one 'fsrs' record.[/bold]"
            )
            if not tune_refs:
                console.print(
                    "[dim]No matching groups. Tip: try --tune <id> to inspect a specific tune, or verify technique values in the DB.[/dim]"
                )
            for t in tune_refs:
                dump_group(
                    db,
                    t,
                    apply=args.apply,
                    nofixup=args.nofixup,
                    fsrsonly=args.fsrsonly,
                )

    # Prepare consoles based on output options
    global console
    html_export: str | None = None

    if args.output is not None and args.html_output is not None:
        # Dual output: write plain text file and also export HTML
        with open(args.output, "w", encoding="utf-8") as out_fp:
            console = Console(file=out_fp, record=True)
            run()
            html_export = console.export_html(inline_styles=True)
    elif args.output is not None:
        # Only text output
        with open(args.output, "w", encoding="utf-8") as out_fp:
            console = Console(file=out_fp)
            run()
    elif args.html_output is not None:
        # Only HTML export, still show to stdout while recording
        console = Console(record=True)
        run()
        html_export = console.export_html(inline_styles=True)
    else:
        # Default behavior: stdout only
        run()

    # Write HTML file if requested
    if args.html_output is not None and html_export is not None:
        try:
            args.html_output.parent.mkdir(parents=True, exist_ok=True)
            with open(args.html_output, "w", encoding="utf-8") as fp:
                fp.write(html_export)
        except Exception as e:  # noqa: BLE001
            console.print(
                f"[red]Failed to write HTML report to {args.html_output}: {e}[/red]"
            )


if __name__ == "__main__":
    main()
