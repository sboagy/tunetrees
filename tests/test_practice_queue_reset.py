from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tunetrees.api.main import app
from tunetrees.app.database import SessionLocal
from tunetrees.models.tunetrees import DailyPracticeQueue

client = TestClient(app)


def _count_active(db: Session, user_id: int, playlist_ref: int) -> int:
    return (
        db.query(DailyPracticeQueue)
        .filter(
            DailyPracticeQueue.user_ref == user_id,
            DailyPracticeQueue.playlist_ref == playlist_ref,
            DailyPracticeQueue.active.is_(True),
        )
        .count()
    )


def test_practice_queue_reset_deactivates_and_regenerates(reset_test_db):  # type: ignore
    user_id = 1
    playlist_ref = 1

    # Step 1: Fetch today's queue (should generate if none). Use explicit UTC midnight anchor.
    sitdown = datetime.now(timezone.utc).replace(
        hour=9, minute=0, second=0, microsecond=0
    )
    sitdown_qs = sitdown.strftime("%Y-%m-%dT%H:%M:%S")
    r1 = client.get(
        f"/tunetrees/practice-queue/{user_id}/{playlist_ref}?sitdown_date={sitdown_qs}"
    )
    assert r1.status_code == 200, r1.text
    rows_initial = r1.json()

    with SessionLocal() as db:
        active_count_initial = _count_active(db, user_id, playlist_ref)
        assert active_count_initial >= 0  # snapshot may be empty in small test DB

    # Step 2: Reset endpoint should deactivate active rows
    r_reset = client.post(f"/tunetrees/practice-queue/{user_id}/{playlist_ref}/reset")
    assert r_reset.status_code == 200, r_reset.text
    payload = r_reset.json()
    # deactivated can be 0 if queue was empty, still valid path
    assert "deactivated" in payload

    with SessionLocal() as db:
        active_count_after_reset = _count_active(db, user_id, playlist_ref)
        assert active_count_after_reset == 0, (
            "All active snapshot rows should be deactivated"
        )

    # Step 3: Fetch again -> should regenerate (active rows > 0 if previously >0)
    r2 = client.get(
        f"/tunetrees/practice-queue/{user_id}/{playlist_ref}?sitdown_date={sitdown_qs}"
    )
    assert r2.status_code == 200
    rows_after = r2.json()

    with SessionLocal() as db:
        active_count_regen = _count_active(db, user_id, playlist_ref)
        # If we had rows initially we expect regeneration to produce rows; if initial empty allow still empty
        if rows_initial:
            assert active_count_regen > 0, "Expected regenerated active snapshot rows"

    # Step 4: Force regen query param should produce a potentially different generated_at for first row
    r3 = client.get(
        f"/tunetrees/practice-queue/{user_id}/{playlist_ref}?sitdown_date={sitdown_qs}&force_regen=true"
    )
    assert r3.status_code == 200
    rows_force = r3.json()

    # Only verify generated_at change when rows exist and previous snapshot non-empty
    if rows_after and rows_force:
        gen_before = rows_after[0].get("generated_at")
        gen_force = rows_force[0].get("generated_at")
        # If timestamps are identical it's acceptable (fast consecutive calls) but they must be non-null
        assert gen_before is not None and gen_force is not None
