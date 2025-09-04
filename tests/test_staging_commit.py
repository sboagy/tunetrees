from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import text

from tunetrees.api.main import app
from tunetrees.app.database import SessionLocal
from tunetrees.app.database import SessionLocal as _SessionLocal
from tunetrees.models.tunetrees import PracticeRecord, TableTransientData

client = TestClient(app)


def _ensure_staging_columns():
    """Add newly introduced staging columns to legacy test DB if they are missing.

    This provides backward compatibility until a formal migration adds them.
    """
    with _SessionLocal() as db:
        existing_cols = {
            row[1]
            for row in db.execute(
                text("PRAGMA table_info('table_transient_data')")
            ).fetchall()
        }
        col_defs = {
            "practiced": "TEXT",
            "quality": "INTEGER",
            "easiness": "FLOAT",
            "difficulty": "FLOAT",
            "interval": "INTEGER",
            "step": "INTEGER",
            "repetitions": "INTEGER",
            "due": "TEXT",
            "backup_practiced": "TEXT",
            "goal": "TEXT",
            "technique": "TEXT",
            "stability": "FLOAT",
        }
        for col, ddl_type in col_defs.items():
            if col not in existing_cols:
                db.execute(
                    text(
                        f"ALTER TABLE table_transient_data ADD COLUMN {col} {ddl_type}"
                    )
                )
        db.commit()


def test_staging_and_commit_flow(reset_test_db):  # type: ignore
    """End-to-end test: stage feedback then commit and verify PracticeRecord insertion and clearing of staging fields."""
    playlist_id = 1
    tune_id = 1
    sitdown = datetime.now(timezone.utc).replace(microsecond=0)
    sitdown_qs = sitdown.strftime("%Y-%m-%dT%H:%M:%S")

    # Stage a 'good' review
    _ensure_staging_columns()
    resp = client.post(
        f"/tunetrees/practice/submit_feedbacks/{playlist_id}?sitdown_date={sitdown_qs}&stage=true",
        json={str(tune_id): {"feedback": "good"}},
    )
    assert resp.status_code in (200, 302), resp.text

    # Verify transient row populated
    with SessionLocal() as db:
        transient = (
            db.query(TableTransientData)
            .filter(
                TableTransientData.user_id == 1,
                TableTransientData.playlist_id == playlist_id,
                TableTransientData.tune_id == tune_id,
                TableTransientData.purpose == "practice",
            )
            .first()
        )
        assert transient is not None, "Transient staging row should exist"
        assert transient.quality is not None, "Quality should be staged"
        staged_practiced = transient.practiced

    # Commit staged
    commit_resp = client.post(f"/tunetrees/practice/commit_staged/{playlist_id}")
    assert commit_resp.status_code == 200, commit_resp.text
    result = commit_resp.json()
    assert result.get("status") == "ok"
    assert result.get("count", 0) >= 1

    # Verify PracticeRecord inserted and staging cleared
    with SessionLocal() as db:
        pr = (
            db.query(PracticeRecord)
            .filter(
                PracticeRecord.playlist_ref == playlist_id,
                PracticeRecord.tune_ref == tune_id,
            )
            .order_by(PracticeRecord.id.desc())
            .first()
        )
        assert pr is not None, "PracticeRecord should be created after commit"
        # practiced may have been adjusted for uniqueness; ensure at least same date prefix
        assert pr.practiced[:16] == staged_practiced[:16]
        transient_after = (
            db.query(TableTransientData)
            .filter(
                TableTransientData.user_id == 1,
                TableTransientData.playlist_id == playlist_id,
                TableTransientData.tune_id == tune_id,
                TableTransientData.purpose == "practice",
            )
            .first()
        )
        assert transient_after is not None
        assert transient_after.practiced is None, (
            "Staging practiced should be cleared after commit"
        )
        assert transient_after.quality is None, (
            "Staging quality should be cleared after commit"
        )


def test_staging_clear(reset_test_db):  # type: ignore
    """Stage then clear a feedback and ensure transient fields null out."""
    playlist_id = 1
    tune_id = 1
    sitdown = datetime.now(timezone.utc).replace(microsecond=0)
    sitdown_qs = sitdown.strftime("%Y-%m-%dT%H:%M:%S")

    # Stage first
    _ensure_staging_columns()
    resp = client.post(
        f"/tunetrees/practice/submit_feedbacks/{playlist_id}?sitdown_date={sitdown_qs}&stage=true",
        json={str(tune_id): {"feedback": "good"}},
    )
    assert resp.status_code in (200, 302)

    # Clear staging
    resp_clear = client.post(
        f"/tunetrees/practice/submit_feedbacks/{playlist_id}?sitdown_date={sitdown_qs}&stage=true",
        json={str(tune_id): {"feedback": "(Not Set)"}},
    )
    assert resp_clear.status_code in (200, 302)

    with SessionLocal() as db:
        transient = (
            db.query(TableTransientData)
            .filter(
                TableTransientData.user_id == 1,
                TableTransientData.playlist_id == playlist_id,
                TableTransientData.tune_id == tune_id,
                TableTransientData.purpose == "practice",
            )
            .first()
        )
        assert transient is not None
        assert transient.practiced is None
        assert transient.quality is None
        assert transient.due is None
