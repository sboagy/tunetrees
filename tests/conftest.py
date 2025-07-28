import shutil
import sqlite3
import pytest
import gc
import threading
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from tunetrees.api.tunetrees import router


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    """Clean up resources after all tests are done."""
    # Force garbage collection to clean up any remaining objects
    gc.collect()

    # Give threads a moment to clean up
    threading_active = threading.active_count()
    if threading_active > 1:  # Main thread + any others
        print(f"Active threads at session end: {threading_active}")


def _setup_environment_variables(dst_path: Path) -> None:
    """Set up environment variables for test database."""
    import os
    if not os.environ.get("TUNETREES_DB") and not os.environ.get("DATABASE_URL"):
        os.environ["TUNETREES_DB"] = str(dst_path)
        print(f"Set TUNETREES_DB to: {dst_path}")
    else:
        print("TUNETREES_DB or DATABASE_URL already set, not overriding")


def _verify_source_database(src_path: Path) -> None:
    """Verify source database exists and has required schema."""
    if not src_path.exists():
        print(f"✗ Source DB not found: {src_path}")
        return

    print(f"Source DB exists: {src_path}")
    with sqlite3.connect(src_path) as conn:
        cursor = conn.execute("PRAGMA table_info(practice_record)")
        cols = [row[1] for row in cursor.fetchall()]
        if "difficulty" in cols:
            print("✓ Source DB has difficulty column in practice_record")
        else:
            print("✗ Source DB missing difficulty column in practice_record")


def _reload_database_engine() -> None:
    """Reload SQLAlchemy database engine with current environment variables."""
    import os
    from tunetrees.app import database

    # Clear existing engine
    if hasattr(database, 'sqlalchemy_database_engine'):
        database.sqlalchemy_database_engine.dispose()
        print("Disposed existing SQLAlchemy engine")

    # Recalculate database path
    database.db_location_str = os.environ.get("TUNETREES_DB", os.environ.get("DATABASE_URL"))
    if not database.db_location_str:
        return

    database.db_location_str = database.db_location_str.strip()
    if database.db_location_str.startswith("sqlite:///"):
        database.db_location_str = database.db_location_str.replace("sqlite:///", "")

    db_path = Path(database.db_location_str)
    repo_root = Path(__file__).parent.parent
    if not db_path.is_absolute():
        database.db_location_path = repo_root.joinpath(db_path)
    else:
        database.db_location_path = db_path

    database.SQLALCHEMY_DATABASE_URL = f"sqlite:///{database.db_location_path.absolute()}"

    # Recreate engine
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    database.sqlalchemy_database_engine = create_engine(
        database.SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    database.SessionLocalInternal = sessionmaker(
        autocommit=False, autoflush=False, bind=database.sqlalchemy_database_engine
    )
    print(f"Recreated engine with URL: {database.SQLALCHEMY_DATABASE_URL}")


def _verify_destination_database(dst_path: Path) -> None:
    """Verify destination database was created correctly."""
    if not dst_path.exists():
        print(f"✗ Destination DB not found after copy: {dst_path}")
        return

    print(f"✓ Destination DB exists after copy: {dst_path}")
    with sqlite3.connect(dst_path) as conn:
        cursor = conn.execute("PRAGMA table_info(practice_record)")
        cols = [row[1] for row in cursor.fetchall()]
        if "difficulty" in cols:
            print("✓ Destination DB has difficulty column in practice_record")
        else:
            print("✗ Destination DB missing difficulty column in practice_record")


@pytest.fixture(autouse=True, scope="function")
def reset_test_db():
    """Automatically copy the clean test DB before each test."""
    repo_root = Path(__file__).parent.parent
    src_path = repo_root / "tunetrees_test_clean.sqlite3"
    dst_path = repo_root / "tunetrees_test.sqlite3"

    _setup_environment_variables(dst_path)
    _verify_source_database(src_path)

    print(f"Copying test DB from {src_path} to {dst_path}")
    shutil.copyfile(src_path, dst_path)

    try:
        _reload_database_engine()
    except Exception as e:
        print(f"Warning: Could not reload database configuration: {e}")

    _verify_destination_database(dst_path)


@pytest.fixture(scope="session")
def api_client():
    """Create a FastAPI TestClient for API testing."""
    app = FastAPI()
    app.include_router(router, prefix="")
    client = TestClient(app)
    yield client
    # Explicit cleanup to help with threading issues
    if hasattr(client, "close"):
        client.close()


# Optional: Fixtures for testing against a live server
# Uncomment and install 'requests' if you need to test against a running server
#
# import time
#
# @pytest.fixture(scope="session")
# def wait_for_server():
#     """Wait for the server to be ready before running tests."""
#     import requests
#     server_url = "http://localhost:8000"
#     health_endpoint = f"{server_url}/health"
#
#     max_retries = 30
#     retry_delay = 1
#
#     for i in range(max_retries):
#         try:
#             response = requests.get(health_endpoint, timeout=5)
#             if response.status_code == 200:
#                 print(f"Server ready after {i} retries")
#                 return server_url
#         except requests.exceptions.RequestException:
#             pass
#
#         print(f"Waiting for server... attempt {i+1}/{max_retries}")
#         time.sleep(retry_delay)
#
#     raise RuntimeError("Server failed to start within timeout period")
