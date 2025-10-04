"""
Test goal and technique column storage in practice records.

This module tests that the goal and technique columns are properly
stored and retrieved from the practice_record table when practice
feedbacks are submitted.
"""

import os
import threading
from datetime import datetime

import pytest
from sqlalchemy import and_, select

from tests.conftest import reset_test_db_function
from tunetrees.app.database import SessionLocal
from tunetrees.app.schedule import TuneFeedbackUpdate, update_practice_feedbacks
from tunetrees.models.tunetrees import PracticeRecord


@pytest.fixture(scope="module", autouse=True)
def setup_test_database():
    """Set up test database environment."""
    # Ensure we're using the test database
    os.environ["TUNETREES_DB"] = "tunetrees_test.sqlite3"
    yield
    # Clean up after tests if needed


# Module-level semaphore to force tests in this module to run serially
_module_semaphore = threading.Semaphore(1)


@pytest.fixture(autouse=True)
def _serial_test_lock():  # pyright: ignore[reportUnusedFunction]
    """Acquire a semaphore for each test in this module to serialize execution.

    This only serializes tests within the same Python process. If pytest-xdist
    or another parallel runner is used, inter-process isolation must be
    handled separately (for example, per-worker DB files).
    """
    _module_semaphore.acquire()
    try:
        print("Acquired serial test lock")
        yield
    finally:
        try:
            print("Released serial test lock")
            _module_semaphore.release()
        except Exception:
            pass


class TestGoalTechniqueStorage:
    """Test goal and technique column functionality."""

    def test_goal_technique_storage_recall_goal(self):
        """Test that goal and technique values are properly stored for recall goal."""
        reset_test_db_function()

        # Test data with recall goal (should use FSRS scheduling)
        test_tune_updates = {
            "634": TuneFeedbackUpdate({"feedback": "good", "goal": "recall"})
        }

        playlist_ref = 1  # Using known existing playlist
        due = datetime.fromisoformat("2024-12-31 11:47:57.671465-00:00")

        # Submit the practice feedbacks
        update_practice_feedbacks(test_tune_updates, playlist_ref, due)

        # Verify the data was stored correctly
        with SessionLocal() as db:
            stmt = (
                select(PracticeRecord)
                .where(
                    and_(
                        PracticeRecord.tune_ref == "634",
                        PracticeRecord.playlist_ref == playlist_ref,
                    )
                )
                .order_by(PracticeRecord.id.desc())
            )

            latest_record = db.execute(stmt).scalars().first()

            assert latest_record is not None, "Practice record should be created"
            assert latest_record.goal == "recall", (
                f"Expected goal 'recall', got '{latest_record.goal}'"
            )
            assert latest_record.quality == 2, (
                f"Expected quality 2 (good), got {latest_record.quality}"
            )

    def test_goal_technique_storage_non_recall_goal(self):
        """Test that goal and technique values are properly stored for non-recall goals."""
        reset_test_db_function()

        # Test data with non-recall goal (should use goal-specific scheduling)
        test_tune_updates = {
            "634": TuneFeedbackUpdate({"feedback": "easy", "goal": "fluency"})
        }

        playlist_ref = 1  # Using known existing playlist
        due = datetime.fromisoformat("2024-12-31 11:47:57.671465-00:00")

        # Submit the practice feedbacks
        update_practice_feedbacks(test_tune_updates, playlist_ref, due)

        # Verify the data was stored correctly
        with SessionLocal() as db:
            stmt = (
                select(PracticeRecord)
                .where(
                    and_(
                        PracticeRecord.tune_ref == "634",
                        PracticeRecord.playlist_ref == playlist_ref,
                    )
                )
                .order_by(PracticeRecord.id.desc())
            )

            latest_record = db.execute(stmt).scalars().first()

            assert latest_record is not None, "Practice record should be created"
            assert latest_record.goal == "fluency", (
                f"Expected goal 'fluency', got '{latest_record.goal}'"
            )
            assert latest_record.quality == 3, (
                f"Expected quality 3 (easy), got {latest_record.quality}"
            )
            db.flush()  # Ensure changes are committed before next test

    def test_goal_technique_defaults(self):
        """Test default values for goal and technique when not provided."""
        reset_test_db_function()

        # Test data without explicit goal/technique
        test_tune_updates = {
            "634": TuneFeedbackUpdate(
                {
                    "feedback": "good"
                    # No goal or technique specified
                }
            )
        }

        playlist_ref = 1  # Using known existing playlist
        due = datetime.fromisoformat("2024-12-31 11:47:57.671465-00:00")

        # Submit the practice feedbacks
        update_practice_feedbacks(test_tune_updates, playlist_ref, due)

        # Verify the data was stored with defaults
        with SessionLocal() as db:
            stmt = (
                select(PracticeRecord)
                .where(
                    and_(
                        PracticeRecord.tune_ref == "634",
                        PracticeRecord.playlist_ref == playlist_ref,
                    )
                )
                .order_by(PracticeRecord.id.desc())
            )

            latest_record = db.execute(stmt).scalars().first()

            assert latest_record is not None, "Practice record should be created"
            assert latest_record.goal == "recall", (
                f"Expected default goal 'recall', got '{latest_record.goal}'"
            )

    def test_multiple_tunes_different_goals(self):
        """Test storing multiple tunes with different goals and techniques."""
        reset_test_db_function()

        # Test data with multiple tunes and different goals
        test_tune_updates = {
            "634": TuneFeedbackUpdate({"feedback": "good", "goal": "session_ready"}),
            "635": TuneFeedbackUpdate(
                {
                    "feedback": "hard",
                    "goal": "performance_polish",
                }
            ),
        }

        playlist_ref = 1  # Using known existing playlist
        due = datetime.fromisoformat("2024-12-31 11:47:57.671465-00:00")

        # Submit the practice feedbacks
        update_practice_feedbacks(test_tune_updates, playlist_ref, due)

        # Verify the data was stored correctly for both tunes
        with SessionLocal() as db:
            # Check first tune
            stmt = (
                select(PracticeRecord)
                .where(
                    and_(
                        PracticeRecord.tune_ref == "634",
                        PracticeRecord.playlist_ref == playlist_ref,
                    )
                )
                .order_by(PracticeRecord.id.desc())
            )

            record1 = db.execute(stmt).scalars().first()
            assert record1 is not None, "Practice record should be created for tune 634"
            assert record1.goal == "session_ready", (
                f"Expected goal 'session_ready', got '{record1.goal}'"
            )

            # Check second tune
            stmt = (
                select(PracticeRecord)
                .where(
                    and_(
                        PracticeRecord.tune_ref == "635",
                        PracticeRecord.playlist_ref == playlist_ref,
                    )
                )
                .order_by(PracticeRecord.id.desc())
            )

            record2 = db.execute(stmt).scalars().first()
            assert record2 is not None, "Practice record should be created for tune 635"
            assert record2.goal == "performance_polish", (
                f"Expected goal 'performance_polish', got '{record2.goal}'"
            )
