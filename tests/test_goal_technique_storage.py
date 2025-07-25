"""
Test goal and technique column storage in practice records.

This module tests that the goal and technique columns are properly
stored and retrieved from the practice_record table when practice
feedbacks are submitted.
"""

import os
import pytest
from datetime import datetime, timezone
from tunetrees.app.schedule import update_practice_feedbacks, TuneFeedbackUpdate
from tunetrees.app.database import SessionLocal
from tunetrees.models.tunetrees import PracticeRecord
from sqlalchemy import select, and_


@pytest.fixture(scope="module", autouse=True)
def setup_test_database():
    """Set up test database environment."""
    # Ensure we're using the test database
    os.environ["TUNETREES_DB"] = "tunetrees_test.sqlite3"
    yield
    # Clean up after tests if needed


class TestGoalTechniqueStorage:
    """Test goal and technique column functionality."""

    def test_goal_technique_storage_recall_goal(self):
        """Test that goal and technique values are properly stored for recall goal."""
        # Test data with recall goal (should use FSRS scheduling)
        test_tune_updates = {
            "634": TuneFeedbackUpdate(
                {"feedback": "good", "goal": "recall", "technique": "fsrs"}
            )
        }

        playlist_ref = 1  # Using known existing playlist
        review_date = datetime.now(timezone.utc)

        # Submit the practice feedbacks
        update_practice_feedbacks(test_tune_updates, playlist_ref, review_date)

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
            assert latest_record.technique == "fsrs", (
                f"Expected technique 'fsrs', got '{latest_record.technique}'"
            )
            assert latest_record.quality == 2, (
                f"Expected quality 2 (good), got {latest_record.quality}"
            )

    def test_goal_technique_storage_non_recall_goal(self):
        """Test that goal and technique values are properly stored for non-recall goals."""
        # Test data with non-recall goal (should use goal-specific scheduling)
        test_tune_updates = {
            "634": TuneFeedbackUpdate(
                {"feedback": "easy", "goal": "fluency", "technique": "motor_skills"}
            )
        }

        playlist_ref = 1  # Using known existing playlist
        review_date = datetime.now(timezone.utc)

        # Submit the practice feedbacks
        update_practice_feedbacks(test_tune_updates, playlist_ref, review_date)

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
            assert latest_record.technique == "motor_skills", (
                f"Expected technique 'motor_skills', got '{latest_record.technique}'"
            )
            assert latest_record.quality == 3, (
                f"Expected quality 3 (easy), got {latest_record.quality}"
            )

    def test_goal_technique_defaults(self):
        """Test default values for goal and technique when not provided."""
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
        review_date = datetime.now(timezone.utc)

        # Submit the practice feedbacks
        update_practice_feedbacks(test_tune_updates, playlist_ref, review_date)

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
            assert latest_record.technique == "fsrs", (
                f"Expected default technique 'fsrs', got '{latest_record.technique}'"
            )

    def test_multiple_tunes_different_goals(self):
        """Test storing multiple tunes with different goals and techniques."""
        # Test data with multiple tunes and different goals
        test_tune_updates = {
            "634": TuneFeedbackUpdate(
                {"feedback": "good", "goal": "session_ready", "technique": "metronome"}
            ),
            "635": TuneFeedbackUpdate(
                {
                    "feedback": "hard",
                    "goal": "performance_polish",
                    "technique": "daily_practice",
                }
            ),
        }

        playlist_ref = 1  # Using known existing playlist
        review_date = datetime.now(timezone.utc)

        # Submit the practice feedbacks
        update_practice_feedbacks(test_tune_updates, playlist_ref, review_date)

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
            assert record1.technique == "metronome", (
                f"Expected technique 'metronome', got '{record1.technique}'"
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
            assert record2.technique == "daily_practice", (
                f"Expected technique 'daily_practice', got '{record2.technique}'"
            )

    def test_goal_technique_in_views(self):
        """Test that goal and technique columns appear in database views."""
        with SessionLocal() as db:
            # Test practice_list_joined view includes goal and technique
            try:
                from sqlalchemy import text

                db.execute(
                    text("SELECT goal, technique FROM practice_list_joined LIMIT 1")
                ).fetchone()
                # Should not raise an error - columns should exist
                assert True, (
                    "practice_list_joined view should include goal and technique columns"
                )
            except Exception as e:
                pytest.fail(
                    f"practice_list_joined view missing goal/technique columns: {e}"
                )

            # Test practice_list_staged view includes goal and technique
            try:
                db.execute(
                    text("SELECT goal, technique FROM practice_list_staged LIMIT 1")
                ).fetchone()
                # Should not raise an error - columns should exist
                assert True, (
                    "practice_list_staged view should include goal and technique columns"
                )
            except Exception as e:
                pytest.fail(
                    f"practice_list_staged view missing goal/technique columns: {e}"
                )
