#!/usr/bin/env python3
"""
Test script for fix to issue #223 - UNIQUE constraint violation for practice records.

This script tests that the _get_unique_practiced_timestamp function properly
handles timestamp conflicts when multiple practice records are created with
the same base timestamp.
"""

import sys
import os
from datetime import datetime, timezone

# Add the project root to the path so we can import tunetrees modules
sys.path.insert(0, os.path.dirname(__file__))

from tunetrees.app.database import SessionLocal
from tunetrees.app.schedule import _get_unique_practiced_timestamp
from tunetrees.models.tunetrees import PracticeRecord


def test_timestamp_conflict_resolution():
    """Test that the timestamp function handles conflicts correctly."""
    print("Testing timestamp conflict resolution...")

    with SessionLocal() as db:
        # Use a fixed timestamp for testing
        base_timestamp = datetime(2025, 7, 24, 17, 26, 17, tzinfo=timezone.utc)

        # Test with some sample tune/playlist combinations
        tune_ref = "123"
        playlist_ref = 1

        # Get the first timestamp - should be the base timestamp
        timestamp1 = _get_unique_practiced_timestamp(
            db, base_timestamp, tune_ref, playlist_ref
        )
        print(f"First timestamp: {timestamp1}")

        # Create a practice record with this timestamp to simulate a conflict
        record1 = PracticeRecord(
            tune_ref=tune_ref,
            playlist_ref=playlist_ref,
            practiced=timestamp1,
            quality=3,
            easiness=2.5,
            interval=1,
            repetitions=1,
            review_date="2025-07-25 17:26:00",
        )
        db.add(record1)
        db.commit()

        # Now try to get another timestamp with the same base - should be incremented
        timestamp2 = _get_unique_practiced_timestamp(
            db, base_timestamp, tune_ref, playlist_ref
        )
        print(f"Second timestamp (should be incremented): {timestamp2}")

        # Verify the timestamps are different
        assert timestamp1 != timestamp2, (
            f"Timestamps should be different: {timestamp1} vs {timestamp2}"
        )

        # The second timestamp should be 1 second later
        expected_timestamp2 = "2025-07-24 17:26:18"
        assert timestamp2 == expected_timestamp2, (
            f"Expected {expected_timestamp2}, got {timestamp2}"
        )

        # Test with different tune - should get the base timestamp again
        different_tune_ref = "456"
        timestamp3 = _get_unique_practiced_timestamp(
            db, base_timestamp, different_tune_ref, playlist_ref
        )
        print(f"Different tune timestamp: {timestamp3}")

        # Should be back to the original timestamp since it's a different tune
        assert timestamp3 == timestamp1, (
            f"Different tune should get original timestamp: {timestamp3} vs {timestamp1}"
        )

        # Clean up
        db.rollback()

        print("✅ All timestamp conflict tests passed!")


if __name__ == "__main__":
    test_timestamp_conflict_resolution()
    print("Test completed successfully!")
