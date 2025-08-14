import logging
import os
import sqlite3
from pathlib import Path
from typing import Optional, Iterator

# import Levenshtein
from fastapi import HTTPException
from rapidfuzz import fuzz
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Connection as SAConnection
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import ConnectionPoolEntry
from sqlalchemy.exc import SQLAlchemyError

import time
from sqlalchemy.orm import Session
from contextlib import contextmanager

logger = logging.getLogger(__name__)


ENABLE_INTEGRITY_CHECKS = (
    os.environ.get("TT_ENABLE_SQLITE_INTEGRITY_CHECKS", "1") == "1"
)


def check_integrity(db: Session, context_string: Optional[str] = "") -> None:
    if not ENABLE_INTEGRITY_CHECKS:
        return
    try:
        result = db.execute(text("PRAGMA integrity_check;"))
        integrity_check = result.scalar()
        assert integrity_check == "ok", (
            f"Integrity check failed{f' ({context_string})'}: {integrity_check}"
        )
    except Exception as e:
        logger.error(f"Integrity check error{f' ({context_string})'}: {e}")
        raise
    # if context_string is not None:
    #     logger.info(
    #         f"Integrity check result{f' ({context_string})'}: {integrity_check}"
    #     )


def wait_for_integrity(db: Session):
    if not ENABLE_INTEGRITY_CHECKS:
        return
    # But just implementing this makes the error go away.
    # I'm going to leave it in place for now, but TODO.
    loops = 6
    for i in range(loops):
        try:
            check_integrity(db, f"(before table patch, iteration {i})")
            break
        except Exception as e:
            logger.error(f"Integrity check error: {e}")
            if i == (loops - 1):
                logger.error(f"Unable to update table state: {e}")
                raise HTTPException(
                    status_code=500, detail="Unable to update table state"
                )
            else:
                time.sleep(0.2)


# SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@postgresserver/db"

# Determine the repository root (3 levels up from this file: tunetrees/app/database.py -> repo root)
repo_root = Path(__file__).parent.parent.parent
default_db_location: Path = repo_root.joinpath("tunetrees.sqlite3")

db_location_str = os.environ.get("TUNETREES_DB", os.environ.get("DATABASE_URL"))
if db_location_str is not None:
    db_location_str = db_location_str.strip()
    # If it's a SQLAlchemy URL, extract the path
    if db_location_str.startswith("sqlite:///"):
        db_location_str = db_location_str.replace("sqlite:///", "")

    # Create Path object from the extracted string
    db_path = Path(db_location_str)

    # If it's not an absolute path, resolve it relative to the repo root
    if not db_path.is_absolute():
        db_location_path = repo_root.joinpath(db_path)
    else:
        db_location_path = db_path
else:
    db_location_path = default_db_location

assert db_location_path
# Note: Don't check file existence at import time to allow tests to set up the database
# The file existence will be checked when the database is actually accessed

stop_words = ["a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "by"]

SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_location_path.absolute()}"
logger.info(f"Using database at {SQLALCHEMY_DATABASE_URL}")

sqlalchemy_database_engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocalInternal = sessionmaker(
    autocommit=False, autoflush=False, bind=sqlalchemy_database_engine
)


@contextmanager
def SessionLocal() -> Iterator[Session]:
    # Check database file existence when actually accessing it
    if not db_location_path.exists():
        logger.error(f"Database file not found: {db_location_path}")
        raise FileNotFoundError(f"Database file not found: {db_location_path}")

    db = SessionLocalInternal()
    try:
        check_integrity(db, "before")
        yield db
        check_integrity(db, "after")
    except SQLAlchemyError as sqle:
        logger.error(f"SQLAlchemyError in update_table_state: {sqle}")
        db.rollback()  # Rollback the transaction on error
        raise HTTPException(status_code=500, detail=f"Database error: {sqle}")
    except Exception as e:
        logger.error(f"An error occurred during session usage: {e}")
        raise
    finally:
        db.close()


# def levenshtein_distance(a: str, b: str) -> int:
#     distance = Levenshtein.distance(a.lower(), b.lower())
#     if distance < 9:
#         logging.getLogger().info(f"distance {distance:3}: {a:35} {b}")
#     return distance


def preprocess_string(s: str) -> str:
    words = s.lower().split()
    filtered_words = [word for word in words if word not in stop_words]
    return " ".join(filtered_words)


def levenshtein_distance(a: str, b: str) -> int:
    a_processed = preprocess_string(a)
    b_processed = preprocess_string(b)

    # Ensure all words in a_processed are in b_processed
    a_words = set(a_processed.split())
    b_words = set(b_processed.split())
    if not a_words.intersection(b_words):
        return 0  # Return a low distance if no words are present in both sets

    distance = fuzz.ratio(a_processed, b_processed)

    if b_words.issubset(a_words):
        if distance < 70:
            distance += 30
    else:
        distance -= 10

    if distance > 40:  # Adjust the threshold as needed
        logging.getLogger().info(f"distance {distance:3}: {a:35} {b}")
    return int(distance)


@event.listens_for(Engine, "connect")
def register_levenshtein(
    dbapi_connection: SAConnection, connection_record: ConnectionPoolEntry
) -> None:
    assert connection_record is not None

    if isinstance(dbapi_connection, sqlite3.Connection):
        dbapi_connection.create_function("levenshtein", 2, levenshtein_distance)

    logging.getLogger().info("Registered levenshtein function")


###############################################################################
# Optional: force journal_mode=DELETE (disable WAL) to mitigate intermittent
# SQLite locking/read-only issues during rapid test DB cloning. Enabled ONLY when
# environment variable TT_ENABLE_SQLITE_DELETE_JOURNAL=1.
#
# DELETE mode helps ensure a clean state after file copy at the cost of reduced
# concurrency. synchronous=FULL favors durability over speed (acceptable in tests).
# If the flag is unset, default SQLite/WAL behavior is preserved.
###############################################################################
ENABLE_DELETE_JOURNAL = os.environ.get("TT_ENABLE_SQLITE_DELETE_JOURNAL", "1") == "1"

if ENABLE_DELETE_JOURNAL:

    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(
        dbapi_connection: SAConnection, connection_record: ConnectionPoolEntry
    ) -> None:  # pragma: no cover - side-effect hook
        assert connection_record is not None
        if isinstance(dbapi_connection, sqlite3.Connection):
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA journal_mode=DELETE")
                cursor.execute("PRAGMA synchronous=FULL")
            finally:
                cursor.close()


# Base = declarative_base()

with sqlalchemy_database_engine.connect() as connection:
    result = connection.execute(text("PRAGMA journal_mode;"))
    journal_mode = result.scalar()
    logger.info(f"Current journal mode: {journal_mode}")
    if ENABLE_DELETE_JOURNAL and journal_mode != "delete":
        logger.warning(
            "TT_ENABLE_SQLITE_DELETE_JOURNAL=1 but journal mode is not DELETE; issues may occur"
        )
    if ENABLE_INTEGRITY_CHECKS:
        result = connection.execute(text("PRAGMA integrity_check;"))
        integrity_check = result.scalar()
        logger.info(f"Integrity check result: {integrity_check}")
