#!/usr/bin/env python3
"""
Update table_state.settings JSON to replace 'latest_review_date' with 'latest_due'.

Usage:
  python scripts/update_table_state_latest_due.py \
    --db ./tunetrees_test_clean.sqlite3

Options:
  --db PATH           Path to the SQLite database (default: ./tunetrees_test_clean.sqlite3)
  --dry-run           Scan and report rows that would be changed, but do not write
  --no-backup         Do not create a timestamped backup copy before writing

Notes:
  - Creates a backup copy next to the DB by default: <name>.backup-YYYYmmdd_HHMMSS.sqlite3
  - Only updates rows where settings LIKE '%latest_review_date%'
  - Attempts to validate JSON before/after; proceeds even if JSON is invalid to avoid bricking state
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import shutil
import sqlite3
import sys
from pathlib import Path


def backup_db(db_path: Path) -> Path:
    ts = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_path.with_suffix("")
    backup_path = backup_path.parent / f"{backup_path.name}.backup-{ts}.sqlite3"
    shutil.copy2(db_path, backup_path)
    return backup_path


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    return cur.fetchone() is not None


def try_json_load(s: str) -> bool:
    try:
        json.loads(s)
        return True
    except Exception:
        return False


def fetch_rows_needing_update(conn: sqlite3.Connection) -> list[tuple[int, str]]:
    # Use implicit rowid to uniquely refer to rows; table_state has no 'id' column.
    cur = conn.execute(
        "SELECT rowid, settings FROM table_state WHERE settings LIKE '%latest_review_date%'"
    )
    return cur.fetchall()


def apply_updates(
    conn: sqlite3.Connection, rows: list[tuple[int, str]], dry_run: bool
) -> int:
    updated = 0
    if not rows:
        print("[INFO] No rows need updates.")
        return updated

    print(f"[INFO] Rows needing update: {len(rows)}")
    if not dry_run:
        conn.execute("BEGIN")

    for row_id, settings in rows:
        before_valid = try_json_load(settings)
        new_settings = settings.replace("latest_review_date", "latest_due")
        after_valid = try_json_load(new_settings)

        if dry_run:
            print(
                f"[DRY-RUN] id={row_id} json_before={before_valid} json_after={after_valid}"
            )
            continue

        conn.execute(
            "UPDATE table_state SET settings = ? WHERE rowid = ?",
            (new_settings, row_id),
        )
        updated += 1

    if not dry_run:
        conn.commit()
        print(f"[INFO] Updated rows: {updated}")
    else:
        print("[DRY-RUN] No changes written.")

    return updated


def process_db(db_path: Path, dry_run: bool = False, do_backup: bool = True) -> int:
    if not db_path.exists():
        print(f"[ERROR] DB not found: {db_path}")
        return 2

    if do_backup and not dry_run:
        b = backup_db(db_path)
        print(f"[INFO] Backup created: {b}")

    conn = sqlite3.connect(str(db_path))
    try:
        if not table_exists(conn, "table_state"):
            print("[WARN] 'table_state' not found; nothing to do.")
            return 0

        rows = fetch_rows_needing_update(conn)
        apply_updates(conn, rows, dry_run)
        return 0
    except Exception as e:
        if not dry_run:
            conn.rollback()
        print(f"[ERROR] Failed: {e}")
        return 1
    finally:
        conn.close()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db",
        default=str(Path("./tunetrees_test_clean.sqlite3").resolve()),
        help="Path to SQLite DB (default: ./tunetrees_test_clean.sqlite3)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Do not write changes")
    parser.add_argument(
        "--no-backup", action="store_true", help="Do not create a backup before writing"
    )
    args = parser.parse_args(argv)

    db_path = Path(args.db).expanduser().resolve()
    return process_db(db_path, dry_run=args.dry_run, do_backup=(not args.no_backup))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
