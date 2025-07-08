# moved from test/test_tunetrees_api.py
import pytest
import shutil
import os
from fastapi import FastAPI
from fastapi.testclient import TestClient
from tunetrees.api.tunetrees import router
from tunetrees.app.database import SessionLocal

app = FastAPI()
app.include_router(router, prefix="")
client = TestClient(app)

def test_get_scheduled_tunes_overview(reset_test_db):  # type: ignore
    response = client.get("/tunetrees/scheduled_tunes_overview/1/1")
    assert response.status_code in (200, 404)

def test_get_repertoire_tunes_overview(reset_test_db):  # type: ignore
    response = client.get("/tunetrees/repertoire_tunes_overview/1/1")
    assert response.status_code in (200, 404)

def test_get_tune_staged(reset_test_db):  # type: ignore
    response = client.get("/tunetrees/get_tune_staged/1/1/1")
    assert response.status_code in (200, 404)

def test_playlist_tune_overview(reset_test_db):  # type: ignore
    response = client.get("/tunetrees/playlist-tune-overview/1/1/1")
    assert response.status_code in (200, 404)

def test_playlist_tune(reset_test_db):  # type: ignore
    response = client.get("/tunetrees/playlist_tune/1/1/1")
    assert response.status_code in (200, 404)

def test_intersect_playlist_tunes(reset_test_db):  # type: ignore
    response = client.get(
        "/tunetrees/intersect_playlist_tunes?tune_refs=1&tune_refs=2&playlist_ref=1"
    )
    assert response.status_code in (200, 404)

def test_submit_schedules(reset_test_db):  # type: ignore
    response = client.post("/tunetrees/practice/submit_schedules/1", json={})
    assert response.status_code in (200, 302, 422)

def test_submit_feedbacks(reset_test_db):  # type: ignore
    response = client.post("/tunetrees/practice/submit_feedbacks/1", json={})
    assert response.status_code in (200, 302, 422)

@pytest.fixture(scope="function")
def reset_test_db():
    """Reset the test DB before a test, opt-in by using as a fixture."""
    src = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../tunetrees_test_clean.sqlite3")
    )
    dst = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../tunetrees_test.sqlite3")
    )
    shutil.copyfile(src, dst)
    yield

@pytest.fixture(scope="module")
def db_session():
    with SessionLocal() as db:
        yield db
