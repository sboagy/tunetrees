import shutil
import os
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from tunetrees.api.tunetrees import router


@pytest.fixture(autouse=True, scope="function")
def reset_test_db():
    """Automatically copy the clean test DB before each test."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    src = os.path.join(repo_root, "tunetrees_test_clean.sqlite3")
    dst = os.path.join(repo_root, "tunetrees_test.sqlite3")
    print(f"Copying test DB from {src} to {dst}")
    shutil.copyfile(src, dst)


@pytest.fixture(scope="session")
def api_client():
    """Create a FastAPI TestClient for API testing."""
    app = FastAPI()
    app.include_router(router, prefix="")
    return TestClient(app)


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
