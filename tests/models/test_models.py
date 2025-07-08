# moved from test/test_models.py
from typing import Any, List
from datetime import datetime
import os
import sqlite3
from sqlalchemy.engine.row import Row
from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import get_tune_table, query_practice_list_scheduled
from tunetrees.models.tunetrees import Tune


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
    db_url = os.environ.get("DATABASE_URL")
    print(f"DATABASE_URL={db_url}")
    if db_url and db_url.startswith("sqlite:///"):
        repo_root: str = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        db_path: str = os.path.join(repo_root, db_url.replace("sqlite:///", ""))
        print(f"ABSOLUTE DB PATH: {os.path.abspath(db_path)}")
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute("PRAGMA table_info('practice_list_staged')")
            columns = [row[1] for row in cursor.fetchall()]
            print("practice_list_staged columns:", columns)
            assert "difficulty" in columns, "Column 'difficulty' not found in view!"


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

        review_sitdown_date = datetime.fromisoformat("2024-12-31 11:47:57.671465-00:00")
        tunes: List[Row[Any]] = query_practice_list_scheduled(
            db,
            limit=1000,
            print_table=True,
            review_sitdown_date=review_sitdown_date,
        )
        filtered = list(filter(lambda tune: tune.id == 1081, tunes))
        assert filtered
        r1714 = filtered[0]
        assert str(r1714.title) == "Lakes of Sligo"

        filtered = list(filter(lambda tune: tune.id == 1820, tunes))
        assert filtered
        r1714 = filtered[0]
        assert str(r1714.title) == "St. Mary's"

        filtered = list(filter(lambda tune: tune.id == 2451, tunes))
        assert filtered
        r1714 = filtered[0]
        assert str(r1714.title) == "Church Street Polka"

        filtered = list(filter(lambda tune: tune.id == 1684, tunes))
        assert filtered
        r1714 = filtered[0]
        assert str(r1714.title) == "Road to Lisdoonvarna"


def test_direct_sql_on_practice_list_staged():
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("sqlite:///"):
        repo_root: str = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        db_path: str = os.path.join(repo_root, db_url.replace("sqlite:///", ""))
        with sqlite3.connect(db_path) as conn:
            try:
                cursor = conn.execute(
                    "SELECT difficulty FROM practice_list_staged LIMIT 1"
                )
                print("Direct SQL query succeeded, got:", cursor.fetchone())
            except Exception as e:
                print("Direct SQL query failed:", e)
                raise
