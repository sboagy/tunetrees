import pytest
from fastapi.testclient import TestClient
from tunetrees.api.tunetrees import router
from tunetrees.app.database import SessionLocal
# from tunetrees.app.queries import (
#     query_practice_list_scheduled,
#     query_practice_list_recently_played,
#     query_tune_staged,
# )

# pyright: reportUnknownParameterType=false

client = TestClient(router)


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_practice_page():
    response = client.get("/tunetrees/practice")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_get_scheduled(db_session):
    response = client.get("/tunetrees/get_practice_list_scheduled/1/1")
    assert response.status_code == 200
    assert isinstance(response.json(), list) or "error" in response.json()


def test_get_recently_played(db_session):
    response = client.get("/tunetrees/get_tunes_recently_played/1/1")
    assert response.status_code == 200
    assert isinstance(response.json(), list) or "error" in response.json()


def test_get_tune_staged(db_session):
    response = client.get("/tunetrees/get_tune_staged/1/1/1060")
    assert response.status_code == 200
    assert isinstance(response.json(), list) or "error" in response.json()
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    item = data[0]
    expected_keys = {
        "id",
        "title",
        "type",
        "structure",
        "mode",
        "incipit",
        "genre",
        "learned",
        "user_ref",
        "playlist_ref",
        "instrument",
        "practiced",
        "quality",
        "easiness",
        "interval",
        "repetitions",
        "review_date",
        "backup_practiced",
        "note_private",
        "note_public",
        "tags",
        "purpose",
    }
    assert set(item.keys()) == expected_keys
    assert item["id"] == 1060
    assert item["title"] == "Kitty's Wedding"
    assert item["type"] == "Hpipe"
    assert item["structure"] == "AABB"
    assert item["mode"] == "D Major"
    assert item["incipit"] == "|d2Bd A2FA|BAFA D2ED|"
    assert item["genre"] == "ITRAD"
    assert item["learned"] == "2004-11-23"
    assert item["user_ref"] == 1
    assert item["playlist_ref"] == 1
    assert item["instrument"] == "flute"
    assert item["practiced"] is not None
    # assert item["quality"] == "5"
    # assert item["easiness"] == 2.0200000000000005
    # assert item["interval"] == 204
    # assert item["repetitions"] == 8
    # assert item["review_date"] == "2025-01-27 12:27:08"
    # assert item["backup_practiced"] == "2021-08-25 23:43:55"
    # assert item["note_private"] is None
    # assert item["note_public"] is None
    # assert item["tags"] is None
    # assert item["purpose"] is None

    # [
    #   {
    #     "id": 1060,
    #     "title": "Kitty's Wedding",
    #     "type": "Hpipe",
    #     "structure": "AABB",
    #     "mode": "D Major",
    #     "incipit": "|d2Bd A2FA|BAFA D2ED|",
    #     "learned": "2004-11-23",
    #     "user_ref": 1,
    #     "playlist_ref": 1,
    #     "instrument": "flute",
    #     "practiced": "2024-07-07 12:27:08",
    #     "quality": "5",
    #     "easiness": 2.0200000000000005,
    #     "interval": 204,
    #     "repetitions": 8,
    #     "review_date": "2025-01-27 12:27:08",
    #     "backup_practiced": "2021-08-25 23:43:55",
    #     "note_private": null,
    #     "note_public": null,
    #     "tags": null,
    #     "purpose": null
    #   }
    # ]


# def test_submit_feedback():
#     response = client.post(
#         "/tunetrees/practice/submit_feedback",
#         data={
#             "selected_tune": 1,
#             "vote_type": "like",
#             "user_id": "1",
#             "playlist_id": "1",
#         },
#     )
#     assert response.status_code == 302


@pytest.mark.skip(
    reason="This test needs to figure out a testing strategy re DB state."
)
def test_submit_schedules():
    response = client.post(
        "/tunetrees/practice/submit_schedules/1",
        json={"1": {"schedule_date": "2024-07-08"}},
    )
    assert response.status_code == 302


@pytest.mark.skip(
    reason="This test needs to figure out a testing strategy re DB state."
)
def test_submit_feedbacks():
    response = client.post(
        "/tunetrees/practice/submit_feedbacks/1",
        json={"1": {"feedback": "Great tune!"}},
    )
    assert response.status_code == 302


# def test_feedback():
#     response = client.post(
#         "/tunetrees/practice/feedback",
#         data={
#             "selected_tune": 1,
#             "vote_type": "like",
#             "user_id": "1",
#             "playlist_id": "1",
#         },
#     )
#     assert response.status_code == 302
