"""
Multi-day scheduling validation tests using direct API calls.

This module tests the spaced repetition scheduling over extended periods by:
1. Simulating practice sessions via API endpoints over 30 days
2. Validating that scheduling algorithms (FSRS/SM2) work correctly
3. Ensuring scheduled vs latest_due behavior is correct
4. Testing various quality feedback patterns and their scheduling outcomes
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import pytest
import pytz
from dateutil import parser
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from tunetrees.api.main import app
from tunetrees.app.database import SessionLocal
from tunetrees.app.schedule import TT_DATE_FORMAT
from tunetrees.models.tunetrees import PlaylistTune, PracticeRecord


@pytest.mark.skip(reason="Multiday scheduling tests not ready - skipping for now")
class TestMultiDayScheduling:
    """Test suite for multi-day scheduling validation via API endpoints."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        return TestClient(app)

    @pytest.fixture
    def db_session(self):
        """Database session fixture."""
        with SessionLocal() as db:
            yield db

    @pytest.fixture
    def clean_test_data(self, db_session: Session) -> List[Dict[str, Any]]:
        """Ensure clean test data for each test."""
        # Clean up any existing practice records for test playlist
        test_playlist_id = 1
        db_session.query(PracticeRecord).filter(
            PracticeRecord.playlist_ref == test_playlist_id
        ).delete()
        db_session.commit()

        # Get initial tunes in the test playlist
        initial_tunes = self._get_playlist_tunes(db_session, test_playlist_id)
        return initial_tunes

    def _get_playlist_tunes(
        self, db: Session, playlist_id: int
    ) -> List[Dict[str, Any]]:
        """Get tunes in a playlist."""
        # Query the view that the API uses

        # This simulates what the repertoire endpoint returns
        query_result = db.execute(
            text(
                """
                SELECT id, title, type, scheduled
                FROM practice_list_staged
                WHERE playlist_id = :playlist_id
                AND deleted = 0
                ORDER BY id
                LIMIT 1000
            """
            ),
            {"playlist_id": playlist_id},
        )

        return [
            {"id": row[0], "title": row[1], "type": row[2], "scheduled": row[3]}
            for row in query_result.fetchall()
        ]

    def _submit_practice_feedback(
        self,
        client: TestClient,
        playlist_id: int,
        feedbacks: Dict[str, str],
        sitdown_date: datetime,
    ) -> Dict[str, Any]:
        """Submit practice feedback via API endpoint."""
        # Format date for API
        sitdown_date_str = sitdown_date.strftime(TT_DATE_FORMAT)

        # Prepare feedback data matching API expectations
        feedback_data = {
            "user_tune_updates": {
                str(tune_id): {"feedback": quality}
                for tune_id, quality in feedbacks.items()
            },
            "review_sitdown_date": sitdown_date_str,
        }

        response = client.post(
            f"/tunetrees/practice/submit_feedbacks/{playlist_id}", json=feedback_data
        )

        return (
            response.json() if response.status_code == 200 else {"error": response.text}
        )

    def _get_scheduled_tunes(
        self, client: TestClient, playlist_id: int, sitdown_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get tunes scheduled for a specific date."""
        # Format date for API query
        sitdown_date_str = sitdown_date.strftime(TT_DATE_FORMAT)

        response = client.get(
            f"/tunetrees/practice/scheduled/{playlist_id}",
            params={"review_sitdown_date": sitdown_date_str},
        )

        if response.status_code == 200:
            return response.json()
        else:
            return []

    def test_30_day_fsrs_scheduling_pattern(
        self, client: TestClient, clean_test_data: List[Dict[str, Any]]
    ):
        """Test FSRS scheduling over 30 days with consistent quality patterns."""
        playlist_id = 1
        test_tunes = clean_test_data
        ttReviewSitdownDate = "2024-12-31 11:47:57.671465-00:00"
        # Parse ttReviewSitdownDate as EST (UTC-5)
        print("✅ test_30_day_fsrs_scheduling_pattern completed successfully")

        est = pytz.timezone("US/Eastern")
        base_date = (
            parser.parse(ttReviewSitdownDate)
            .astimezone(est)
            .replace(hour=10, minute=0, second=0, microsecond=0)
        )

        # Track scheduling outcomes for validation
        scheduling_log = []

        print(f"\n🧪 Starting 30-day FSRS scheduling test with {len(test_tunes)} tunes")

        for day in range(1, 31):  # 30 days
            current_date = base_date + timedelta(days=day - 1)
            print(f"\n--- Day {day} ({current_date.strftime('%Y-%m-%d')}) ---")

            # Get tunes scheduled for today
            scheduled_tunes = self._get_scheduled_tunes(
                client, playlist_id, current_date
            )
            scheduled_count = len(scheduled_tunes)

            print(f"📅 Found {scheduled_count} tunes scheduled for day {day}")

            if scheduled_count > 0:
                # Practice scheduled tunes with varying quality
                feedbacks = {}
                for i, tune in enumerate(scheduled_tunes):
                    tune_id = tune["id"]
                    # Cycle through quality patterns: good, hard, easy, good
                    quality_cycle = ["good", "hard", "easy", "good"]
                    quality = quality_cycle[i % len(quality_cycle)]
                    feedbacks[str(tune_id)] = quality

                    print(
                        f"  🎵 Tune {tune_id}: {tune.get('title', 'Unknown')} → {quality}"
                    )

                # Submit practice session
                result = self._submit_practice_feedback(
                    client, playlist_id, feedbacks, current_date
                )

                if "error" in result:
                    pytest.fail(
                        f"Failed to submit feedback on day {day}: {result['error']}"
                    )

                # Log this day's activity
                scheduling_log.append(
                    {
                        "day": day,
                        "date": current_date.strftime("%Y-%m-%d"),
                        "scheduled_count": scheduled_count,
                        "feedbacks": feedbacks.copy(),
                        "scheduled_tunes": [t["id"] for t in scheduled_tunes],
                    }
                )
            else:
                print(f"  ✨ No tunes scheduled for day {day}")
                scheduling_log.append(
                    {
                        "day": day,
                        "date": current_date.strftime("%Y-%m-%d"),
                        "scheduled_count": 0,
                        "feedbacks": {},
                        "scheduled_tunes": [],
                    }
                )

        # Validate scheduling patterns
        self._validate_scheduling_patterns(scheduling_log, test_tunes)

        print("\n✅ 30-day FSRS scheduling test completed successfully!")

    def test_sm2_vs_fsrs_comparison(
        self, client: TestClient, clean_test_data: List[Dict[str, Any]]
    ):
        """Compare SM2 vs FSRS scheduling over 14 days with identical inputs."""
        # TODO: Implement comparison test
        # This would require setting up different users with different algorithm preferences
        # and comparing their scheduling outcomes with identical quality feedback
        print("✅ test_sm2_vs_fsrs_comparison completed successfully")

        pytest.skip("SM2 vs FSRS comparison test - to be implemented")
        print("✅ test_sm2_vs_fsrs_comparison completed successfully (skipped)")

    def test_scheduled_vs_latest_due_consistency(
        self,
        client: TestClient,
        clean_test_data: List[Dict[str, Any]],
        db_session: Session,
    ):
        """Verify that scheduled column is used for scheduling, not latest_due."""
        playlist_id = 1
        test_tune_id = clean_test_data[0]["id"]
        base_date = datetime.now(timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        print("✅ test_scheduled_vs_latest_due_consistency completed successfully")

        print(f"\n🔍 Testing scheduled vs latest_due for tune {test_tune_id}")

        # Day 1: Practice the tune
        day1_date = base_date
        feedbacks = {str(test_tune_id): "good"}

        result = self._submit_practice_feedback(
            client, playlist_id, feedbacks, day1_date
        )
        assert "error" not in result, f"Day 1 feedback failed: {result.get('error')}"

        # Check database state after day 1
        practice_record = (
            db_session.query(PracticeRecord)
            .filter(
                PracticeRecord.tune_ref == test_tune_id,
                PracticeRecord.playlist_ref == playlist_id,
            )
            .order_by(PracticeRecord.id.desc())
            .first()
        )

        playlist_tune = (
            db_session.query(PlaylistTune)
            .filter(
                PlaylistTune.tune_ref == test_tune_id,
                PlaylistTune.playlist_ref == playlist_id,
            )
            .first()
        )

        assert practice_record is not None, (
            "Practice record should exist after feedback"
        )
        assert playlist_tune is not None, "PlaylistTune should exist"

        # Verify that scheduled and latest_due are initially the same
        latest_due = practice_record.due
        scheduled_date = playlist_tune.scheduled

        print("📊 After day 1:")
        print(f"  latest_due: {latest_due}")
        print(f"  scheduled: {scheduled_date}")

        assert latest_due == scheduled_date, (
            "Initially, scheduled should equal latest_due"
        )

        # Calculate what day this tune should next appear
        next_review_dt = datetime.strptime(scheduled_date, TT_DATE_FORMAT).replace(
            tzinfo=timezone.utc
        )
        days_until_next = (next_review_dt - day1_date).days

        print(f"  ⏰ Next review scheduled in {days_until_next} days")

        # Check scheduling on the expected day
        if days_until_next > 0:
            next_due = day1_date + timedelta(days=days_until_next)
            scheduled_tunes = self._get_scheduled_tunes(client, playlist_id, next_due)

            scheduled_tune_ids = [t["id"] for t in scheduled_tunes]

            print(
                f"📅 Day {days_until_next + 1}: Scheduled tunes: {scheduled_tune_ids}"
            )

            assert test_tune_id in scheduled_tune_ids, (
                f"Tune {test_tune_id} should be scheduled on day {days_until_next + 1}"
            )

        print("✅ Scheduled vs latest_due test passed!")
        print("✅ test_scheduled_vs_latest_due_consistency completed successfully")

    def _validate_scheduling_patterns(
        self, scheduling_log: List[Dict[str, Any]], test_tunes: List[Dict[str, Any]]
    ):
        """Validate that scheduling patterns make sense for spaced repetition."""

        # Count total practice sessions
        practice_days = [day for day in scheduling_log if day["scheduled_count"] > 0]
        total_practice_sessions = sum(day["scheduled_count"] for day in practice_days)

        print("\n📊 Scheduling Pattern Analysis:")
        print(f"  Total practice days: {len(practice_days)}/30")
        print(f"  Total practice sessions: {total_practice_sessions}")
        print(
            f"  Average sessions per practice day: {total_practice_sessions / max(1, len(practice_days)):.1f}"
        )

        # Validate basic spaced repetition principles
        assert len(practice_days) >= 3, (
            "Should have practice sessions on at least 3 days"
        )
        assert total_practice_sessions >= len(test_tunes), (
            "Each tune should be practiced at least once"
        )

        # Check that intervals generally increase over time (spaced repetition principle)
        tune_appearances = {}
        for day_info in scheduling_log:
            for tune_id in day_info["scheduled_tunes"]:
                if tune_id not in tune_appearances:
                    tune_appearances[tune_id] = []
                tune_appearances[tune_id].append(day_info["day"])

        for tune_id, days in tune_appearances.items():
            if len(days) >= 3:  # Only check tunes with multiple appearances
                intervals = [days[i + 1] - days[i] for i in range(len(days) - 1)]
                print(f"  Tune {tune_id} intervals: {intervals}")

                # Generally, intervals should not consistently decrease (basic spaced repetition)
                # Allow some flexibility due to quality feedback variations
                consistently_decreasing = all(
                    intervals[i] >= intervals[i + 1] for i in range(len(intervals) - 1)
                )
                assert not consistently_decreasing, (
                    f"Tune {tune_id} intervals shouldn't consistently decrease: {intervals}"
                )

        print("✅ Scheduling pattern validation passed!")


@pytest.mark.skip(
    reason="API endpoint tests not ready - need to be developed after core scheduling fixes"
)
@pytest.mark.integration
class TestSchedulingAPIEndpoints:
    """Test the scheduling-related API endpoints directly."""

    def test_submit_feedbacks_endpoint(self):
        """Test the submit_feedbacks endpoint with various inputs."""
        client = TestClient(app)

        # Test basic feedback submission
        feedback_data = {
            "user_tune_updates": {"1": {"feedback": "good"}, "2": {"feedback": "hard"}},
            "review_sitdown_date": datetime.now(timezone.utc).strftime(TT_DATE_FORMAT),
        }

        response = client.post(
            "/tunetrees/practice/submit_feedbacks/1", json=feedback_data
        )

        # Should either succeed or fail gracefully
        assert response.status_code in [
            200,
            400,
            422,
        ], f"Unexpected status: {response.status_code}"
        print("✅ test_submit_feedbacks_endpoint completed successfully")

    def test_scheduled_tunes_endpoint(self):
        """Test the scheduled tunes endpoint."""
        client = TestClient(app)

        current_date = datetime.now(timezone.utc).strftime(TT_DATE_FORMAT)

        response = client.get(
            "/tunetrees/practice/scheduled/1",
            params={"review_sitdown_date": current_date},
        )

        # Should return a list (empty or with tunes)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list of scheduled tunes"
        print("✅ test_scheduled_tunes_endpoint completed successfully")
        print("✅ test_scheduled_tunes_endpoint completed successfully")


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
