import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@postgresserver/db"
default_db_location = Path(__file__).parent.parent.parent.joinpath("tunetrees.sqlite3")
db_location_str = os.environ.get("TUNETREES_DB")
db_location_path = Path(db_location_str) if db_location_str else default_db_location
assert db_location_path

SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_location_path.absolute()}"

sqlalchemy_database_engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sqlalchemy_database_engine)

# Base = declarative_base()
