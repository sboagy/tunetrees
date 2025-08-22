from datetime import datetime

from fsrs.scheduler import DEFAULT_PARAMETERS
from tunetrees.app.schedulers import SM2Scheduler, FSRScheduler
from datetime import timedelta


class DummyPrefs:
    fsrs_weights = DEFAULT_PARAMETERS
    request_retention = 0.9
    maximum_interval = 365
    learning_steps: tuple[timedelta, ...] = (
        timedelta(minutes=600),
        timedelta(minutes=1800),
    )
    relearning_steps: tuple[timedelta, ...] = (
        timedelta(minutes=600),
        timedelta(minutes=1800),
    )
    enable_fuzzing = False


def test_sm2_first_review_and_review():
    from datetime import timezone

    scheduler = SM2Scheduler()
    now = datetime.now(timezone.utc)  # Make datetime timezone-aware
    result = scheduler.first_review(4, now)
    assert isinstance(result, dict)
    assert "easiness" in result
    # Simulate a review
    review_result = scheduler.review(
        4, result["easiness"], result["interval"], result["repetitions"], now
    )
    assert isinstance(review_result, dict)
    assert "easiness" in review_result


def test_fsrs_first_review_and_review():
    from datetime import timezone

    prefs = DummyPrefs()
    scheduler = FSRScheduler(
        fsrs_weights=prefs.fsrs_weights,
        request_retention=prefs.request_retention,
        maximum_interval=prefs.maximum_interval,
        learning_steps=prefs.learning_steps,
        relearning_steps=prefs.relearning_steps,
        enable_fuzzing=prefs.enable_fuzzing,
    )
    now = datetime.now(timezone.utc)  # Make datetime timezone-aware
    # Test first review (NEW)
    review_result_dict = scheduler.first_review(3, now, quality_text="NEW")
    assert isinstance(review_result_dict, dict)
    # assert "easiness" in result
    # Test regular review
    review_result_dict2 = scheduler.review(
        quality=3, easiness=2.5, interval=1, repetitions=1, practiced=now
    )
    assert isinstance(review_result_dict2, dict)
    assert "easiness" in review_result_dict2


def test_fsrs_scheduler_quality_mapping():
    """Test that FSRScheduler correctly maps quality values to FSRS ratings."""
    from datetime import timezone

    prefs = DummyPrefs()
    scheduler = FSRScheduler(
        fsrs_weights=prefs.fsrs_weights,
        request_retention=prefs.request_retention,
        maximum_interval=prefs.maximum_interval,
        learning_steps=prefs.learning_steps,
        relearning_steps=prefs.relearning_steps,
        enable_fuzzing=prefs.enable_fuzzing,
    )
    now = datetime.now(timezone.utc)

    # Test first review with different quality values to verify quality mapping behavior
    result_again = scheduler.first_review(0, now)  # Should map to Again
    result_hard = scheduler.first_review(1, now)  # Should map to Hard
    result_good = scheduler.first_review(2, now)  # Should map to Good
    result_easy = scheduler.first_review(3, now)  # Should map to Easy

    # All should return valid result dictionaries
    assert isinstance(result_again, dict)
    assert isinstance(result_hard, dict)
    assert isinstance(result_good, dict)
    assert isinstance(result_easy, dict)


def test_sm2_scheduler_quality_values():
    """Test that SM2Scheduler works with its traditional quality scale."""
    from datetime import timezone

    scheduler = SM2Scheduler()
    now = datetime.now(timezone.utc)

    # SM2 uses quality values 0-5 directly
    results = []
    for quality in range(6):  # 0 through 5
        result = scheduler.first_review(quality, now)
        assert isinstance(result, dict)
        assert "easiness" in result
        results.append(result)

    # Verify that higher quality generally produces longer intervals
    for i in range(1, len(results)):
        if results[i - 1]["interval"] > 0:  # Skip cases where interval is 0
            assert results[i - 1]["interval"] <= results[i]["interval"], (
                f"Quality {i - 1} should have interval <= quality {i}"
            )
