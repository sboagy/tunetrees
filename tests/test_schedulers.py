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
    review_result_dict = scheduler.first_review(4, now, quality_text="NEW")
    assert isinstance(review_result_dict, dict)
    # assert "easiness" in result
    # Test regular review
    review_result_dict2 = scheduler.review(
        quality=4, easiness=2.5, interval=1, repetitions=1, practiced=now
    )
    assert isinstance(review_result_dict2, dict)
    assert "easiness" in review_result_dict2
