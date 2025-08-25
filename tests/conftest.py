import os
import shutil
import sqlite3
import threading
import tempfile
import fcntl
from pathlib import Path

import pytest

# Set test database environment variable BEFORE any imports that use the database
os.environ["TUNETREES_DB"] = "tunetrees_test.sqlite3"
# Disable aggressive journal mode tweaking & integrity checks if desired to reduce locking
os.environ.setdefault("TT_ENABLE_SQLITE_DELETE_JOURNAL", "0")
os.environ.setdefault("TT_ENABLE_SQLITE_INTEGRITY_CHECKS", "1")

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# --- Python 3.13 dummy thread finalizer workaround ---------------------------------
# In Python 3.13 a regression (see bpo discussions around dummy threads & shutdown)
# can surface as: TypeError: 'NoneType' object does not support the context manager protocol
# inside threading._DeleteDummyThreadOnDel.__del__ when interpreter globals are torn
# down before all dummy thread objects are finalized. This causes noisy test teardown
# output but does not impact correctness. We defensively monkeypatch the __del__ to
# guard against a cleared lock object. Remove once upstream fix is released.
try:  # pragma: no cover - environment specific
    import threading as _tt

    _delete_cls = getattr(_tt, "_DeleteDummyThreadOnDel", None)  # type: ignore[attr-defined]
    if _delete_cls is not None:  # pragma: no branch
        _orig_del = getattr(_delete_cls, "__del__", None)
        if _orig_del:

            def _safe_del(self):  # type: ignore[no-redef]
                lock = getattr(self, "_lock", None)
                if lock is None:
                    return
                try:
                    _orig_del(self)  # type: ignore[misc]
                except TypeError:
                    return
                except Exception:
                    return

            try:
                _delete_cls.__del__ = _safe_del  # type: ignore[assignment]
            except Exception:
                pass
except Exception:
    pass
# -------------------------------------------------------------------------------


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    """Clean up resources after all tests are done.

    NOTE (Python 3.13): Explicit GC at interpreter shutdown can interact badly
    with the new threading finalizer path, triggering:
        TypeError: 'NoneType' object does not support the context manager protocol
    in _DeleteDummyThreadOnDel.__del__ when dummy thread objects are collected
    after runtime globals (like locks) are already cleared. Removing the eager
    gc.collect() here avoids that race. We only emit a lightweight diagnostic
    about leftover threads instead of forcing collection.
    """
    try:
        # Avoid gc.collect(); let interpreter manage final collection to prevent
        # _DeleteDummyThreadOnDel races under Python 3.13+.
        threading_active = threading.active_count()
        if threading_active > 1:  # Main thread + any others
            # List non-daemon alive threads for debugging (best‑effort)
            leftover = [
                t.name
                for t in threading.enumerate()
                if t.is_alive() and t.name != "MainThread"
            ]
            print(
                f"Active threads at session end (not joined): {threading_active - 1} -> {leftover}"
            )
    except Exception as e:  # pragma: no cover - defensive
        print(f"pytest_sessionfinish diagnostic failed: {e}")


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
    if hasattr(database, "sqlalchemy_database_engine"):
        database.sqlalchemy_database_engine.dispose()
        print("Disposed existing SQLAlchemy engine")

    # Recalculate database path
    database.db_location_str = os.environ.get(
        "TUNETREES_DB", os.environ.get("DATABASE_URL")
    )
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

    database.SQLALCHEMY_DATABASE_URL = (
        f"sqlite:///{database.db_location_path.absolute()}"
    )

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
    """Verify destination database was created correctly using a direct connection."""
    if not dst_path.exists():
        print(f"✗ Destination DB not found after copy: {dst_path}")
        raise FileNotFoundError(f"Destination DB not found: {dst_path}")

    print(f"✓ Destination DB exists after copy: {dst_path}")
    # Tiny retry to avoid transient "unable to open database file" immediately after replace
    last_err: Exception | None = None
    for _ in range(5):
        try:
            with sqlite3.connect(str(dst_path)) as conn:
                cursor = conn.execute("PRAGMA table_info(practice_record)")
                cols = [row[1] for row in cursor.fetchall()]
                if "difficulty" in cols:
                    print("✓ Destination DB has difficulty column in practice_record")
                else:
                    print(
                        "✗ Destination DB missing difficulty column in practice_record"
                    )
                return
        except Exception as e:  # pragma: no cover - rare
            last_err = e
            import time

            time.sleep(0.05)
    # If still failing after retries, raise the last error
    if last_err:
        raise last_err


@pytest.fixture(autouse=True, scope="function")
def reset_test_db():
    reset_test_db_function()


def reset_test_db_function():
    """Automatically copy the clean test DB before each test."""
    repo_root = Path(__file__).parent.parent
    src_path = repo_root / "tunetrees_test_clean.sqlite3"
    dst_path = repo_root / "tunetrees_test.sqlite3"

    from tunetrees.app import database  # local import to access engine

    _setup_environment_variables(dst_path)
    _verify_source_database(src_path)

    # Serialize copy/replace with a file lock to prevent races
    lock_path = repo_root / ".reset_test_db.lock"
    lock_path.touch(exist_ok=True)

    with open(lock_path, "r+") as lockf:
        fcntl.flock(lockf, fcntl.LOCK_EX)
        try:
            # Dispose engine to release file handles
            if hasattr(database, "sqlalchemy_database_engine"):
                try:
                    database.sqlalchemy_database_engine.dispose()
                    print("Disposed existing SQLAlchemy engine")
                except Exception:
                    pass

            # Clean up any leftover WAL/SHM files
            wal_path = Path(f"{dst_path}-wal")
            shm_path = Path(f"{dst_path}-shm")
            for p in (wal_path, shm_path):
                if p.exists():
                    try:
                        p.unlink()
                        print(f"Removed leftover {p.name}")
                    except Exception:
                        pass

            # Atomic replace: copy to a temp file then replace
            with tempfile.NamedTemporaryFile(delete=False, dir=repo_root) as tmpf:
                tmp_name = tmpf.name
            try:
                print(f"Copying test DB from {src_path} to temp {tmp_name}")
                shutil.copyfile(src_path, tmp_name)
                os.replace(tmp_name, dst_path)
                print(f"Replaced {dst_path} atomically")
            finally:
                try:
                    if os.path.exists(tmp_name):
                        os.remove(tmp_name)
                except Exception:
                    pass

            # Verify destination using read-only connection before engine reload
            _verify_destination_database(dst_path)

            # Recreate engine bound to the fresh DB
            try:
                _reload_database_engine()
            except Exception as e:
                print(f"Warning: Could not reload database configuration: {e}")
        finally:
            try:
                fcntl.flock(lockf, fcntl.LOCK_UN)
            except Exception:
                pass


@pytest.fixture(scope="session")
def api_client():
    """Create a FastAPI TestClient for API testing."""
    from tunetrees.api.tunetrees import router  # delayed import to avoid locking

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
