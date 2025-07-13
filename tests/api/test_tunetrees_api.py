# moved from test/test_tunetrees_api.py


def test_get_scheduled_tunes_overview(reset_test_db, api_client):  # type: ignore
    response = api_client.get("/tunetrees/scheduled_tunes_overview/1/1")
    assert response.status_code in (200, 404)


def test_get_repertoire_tunes_overview(reset_test_db, api_client):  # type: ignore
    response = api_client.get("/tunetrees/repertoire_tunes_overview/1/1")
    assert response.status_code in (200, 404)


def test_get_tune_staged(reset_test_db, api_client):  # type: ignore
    response = api_client.get("/tunetrees/get_tune_staged/1/1/1")
    assert response.status_code in (200, 404)


def test_playlist_tune_overview(reset_test_db, api_client):  # type: ignore
    response = api_client.get("/tunetrees/playlist-tune-overview/1/1/1")
    assert response.status_code in (200, 404)


def test_playlist_tune(reset_test_db, api_client):  # type: ignore
    response = api_client.get("/tunetrees/playlist_tune/1/1/1")
    assert response.status_code in (200, 404)


def test_intersect_playlist_tunes(reset_test_db, api_client):  # type: ignore
    response = api_client.get(
        "/tunetrees/intersect_playlist_tunes?tune_refs=1&tune_refs=2&playlist_ref=1"
    )
    assert response.status_code in (200, 404)


def test_submit_schedules(reset_test_db, api_client):  # type: ignore
    response = api_client.post("/tunetrees/practice/submit_schedules/1", json={})
    assert response.status_code in (200, 302, 422)


def test_submit_feedbacks(reset_test_db, api_client):  # type: ignore
    response = api_client.post("/tunetrees/practice/submit_feedbacks/1", json={})
    assert response.status_code in (200, 302, 422)
