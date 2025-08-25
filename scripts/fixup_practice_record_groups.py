#!/usr/bin/env python3
"""
Dump and fix up practice_record groups by tune_ref from a SQLite DB copy.

What this does:
- Connects to the provided SQLite DB path (default: tunetrees_production_manual.sqlite3 in repo root)
- Finds tune_refs where at least one row has technique == 'fsrs' (case-insensitive; null/empty ignored)
- For each such tune_ref:
    - Prints rows sorted by id with key fields (original view)
    - Computes a normalized repetitions sequence:
        • If any non-zero repetitions value exists, the first such value becomes the seed and every subsequent row increments by +1 from the previous.
        • If all repetitions are 0/None, assigns 1..N across the group.
    - Replays FSRS scheduling to repair missing FSRS fields on FSRS rows:
        • Seed card: State.Review, step=0, stability=0.1, difficulty=5.0.
        • Non-FSRS (e.g., SM2) rows advance the virtual FSRS card using the observed quality and an easiness→difficulty mapping.
        • Quality (0–5) maps to FSRS Rating: 0/1 Again, 2 Hard, 3 Good, 4/5 Easy.
        • Repair begins on the first FSRS row where stability is None; from there onward FSRS rows get state, step, stability, difficulty, and review_date written.
- Shows a second table with the normalized repetitions overlay.

Persistence behavior:
- Dry-run by default (no writes). Use --apply to persist both normalized repetitions and FSRS field repairs.
- Updates are performed on existing rows only (no row creation/deletion); timestamps are not altered.
- A single commit is issued per tune_ref group when --apply is set.

Output:
- Rich tables printed to stdout. Use --output <file> to write the rendered output to a file instead.
- Groups are preceded by a summary count and separated by rules for readability.

Run from repo root:
    python scripts/fixup_practice_record_groups.py
    python scripts/fixup_practice_record_groups.py --db path/to/db.sqlite3 --limit 5
    python scripts/fixup_practice_record_groups.py --tune 123 --apply --output fsrs_fixup_123.txt

Notes:
- Uses SQLAlchemy ORM models and the project's SessionLocal (via TUNETREES_DB).
- Avoids altering unique practiced timestamps; only updates repetitions and FSRS-related fields when repairing.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys
from typing import ContextManager, List, Optional, Sequence, TYPE_CHECKING, Tuple

from tunetrees.models.tunetrees import PracticeRecord

if TYPE_CHECKING:  # imports for type checking only
    from tunetrees.models.tunetrees import PracticeRecord

from fsrs import Card, Rating, Scheduler, State
from sqlalchemy import select, func, case
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


def find_all_fsrs_tune_refs(db: Session, limit: int | None = None) -> List[int]:
    from tunetrees.models.tunetrees import PracticeRecord

    # Count rows where technique is exactly 'fsrs' (case-insensitive, trimmed)
    tech_normalized = func.lower(func.trim(PracticeRecord.technique))
    good_count = func.sum(case(((tech_normalized == "fsrs"), 1), else_=0))

    stmt = (
        select(PracticeRecord.tune_ref)
        .group_by(PracticeRecord.tune_ref)
        .having(good_count > 0)
        .order_by(PracticeRecord.tune_ref)
    )
    if limit is not None and limit > 0:
        stmt = stmt.limit(limit)
    return [row[0] for row in db.execute(stmt).all()]


def _render_rows_table(
    rows: Sequence["PracticeRecord"],
    title: str,
    reps_override: Optional[Sequence[Optional[int]]] = None,
) -> None:
    table = Table(title=title)
    for col in [
        "tune_ref",
        "id",
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
    for idx, pr in enumerate(rows):
        rep_val: Optional[int | str]
        if reps_override is not None:
            rep_val = reps_override[idx]
        else:
            rep_val = pr.repetitions if pr.repetitions is not None else ""
        table.add_row(
            str(pr.tune_ref),
            str(pr.id),
            str(pr.practiced or ""),
            str(rep_val),
            str(pr.technique or ""),
            str(pr.quality if pr.quality is not None else ""),
            str(pr.stability if pr.stability is not None else ""),
            str(pr.difficulty if pr.difficulty is not None else ""),
            str(pr.review_date if pr.review_date is not None else ""),
            str(" "),
            str(pr.easiness if pr.easiness is not None else ""),
            str(pr.interval if pr.interval is not None else ""),
            str(pr.step if pr.step is not None else ""),
        )
    console.print(table)


def _e_factor_to_difficulty(e_factor: float) -> float:
    normalized_e = (e_factor - 1.3) / (2.5 - 1.3)
    inverted_e = 1 - normalized_e
    d = 1 + inverted_e * 9
    return float(round(d))


def _compute_normalized_reps(rows: Sequence["PracticeRecord"]) -> List[Optional[int]]:
    orig_reps: List[Optional[int]] = [
        (r.repetitions if isinstance(r.repetitions, int) else None) for r in rows
    ]
    norm_reps: List[Optional[int]] = orig_reps.copy()

    start_idx: Optional[int] = None
    for i, rv in enumerate(orig_reps):
        if rv is not None and rv != 0:
            start_idx = i
            break
    if start_idx is not None:
        for j in range(start_idx + 1, len(norm_reps)):
            prev = norm_reps[j - 1]
            prev_int = int(prev) if prev is not None else 0
            norm_reps[j] = prev_int + 1
    else:
        for j in range(len(norm_reps)):
            norm_reps[j] = j + 1
    return norm_reps


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


def fsrs_fixup(rows: Sequence[PracticeRecord]) -> Tuple[Sequence[PracticeRecord], bool]:
    """Repair FSRS fields by replaying review history.

    Logic:
    - Assume rows sorted by id ascending (oldest first)
    - Use SM2/unknown technique rows to advance a virtual FSRS card (map easiness -> difficulty)
    - When encountering the first FSRS row with missing stability, start populating FSRS fields
    - For each subsequent FSRS row, advance and write state, step, stability, difficulty, and review_date
    - Non-FSRS rows are not written to, but still advance the card state
    Returns (rows, fsrs_updated_flag)
    """
    start_fsrs_repair = False
    previous_card = Card(state=State.Review, step=0, stability=0.1, difficulty=5.0)
    fsrs_updated = False
    scheduler = Scheduler()
    for r in rows:
        tech = (r.technique or "").lower()
        rating = _quality_to_fsrs_rating(int(r.quality or 0))

        if tech != "fsrs":
            # Treat SM2/unknown technique as prior practice to advance FSRS card
            ef = r.easiness
            diff = _e_factor_to_difficulty(float(ef)) if ef is not None else 5.0
            # Clamp difficulty into FSRS domain [1, 10]
            if diff < 1.0:
                diff = 1.0
            elif diff > 10.0:
                diff = 10.0
            seed = Card(
                state=previous_card.state,
                step=previous_card.step,
                stability=previous_card.stability,
                difficulty=diff,
                due=previous_card.due,
                last_review=previous_card.last_review,
            )
            previous_card, _ = scheduler.review_card(seed, rating)
            continue

        # FSRS row
        if not start_fsrs_repair and r.stability is None:
            start_fsrs_repair = True

        # Always advance card on FSRS rows using observed rating
        previous_card, _ = scheduler.review_card(previous_card, rating)

        if start_fsrs_repair:
            r.state = previous_card.state
            r.step = previous_card.step
            r.stability = previous_card.stability
            r.difficulty = previous_card.difficulty
            r.review_date = previous_card.due
            fsrs_updated = True

    return rows, fsrs_updated


def dump_group(
    db: Session, tune_ref: int, *, apply: bool = False, nofixup: bool = False
) -> None:
    from tunetrees.models.tunetrees import PracticeRecord

    rows: Sequence[PracticeRecord] = (
        db.execute(
            select(PracticeRecord)
            .where(PracticeRecord.tune_ref == tune_ref)
            .order_by(PracticeRecord.id.asc())
        )
        .scalars()
        .all()
    )
    if not rows:
        return

    _render_rows_table(rows, title=f"tune_ref={tune_ref} (rows={len(rows)}) — original")

    if nofixup:
        console.rule()
        return

    norm_reps = _compute_normalized_reps(rows)

    rows, fsrs_updated = fsrs_fixup(rows)

    _render_rows_table(
        rows,
        title=f"tune_ref={tune_ref} (rows={len(rows)}) — repetitions normalized",
        reps_override=norm_reps,
    )
    # Apply normalized values back to DB if requested
    if apply:
        try:
            rep_updates = 0
            for idx, pr in enumerate(rows):
                nv = norm_reps[idx]
                if nv is not None and pr.repetitions != nv:
                    pr.repetitions = nv
                rep_updates += 1
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
        # Dry-run summary of changes
        rep_updates = 0
        for idx, pr in enumerate(rows):
            nv = norm_reps[idx]
            if nv is not None and pr.repetitions != nv:
                rep_updates += 1
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
                dump_group(db, args.tune, apply=args.apply, nofixup=args.nofixup)
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
                dump_group(db, t, apply=args.apply, nofixup=args.nofixup)

    if args.output is not None:
        # Send all Rich output to the specified file
        with open(args.output, "w", encoding="utf-8") as out_fp:
            global console
            console = Console(file=out_fp)
            run()
    else:
        run()


if __name__ == "__main__":
    main()
