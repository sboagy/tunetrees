from datetime import datetime
import pytest
from fsrs.scheduler import DEFAULT_PARAMETERS
from tunetrees.app.schedulers import SM2Scheduler, FSRScheduler
from datetime import timedelta


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
    now = datetime.now()
    # Should not raise
    result = scheduler.review(4, 2.5, 1, 1, now)
    assert isinstance(result, dict)
    assert "easiness" in result


def test_sm2_missing_optional_args():
    scheduler = SM2Scheduler()
    now = datetime.now()
    # Should not raise
    result = scheduler.review(4, 2.5, 1, 1, now)
    assert isinstance(result, dict)
    assert "easiness" in result
