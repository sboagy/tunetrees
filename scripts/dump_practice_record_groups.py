#!/usr/bin/env python3
"""
Dump practice_record groups by tune_ref from a SQLite DB copy.

Behavior:
- Connects to the provided SQLite DB path (default: tunetrees_production_manual.sqlite3 in repo root)
- Finds tune_refs where at least one row has technique == 'fsrs' (case-insensitive; null/empty ignored)
- For each such tune_ref, prints rows sorted by id with key fields
- Separates groups with a --- line

Run from repo root:
  python scripts/dump_practice_record_groups.py
  python scripts/dump_practice_record_groups.py --db path/to/db.sqlite3

Notes:
- This script uses SQLAlchemy ORM models from tunetrees.models.tunetrees
- Read-only usage; no writes performed
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys
from typing import ContextManager, List

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
            "Dump practice_record rows grouped by tune_ref that contain at least one 'fsrs' technique."
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


def dump_group(db: Session, tune_ref: int) -> None:
    from tunetrees.models.tunetrees import PracticeRecord

    rows = (
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
    table = Table(title=f"tune_ref={tune_ref} (rows={len(rows)})")
    # Keep requested columns, including duplicated difficulty per spec
    for col in [
        "tune_ref",
        "id",
        "practiced",
        "repetitions",
        "technique",
        "quality",
        "easiness",
        "difficulty",
        "interval",
        "step",
        "difficulty",
    ]:
        table.add_column(col)
    for pr in rows:
        table.add_row(
            str(pr.tune_ref),
            str(pr.id),
            str(pr.practiced or ""),
            str(pr.repetitions or ""),
            str(pr.technique or ""),
            str(pr.quality if pr.quality is not None else ""),
            str(pr.easiness if pr.easiness is not None else ""),
            str(pr.difficulty if pr.difficulty is not None else ""),
            str(pr.interval if pr.interval is not None else ""),
            str(pr.step if pr.step is not None else ""),
            str(pr.difficulty if pr.difficulty is not None else ""),
        )
    console.print(table)
    console.rule()


def main() -> None:
    args = parse_args()
    with get_session_from_database_module(args.db) as db:
        if args.tune is not None:
            dump_group(db, args.tune)
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
            dump_group(db, t)


if __name__ == "__main__":
    main()
