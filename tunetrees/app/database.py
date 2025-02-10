import logging
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import event
from sqlalchemy.engine import Engine

# import Levenshtein
from rapidfuzz import fuzz

from sqlalchemy.engine import Connection as SAConnection

# SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@postgresserver/db"
default_db_location = Path(__file__).parent.parent.parent.joinpath("tunetrees.sqlite3")
db_location_str = os.environ.get("TUNETREES_DB")
if db_location_str is not None:
    db_location_str = db_location_str.strip()
db_location_path = Path(db_location_str) if db_location_str else default_db_location
assert db_location_path
if not db_location_path.exists():
    logging.getLogger().error(f"Database file not found: {db_location_path}")
    raise FileNotFoundError(f"Database file not found: {db_location_path}")

stop_words = ["a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "by"]

SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_location_path.absolute()}"

sqlalchemy_database_engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=sqlalchemy_database_engine
)


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
def register_levenshtein(dbapi_connection: SAConnection, connection_record) -> None:  # type: ignore
    assert connection_record is not None
    import sqlite3

    if isinstance(dbapi_connection, sqlite3.Connection):
        dbapi_connection.create_function("levenshtein", 2, levenshtein_distance)


# Base = declarative_base()
