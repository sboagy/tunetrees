import logging
from datetime import datetime, timedelta

import pytest
from fsrs import Rating, State
from fsrs.scheduler import DEFAULT_PARAMETERS

from tunetrees.app.schedulers import FSRScheduler, SM2Scheduler


class DummyPrefs:
    fsrs_weights = DEFAULT_PARAMETERS
    request_retention = 0.9
    maximum_interval = 365
    learning_steps: tuple[timedelta, ...] = (
        timedelta(seconds=600),
        timedelta(seconds=1800),
    )
    relearning_steps: tuple[timedelta, ...] = (
        timedelta(seconds=600),
        timedelta(seconds=1800),
    )
    enable_fuzzing = False


def test_sm2_invalid_quality():
    scheduler = SM2Scheduler()
    now = datetime.now()
    # SM2 does not raise for invalid quality, just returns a result
    result = scheduler.first_review(-1, now)
    assert isinstance(result, dict)


def test_fsrs_invalid_quality():
    prefs = DummyPrefs()
    scheduler = FSRScheduler(
        fsrs_weights=prefs.fsrs_weights,
        request_retention=prefs.request_retention,
        maximum_interval=prefs.maximum_interval,
        learning_steps=prefs.learning_steps,
        relearning_steps=prefs.relearning_steps,
        enable_fuzzing=prefs.enable_fuzzing,
    )
    now = datetime.now()
    with pytest.raises(ValueError):
        scheduler.first_review(99, now, quality_text="NEW")


def test_fsrs_missing_optional_args():
    prefs = DummyPrefs()
    scheduler = FSRScheduler(
        fsrs_weights=prefs.fsrs_weights,
        request_retention=prefs.request_retention,
        maximum_interval=prefs.maximum_interval,
        learning_steps=prefs.learning_steps,
        relearning_steps=prefs.relearning_steps,
        enable_fuzzing=prefs.enable_fuzzing,
    )

    # {
    #   "id": 1755823658857,
    #   "quality": "Good",
    #   "easiness": 1.5717428232260808,
    #   "state": "Review",
    #   "step": null,
    #   "stability": 13.630435348122646,
    #   "difficulty": 7.961928825804394,
    #   "due": "2025-09-06 00:47:38.859129+00:00",
    #   "review_duration": null,
    #   "repetitions": 10
    # }
    sitdown_date: datetime = datetime.fromisoformat("2025-09-06 00:47:38.859129+00:00")
    sr_scheduled_date: datetime = datetime.fromisoformat(
        "2025-09-06 00:47:38.859129+00:00"
    )
    last_practiced: datetime = datetime.fromisoformat(
        "2025-09-06 00:47:38.859129+00:00"
    )

    result = scheduler.review(
        quality=2,
        easiness=1.5717428232260808,
        interval=1,
        repetitions=10,
        sitdown_date=sitdown_date,
        sr_scheduled_date=sr_scheduled_date,
        stability=13.630435348122646,
        difficulty=7.961928825804394,
        step=None,
        last_practiced=last_practiced,
    )
    assert isinstance(result, dict)
    assert "easiness" in result
    assert "state" in result
    assert result.get("quality") == Rating.Good
    assert result.get("stability") == 13.630435348122646
    difficulty = result.get("difficulty", 0)
    assert difficulty > 7 and difficulty < 8
    assert result.get("step") is None
    # Compare as ISO strings to avoid tzinfo or type mismatches
    review_dt_str = result.get("due", "")
    assert review_dt_str, "due missing"
    # Parse the review datetime, will throw an error if invalid
    review_dt = datetime.fromisoformat(review_dt_str)
    logging.info(f"Review datetime is {review_dt}")
    # assert review_dt.date().isoformat() == "2025-09-06"
    assert result.get("repetitions") == 11
    assert result.get("state") == State.Review


def test_sm2_missing_optional_args():
    scheduler = SM2Scheduler()
    now = datetime.now()
    # Should not raise
    result = scheduler.review(4, 2.5, 1, 1, now, now)
    assert isinstance(result, dict)
    assert "easiness" in result
