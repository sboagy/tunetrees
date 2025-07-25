import shutil
import sqlite3
import pytest
import gc
import threading
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from tunetrees.api.tunetrees import router


# Set test database environment variable before any imports that use the database
os.environ["TUNETREES_DB"] = "tunetrees_test.sqlite3"


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    """Clean up resources after all tests are done."""
    # Force garbage collection to clean up any remaining objects
    gc.collect()

    # Give threads a moment to clean up
    threading_active = threading.active_count()
    if threading_active > 1:  # Main thread + any others
        print(f"Active threads at session end: {threading_active}")


@pytest.fixture(autouse=True, scope="function")
def reset_test_db():
    """Automatically copy the clean test DB before each test."""
    repo_root = Path(__file__).parent.parent
    src_path = repo_root / "tunetrees_test_clean.sqlite3"
    dst_path = repo_root / "tunetrees_test.sqlite3"

    # Debug: Check if source file exists and has the difficulty column
    if src_path.exists():
        print(f"Source DB exists: {src_path}")
        # Quick check for difficulty column in source
        with sqlite3.connect(src_path) as conn:
            cursor = conn.execute("PRAGMA table_info(practice_record)")
            cols = [row[1] for row in cursor.fetchall()]
            if "difficulty" in cols:
                print("✓ Source DB has difficulty column in practice_record")
            else:
                print("✗ Source DB missing difficulty column in practice_record")
    else:
        print(f"✗ Source DB not found: {src_path}")

    print(f"Copying test DB from {src_path} to {dst_path}")
    shutil.copyfile(src_path, dst_path)

    # Debug: Verify the copy worked
    if dst_path.exists():
        print(f"✓ Destination DB exists after copy: {dst_path}")
        with sqlite3.connect(dst_path) as conn:
            cursor = conn.execute("PRAGMA table_info(practice_record)")
            cols = [row[1] for row in cursor.fetchall()]
            if "difficulty" in cols:
                print("✓ Destination DB has difficulty column in practice_record")
            else:
                print("✗ Destination DB missing difficulty column in practice_record")
    else:
        print(f"✗ Destination DB not found after copy: {dst_path}")


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
