# moved from test/test_models.py
from typing import List
import os
import sqlite3
from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import get_tune_table, query_practice_list_scheduled
from tunetrees.models.tunetrees_pydantic import PlaylistTuneJoinedModel
from tunetrees.models.tunetrees import Tune
import pytz
from dateutil import parser


def test_basic_connect_and_read():
    db_url = os.environ.get("DATABASE_URL")
    print(f"DATABASE_URL={db_url}")
    with SessionLocal() as db:
        tunes: List[Tune] = get_tune_table(db, limit=1000, print_table=True)
        filtered = list(filter(lambda tune: tune.id == 36, tunes))
        assert filtered
        r36 = filtered[0]
        assert str(r36.title) == "Lilting Fisherman"
        print(
            f"\n{r36.id=}, {r36.title=}, {r36.type=}, {r36.mode=}, {r36.structure=}, {r36.incipit=}"
        )


def test_check_practice_list_staged_columns():
    # Check multiple environment variables and fallback to default test DB
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("TUNETREES_DB")
    print(f"DATABASE_URL={os.environ.get('DATABASE_URL')}")
    print(f"TUNETREES_DB={os.environ.get('TUNETREES_DB')}")

    if db_url and db_url.startswith("sqlite:///"):
        # Extract the path from the URL
        db_path = db_url.replace("sqlite:///", "")
    elif db_url:
        db_path = db_url
    else:
        # Fallback to test database in repo root
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        db_path = os.path.join(repo_root, "tunetrees_test.sqlite3")

    # If it's not an absolute path, make it relative to repo root
    if not os.path.isabs(db_path):
        repo_root: str = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..")
        )
        db_path = os.path.join(repo_root, db_path)

    print(f"ABSOLUTE DB PATH: {os.path.abspath(db_path)}")
    print(f"DB PATH EXISTS: {os.path.exists(db_path)}")

    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute("PRAGMA table_info('practice_list_staged')")
        columns = [row[1] for row in cursor.fetchall()]
        print("practice_list_staged columns:", columns)
        assert "latest_difficulty" in columns, (
            "Column 'latest_difficulty' not found in view!"
        )


def test_practice_list_joined():
    db_url = os.environ.get("DATABASE_URL")
    print(f"DATABASE_URL={db_url}")
    with SessionLocal() as db:
        try:
            engine = db.get_bind()
            url = getattr(engine, "url", None)
            print("SQLAlchemy DB URL:", url)
            if url is not None:
                db_path = getattr(url, "database", None)
                print("SQLAlchemy DB path:", db_path)
            else:
                print("SQLAlchemy engine has no 'url' attribute")
        except Exception as e:
            print(f"Could not determine SQLAlchemy DB path: {e}")

        # Create the date in EST and convert to UTC

        # Note: fromisoformat does not handle timezones well, so use strptime
        # Parse a datetime string that includes EST as part of the string
        naive_dt = parser.parse("2024-12-31 11:47:57.671465 EST")
        # The resulting datetime object will have tzinfo set to EST
        # Convert to UTC for database queries
        # Parse the datetime string with timezone info directly
        review_sitdown_date = naive_dt.astimezone(pytz.utc)
        tunes: List[PlaylistTuneJoinedModel] = query_practice_list_scheduled(
            db,
            review_sitdown_date=review_sitdown_date,
        )
        # Basic sanity: bucket populated (int 1-3) for at least one tune
        if tunes:
            assert tunes[0].bucket in (1, 2, 3)

        def _assert_title(tune_id: int, expected: str):
            filtered = [t for t in tunes if t.id == tune_id]
            assert filtered, f"Expected tune id {tune_id} in scheduled list"
            assert str(filtered[0].title) == expected

        _assert_title(1081, "Lakes of Sligo")
        _assert_title(1820, "St. Mary's")
        _assert_title(2451, "Church Street Polka")
        _assert_title(1684, "Road to Lisdoonvarna")


def test_direct_sql_on_practice_list_staged():
    # Check multiple environment variables and fallback to default test DB
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("TUNETREES_DB")
    print(f"DATABASE_URL={os.environ.get('DATABASE_URL')}")
    print(f"TUNETREES_DB={os.environ.get('TUNETREES_DB')}")

    if db_url and db_url.startswith("sqlite:///"):
        # Extract the path from the URL
        db_path = db_url.replace("sqlite:///", "")
    elif db_url:
        db_path = db_url
    else:
        # Fallback to test database in repo root
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        db_path = os.path.join(repo_root, "tunetrees_test.sqlite3")

    # If it's not an absolute path, make it relative to repo root
    if not os.path.isabs(db_path):
        repo_root: str = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..")
        )
        db_path = os.path.join(repo_root, db_path)

    print(f"Resolved db_path for direct SQL: {db_path}")
    with sqlite3.connect(db_path) as conn:
        try:
            cursor = conn.execute(
                "SELECT latest_easiness FROM practice_list_staged LIMIT 1"
            )
            row = cursor.fetchone()
            print("Direct SQL query succeeded, got:", row)
            values = [value for value in row] if row else []
            print("Direct SQL query values:", values)
            value = values[0] if values else None
            assert value, "Expected at least one row from direct SQL query"
        except Exception as e:
            print("Direct SQL query failed:", e)
            raise
