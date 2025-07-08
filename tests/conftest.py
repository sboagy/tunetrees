import shutil
import os
import pytest


@pytest.fixture(autouse=True, scope="function")
def reset_test_db():
    """Automatically copy the clean test DB before each test."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    src = os.path.join(repo_root, "tunetrees_test_clean.sqlite3")
    dst = os.path.join(repo_root, "tunetrees_test.sqlite3")
    print(f"Copying test DB from {src} to {dst}")
    shutil.copyfile(src, dst)
