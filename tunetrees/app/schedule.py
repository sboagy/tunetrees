import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple, Optional
from typing_extensions import TypedDict, NotRequired

from fsrs import Rating, Scheduler, ReviewLog
from fsrs.optimizer import Optimizer
from sqlalchemy import Row, and_, select, update
from sqlalchemy.orm.session import Session
from tabulate import tabulate
from dateutil.parser import parse

from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import (
    get_practice_record_table,
    query_result_to_diagnostic_dict,
)
from tunetrees.app.schedulers import SpacedRepetitionScheduler
from tunetrees.models.quality import NEW, NOT_SET, RESCHEDULED, quality_lookup
from tunetrees.models.tunetrees import Playlist, PracticeRecord, PrefsSpacedRepetition
from tunetrees.models.tunetrees_pydantic import AlgorithmType
import json

log = logging.getLogger(__name__)

TT_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def backup_practiced_dates():  # sourcery skip: extract-method
    with SessionLocal() as db:
        practice_records: List[PracticeRecord] = get_practice_record_table(
            db, limit=10000
        )

        for practice_record in practice_records:
            practice_record.backup_practiced = practice_record.practiced

            assert practice_record.tune
            assert practice_record.playlist

            print(
                f"{practice_record.tune.Title=}, {practice_record.playlist.instrument=}, "
                f"{practice_record.playlist_ref=}, {practice_record.tune_ref=}, "
                f"{practice_record.practiced=}, {practice_record.Feedback=}"
            )

        db.commit()
        db.flush(objects=practice_records)


# It appears this is dead code, but not sure what it was used for....
# def initialize_review_records_from_practiced(
#     print_table=True, from_backup_practiced=True
# ):  # sourcery skip: extract-method
#     with SessionLocal() as db:
#         rows: List[PracticeRecord] = get_practice_record_table(db, limit=10000)

#         for row in rows:
#             practiced_str = (
#                 row.backup_practiced if from_backup_practiced else row.practiced
#             )
#             if practiced_str is None:
#                 continue
#             row.practiced = practiced_str

#             quality = 1
#             practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)
#             row.easiness = review.get("easiness")
#             row.interval = review.get("interval")
#             row.repetitions = review.get("repetitions")
#             # XTODO: check these next two lines!
#             review_date_orig = review.get("review_datetime", datetime.now(timezone.utc))
#             review_date_str = datetime.strftime(review_date_orig, TT_DATE_FORMAT)
#             row.review_date = review_date_str
#             row.quality = quality

#         db.commit()
#         db.flush(objects=rows)

#         if print_table:
#             rows_list = query_result_to_diagnostic_dict(
#                 rows, table_name="practice_record"
#             )
#             print("\n----------")
#             print(tabulate(rows_list, headers="keys"))


class BadTuneID(Exception):
    """Tune not found."""


class TuneFeedbackUpdate(TypedDict):
    feedback: str
    goal: NotRequired[str | None]  # Practice goal (e.g., 'recall', 'fluency', etc.)
    technique: NotRequired[str | None]  # Practice technique (e.g., 'fsrs', 'sm2', etc.)


def fetch_algorithm_type(db: Session, user_ref: str) -> AlgorithmType:
    stmt = select(PrefsSpacedRepetition.alg_type).where(
        PrefsSpacedRepetition.user_id == user_ref
    )
    alg_type_result = db.execute(stmt).one_or_none()
    if alg_type_result:
        alg_type_str: str = alg_type_result[0]
        alg_type = AlgorithmType(alg_type_str)
        return alg_type
    else:
        log.debug(f"No alg_type found for user_ref: {user_ref}")
        return AlgorithmType.FSRS


def get_default_technique_for_user(db: Session, user_ref: str) -> str:
    """Get the default technique for a user from user.sr_alg_type.

    Args:
        db: Database session
        user_ref: User reference ID

    Returns:
        str: Default technique based on user's sr_alg_type preference,
             defaults to 'fsrs' if not specified
    """
    from tunetrees.models.tunetrees import User

    stmt = select(User.sr_alg_type).where(User.id == user_ref)
    result = db.execute(stmt).one_or_none()

    if result and result[0]:
        sr_alg_type = result[0].lower()  # Convert 'FSRS' -> 'fsrs', 'SM2' -> 'sm2'
        return sr_alg_type
    else:
        # Default to 'fsrs' if user preference not found or empty
        return "fsrs"


def fetch_user_ref_from_playlist_ref(db: Session, playlist_ref: int) -> str:
    stmt = select(Playlist.user_ref).where(Playlist.playlist_id == playlist_ref)
    user_ref_result = db.execute(stmt).one_or_none()
    if user_ref_result:
        user_ref = user_ref_result[0]
    else:
        raise ValueError(f"No playlist found for playlist_ref: {playlist_ref}")

    return user_ref


def e_factor_to_difficulty(e_factor: float) -> float:
    normalized_e = (e_factor - 1.3) / (2.5 - 1.3)
    inverted_e = 1 - normalized_e
    d = 1 + inverted_e * 9
    return float(round(d))


def difficulty_to_e_factor(d: float) -> float:
    normalized_d = (d - 1) / 9
    inverted_d = 1 - normalized_d
    e_factor = 1.3 + inverted_d * (2.5 - 1.3)
    return e_factor


def quality_to_fsrs_rating(quality_int: int) -> Rating:
    """Convert quality value to FSRS Rating.

    For 6-value SM2 system (0-5):
    - 0,1 -> Again
    - 2 -> Hard
    - 3 -> Good
    - 4,5 -> Easy

    For 4-value FSRS system (0-3):
    - 0 -> Again
    - 1 -> Hard
    - 2 -> Good
    - 3 -> Easy
    """
    if quality_int in (0, 1):
        return Rating.Again
    elif quality_int == 2:
        return Rating.Hard
    elif quality_int == 3:
        return Rating.Good
    elif quality_int in (4, 5):
        return Rating.Easy
    else:
        raise ValueError(f"Unexpected quality value: {quality_int}")


def quality_to_fsrs_rating_direct(quality_int: int) -> Rating:
    """Convert 4-value quality directly to FSRS Rating (0-3 -> Rating).

    This is used when the frontend sends 4-value quality lists.
    - 0 -> Again
    - 1 -> Hard
    - 2 -> Good
    - 3 -> Easy
    """
    if quality_int == 0:
        return Rating.Again
    elif quality_int == 1:
        return Rating.Hard
    elif quality_int == 2:
        return Rating.Good
    elif quality_int == 3:
        return Rating.Easy
    else:
        raise ValueError(f"Unexpected quality value for 4-value system: {quality_int}")


def fsrs_rating_to_quality(rating: Rating):
    """Convert FSRS Rating back to 6-value quality for legacy compatibility."""
    if rating == Rating.Again:
        return 0
    elif rating == Rating.Hard:
        return 2
    elif rating == Rating.Good:
        return 3
    elif rating == Rating.Easy:
        return 5


def fsrs_rating_to_quality_direct(rating: Rating) -> int:
    """Convert FSRS Rating directly to 4-value quality (Rating -> 0-3).

    This is used when working with 4-value quality lists.
    - Again -> 0
    - Hard -> 1
    - Good -> 2
    - Easy -> 3
    """
    if rating == Rating.Again:
        return 0
    elif rating == Rating.Hard:
        return 1
    elif rating == Rating.Good:
        return 2
    elif rating == Rating.Easy:
        return 3


class ReviewResult(TypedDict):
    id: int
    quality: int | None
    easiness: float | None
    difficulty: float | None
    interval: int
    step: int | None
    repetitions: int
    review_datetime: datetime
    review_duration: int | None


def update_practice_feedbacks(
    user_tune_updates: dict[str, TuneFeedbackUpdate],
    playlist_ref: str | int,
    review_sitdown_date: datetime,
) -> None:
    playlist_ref_int: int = int(playlist_ref)
    if review_sitdown_date.tzinfo is None or review_sitdown_date.tzinfo.utcoffset(
        review_sitdown_date
    ) != timedelta(0):
        raise ValueError("review_sitdown_date must be timezone aware and in UTC")

    with SessionLocal() as db:
        try:
            user_ref: str = fetch_user_ref_from_playlist_ref(db, playlist_ref_int)
            alg_type: AlgorithmType = fetch_algorithm_type(db, user_ref)

            for tune_id, tune_update in user_tune_updates.items():
                _process_single_tune_feedback(
                    db=db,
                    tune_id=tune_id,
                    tune_update=tune_update,
                    user_ref=user_ref,
                    playlist_ref=playlist_ref_int,
                    sitdown_date=review_sitdown_date,
                    alg_type=alg_type,
                )
            db.commit()
        except Exception as e:
            db.rollback()
            log.error(f"An error occurred during the update: {e}")
            raise


def get_latest_practice_record(
    db: Session,
    tune_id: str,
    playlist_ref: int,
) -> PracticeRecord:
    stmt = (
        select(PracticeRecord)
        .where(
            and_(
                PracticeRecord.tune_ref == tune_id,
                PracticeRecord.playlist_ref == playlist_ref,
            )
        )
        .order_by(PracticeRecord.id.desc())
    )
    row_result_tuple: Row[Tuple[PracticeRecord]] | None = db.execute(stmt).one_or_none()
    if row_result_tuple is not None:
        practice_record: PracticeRecord = row_result_tuple[0]
        return practice_record
    else:
        # Return a new practice record with default values for a first-time tune
        practice_record = PracticeRecord(
            id=None,
            tune_ref=tune_id,
            playlist_ref=playlist_ref,
            easiness=0.0,
            difficulty=None,
            interval=0,
            step=None,
            repetitions=0,
            review_date="",
            quality=0,
            practiced="",
        )
        return practice_record


def parse_review_date(review_date: datetime | str) -> str:
    if isinstance(review_date, datetime):
        if review_date.tzinfo is None or review_date.tzinfo.utcoffset(
            review_date
        ) != timedelta(0):
            raise ValueError("review_date must be timezone aware and in UTC")

        return datetime.strftime(review_date, TT_DATE_FORMAT)
    elif isinstance(review_date, str):  # type: ignore
        try:
            review_date_dt = parse(review_date)
        except ValueError:
            log.error(f"Unable to parse date: {review_date}")
            raise
        review_date_dt = review_date_dt.replace(second=0, microsecond=0)
        if review_date_dt.tzinfo is None:
            review_date_dt = review_date_dt.replace(tzinfo=timezone.utc)
        elif review_date_dt.tzinfo.utcoffset(review_date_dt) != timedelta(0):
            raise ValueError("review_date must be in UTC")
        return review_date_dt.strftime(TT_DATE_FORMAT)
    else:
        raise ValueError(
            f"Unexpected review_date type: {type(review_date)}: {review_date}"
        )


def validate_and_get_quality(
    tune_update: TuneFeedbackUpdate, tune_id: str
) -> int | None:
    if tune_update is None:  # type: ignore
        raise ValueError(f"No update found for tune_id: {tune_id}")
    quality_str = tune_update.get("feedback")
    if not quality_str:
        raise ValueError(f"Quality is is not specified for tune_id: {tune_id}")
    quality_int = quality_lookup.get(quality_str, -2)
    if quality_int == -2:
        raise ValueError(f"Unexpected quality value: {quality_int}")
    if quality_str == NOT_SET:
        return None  # type: ignore
    return quality_int


def get_quality_value_bounds(technique: str | None) -> tuple[int, int]:
    """Get the min/max quality values for a given technique.

    Returns:
        tuple: (min_value, max_value) for the quality scale
        - SM2: (0, 5) - 6-value system
        - FSRS and goal-specific: (0, 3) - 4-value system
    """
    if technique == "sm2":
        return (0, 5)  # 6-value system for SM2
    else:
        return (0, 3)  # 4-value system for FSRS and goal-specific techniques


def is_4_value_quality_system(technique: str | None) -> bool:
    """Check if the technique uses 4-value quality system (0-3).

    Returns:
        bool: True for FSRS and goal-specific techniques, False for SM2
    """
    return technique != "sm2"


def get_appropriate_quality_mapping_function(technique: str | None):
    """Get the appropriate quality-to-FSRS-rating function based on technique.

    Args:
        technique: The practice technique (e.g., 'fsrs', 'sm2', 'motor_skills', etc.)

    Returns:
        callable: The appropriate mapping function
    """
    if is_4_value_quality_system(technique):
        return quality_to_fsrs_rating_direct  # Use direct 4-value mapping
    else:
        return quality_to_fsrs_rating  # Use traditional 6-value mapping


def save_prefs_spaced_repetition(db: Session, prefs: PrefsSpacedRepetition) -> None:
    """
    Save or update the given PrefsSpacedRepetition object in the database.

    Args:
        db (Session): SQLAlchemy session.
        prefs (PrefsSpacedRepetition): The preferences object to save.
    """
    stmt = select(PrefsSpacedRepetition).where(
        and_(
            PrefsSpacedRepetition.user_id == prefs.user_id,
            PrefsSpacedRepetition.alg_type == prefs.alg_type,
        )
    )
    existing_row: Row[Tuple[PrefsSpacedRepetition]] | None = db.execute(
        stmt
    ).one_or_none()
    if existing_row is not None:
        db.execute(
            update(PrefsSpacedRepetition)
            .where(
                and_(
                    PrefsSpacedRepetition.user_id == prefs.user_id,
                    PrefsSpacedRepetition.alg_type == prefs.alg_type,
                )
            )
            .values(
                fsrs_weights=prefs.fsrs_weights,
                request_retention=prefs.request_retention,
                maximum_interval=prefs.maximum_interval,
                learning_steps=prefs.learning_steps,
                relearning_steps=prefs.relearning_steps,
                enable_fuzzing=prefs.enable_fuzzing,
            ),
            execution_options={"synchronize_session": False},
        )
    else:
        db.add(prefs)
    db.flush()


def get_prefs_spaced_repetition(
    db: Session, user_ref: str, alg_type: AlgorithmType
) -> PrefsSpacedRepetition:
    # Convert learning_steps (tuple[timedelta, ...]) to a JSON string for storage
    def timedelta_tuple_to_json(td_tuple: tuple[timedelta, ...]) -> str:
        # Convert each timedelta to total seconds for JSON serialization
        return json.dumps([td.total_seconds() for td in td_tuple])

    stmt = select(PrefsSpacedRepetition).where(
        and_(
            PrefsSpacedRepetition.user_id == user_ref,
            PrefsSpacedRepetition.alg_type == alg_type,  # or "SM2"
        )
    )
    prefs_spaced_repetition_row: Row[Tuple[PrefsSpacedRepetition]] | None = db.execute(
        stmt
    ).one_or_none()
    if prefs_spaced_repetition_row is not None:
        prefs_spaced_repitition: PrefsSpacedRepetition = prefs_spaced_repetition_row[0]
    else:
        # Use default values from FSRS scheduler for now, for both SM2 and FSRS
        scheduler = Scheduler()

        prefs_spaced_repitition = PrefsSpacedRepetition(
            user_id=user_ref,
            alg_type=alg_type,
            fsrs_weights=json.dumps(scheduler.parameters),  # Serialize tuple to JSON
            request_retention=scheduler.desired_retention,
            maximum_interval=scheduler.maximum_interval,
            learning_steps=timedelta_tuple_to_json(scheduler.learning_steps),
            relearning_steps=timedelta_tuple_to_json(scheduler.relearning_steps),
            enable_fuzzing=scheduler.enable_fuzzing,
        )
        try:
            db.add(prefs_spaced_repitition)
            db.flush()
        except Exception as e:
            log.error(f"Error adding default PrefsSpacedRepetition: {e}")
            raise e
    return prefs_spaced_repitition


def _process_non_recall_goal(
    db: Session,
    tune_id: str,
    tune_update: TuneFeedbackUpdate,
    user_ref: str,
    playlist_ref: int,
    sitdown_date: datetime,
    goal: str,
    technique: Optional[str],
    alg_type: AlgorithmType,
) -> None:
    """Process practice feedback for non-recall goals (Issue #205).

    This implements goal-specific scheduling strategies:
    - initial_learn: More frequent practice with shorter intervals
    - fluency: Focus on consistent quality with moderate intervals
    - session_ready: Intensive short-term practice
    - performance_polish: Refined practice with quality focus
    """
    quality_int = validate_and_get_quality(tune_update, tune_id)
    if quality_int is None:
        return

    # Get or create latest practice record
    latest_practice_record = get_latest_practice_record(db, tune_id, playlist_ref)

    # Calculate next review date based on goal-specific strategies
    next_review_date = _calculate_goal_specific_review_date(
        goal, technique, quality_int, sitdown_date, latest_practice_record
    )

    # Create new practice record with goal-specific scheduling
    new_practice_record = PracticeRecord(
        id=None,
        tune_ref=tune_id,
        playlist_ref=playlist_ref,
        quality=quality_int,
        practiced=sitdown_date.strftime(TT_DATE_FORMAT),
        review_date=next_review_date.strftime(TT_DATE_FORMAT),
        backup_practiced=sitdown_date.strftime(TT_DATE_FORMAT),
        # Set basic interval/repetition tracking
        interval=max(1, (next_review_date - sitdown_date).days),
        repetitions=(
            (latest_practice_record.repetitions + 1) if latest_practice_record else 1
        ),
        # Keep FSRS fields for future integration
        easiness=latest_practice_record.easiness if latest_practice_record else 2.5,
        stability=latest_practice_record.stability if latest_practice_record else 1.0,
        difficulty=latest_practice_record.difficulty if latest_practice_record else 0.5,
        state=1,  # Learning state for non-recall goals
        step=0,
        elapsed_days=0,
        lapses=latest_practice_record.lapses if latest_practice_record else 0,
    )

    # Add the new practice record to the database
    db.add(new_practice_record)
    log.debug(
        f"Created goal-specific practice record for tune {tune_id}, goal: {goal}, technique: {technique}"
    )


def _calculate_goal_specific_review_date(
    goal: str,
    technique: Optional[str],
    quality: int,
    sitdown_date: datetime,
    latest_record: Optional[PracticeRecord],
) -> datetime:
    """Calculate next review date based on practice goal and technique."""

    # Base intervals for different goals (in days)
    goal_base_intervals = {
        "initial_learn": [0.1, 0.5, 1, 2, 4],  # Very frequent practice
        "fluency": [1, 3, 7, 14, 21],  # Building consistency
        "session_ready": [0.5, 1, 2, 3, 5],  # Intensive short-term
        "performance_polish": [2, 5, 10, 15, 21],  # Quality refinement
    }

    base_intervals = goal_base_intervals.get(
        goal, [1, 3, 7, 14, 30]
    )  # Default fallback

    # Determine step based on quality and previous repetitions
    current_step = 0
    if latest_record and latest_record.repetitions:
        current_step = min(latest_record.repetitions, len(base_intervals) - 1)

    # Adjust step based on quality (0-5 scale)
    if quality >= 4:  # Good/Easy
        current_step = min(current_step + 1, len(base_intervals) - 1)
    elif quality <= 2:  # Again/Hard
        current_step = max(0, current_step - 1)
    # Quality 3 (Good) keeps same step

    # Get interval and apply technique-specific modifiers
    interval_days = base_intervals[current_step]

    if technique == "daily_practice":
        interval_days = min(interval_days, 1.0)  # Cap at daily
    elif technique == "motor_skills":
        interval_days *= 0.7  # More frequent for motor skill development
    elif technique == "metronome":
        interval_days *= 0.8  # Slightly more frequent for timing work

    # Convert to timedelta and add to sitdown_date
    interval_delta = timedelta(days=interval_days)
    return sitdown_date + interval_delta


def normalize_quality_for_scheduler(quality_int: int, technique: str | None) -> int:
    """Pass-through quality value - no conversion needed.

    With the new technique-aware system, the quality value is stored
    in its native format (4-value for FSRS, 6-value for SM2) and
    the technique column tells us which system it's in.

    Args:
        quality_int: Original quality value from frontend
        technique: Practice technique that determines quality scale

    Returns:
        int: Quality value unchanged (no conversion)
    """
    # Direct pass-through - technique column tells us which system quality is in
    return quality_int


def _process_single_tune_feedback(
    db: Session,
    tune_id: str,
    tune_update: TuneFeedbackUpdate,
    user_ref: str,
    playlist_ref: int,
    sitdown_date: datetime,
    alg_type: AlgorithmType,
) -> None:
    if sitdown_date.tzinfo is None or sitdown_date.tzinfo.utcoffset(
        sitdown_date
    ) != timedelta(0):
        raise ValueError("review_sitdown_date must be timezone aware and in UTC")

    # Get the latest practice record for reference, but always create a new one
    latest_practice_record = get_latest_practice_record(db, tune_id, playlist_ref)
    quality_int = validate_and_get_quality(tune_update, tune_id)
    if quality_int is None:
        return
    quality_str = tune_update.get("feedback")

    # Extract goal and technique from tune update (Issue #205)
    goal = tune_update.get("goal", "recall")  # Default to recall if not specified
    technique = tune_update.get("technique")  # Used for goal-specific techniques

    # If technique is not provided, default based on user's algorithm preference
    if technique is None:
        technique = get_default_technique_for_user(db, user_ref)

    # Normalize quality for scheduler compatibility
    normalized_quality_int = normalize_quality_for_scheduler(quality_int, technique)

    # Implement goal-specific scheduling strategies
    if goal not in [
        "initial_learn",
        "recall",
        "fluency",
        "session_ready",
        "performance_polish",
    ]:
        log.warning(f"Unknown goal '{goal}', falling back to recall logic")
        goal = "recall"

    # For non-recall goals, we implement different scheduling approaches
    if goal != "recall":
        return _process_non_recall_goal(
            db,
            tune_id,
            tune_update,
            user_ref,
            playlist_ref,
            sitdown_date,
            goal,
            technique,
            alg_type,
        )

    # Fetch spaced repetition preferences for the user and algorithm
    prefs_spaced_repetition: PrefsSpacedRepetition = get_prefs_spaced_repetition(
        db, user_ref, alg_type
    )
    weights = json.loads(prefs_spaced_repetition.fsrs_weights)
    learning_steps = tuple(
        timedelta(minutes=s) for s in json.loads(prefs_spaced_repetition.learning_steps)
    )
    relearning_steps = tuple(
        timedelta(minutes=s)
        for s in json.loads(prefs_spaced_repetition.relearning_steps)
    )

    scheduler = SpacedRepetitionScheduler.factory(
        alg_type=alg_type,
        weights=weights,
        desired_retention=prefs_spaced_repetition.request_retention,
        maximum_interval=prefs_spaced_repetition.maximum_interval,
        learning_steps=learning_steps,
        relearning_steps=relearning_steps,
        enable_fuzzing=prefs_spaced_repetition.enable_fuzzing,
    )

    if quality_str == NEW or quality_str == RESCHEDULED:
        review_result_dict = scheduler.first_review(
            quality=normalized_quality_int,
            practiced=sitdown_date,
            quality_text=quality_str,
        )
    else:
        last_review_str = latest_practice_record.review_date

        if last_review_str:
            try:
                last_review = datetime.strptime(
                    last_review_str, TT_DATE_FORMAT
                ).replace(tzinfo=timezone.utc)
            except ValueError:
                last_review = None
                log.warning(f"Could not parse last_review date: {last_review_str}")
        else:
            last_review = None

        review_result_dict = scheduler.review(
            quality=normalized_quality_int,
            easiness=latest_practice_record.easiness,
            interval=latest_practice_record.interval,
            repetitions=latest_practice_record.repetitions,
            practiced=sitdown_date,
            stability=getattr(latest_practice_record, "stability", None),
            difficulty=getattr(latest_practice_record, "difficulty", None),
            step=getattr(latest_practice_record, "step", None),
            last_review=last_review,
        )

    review_dt = review_result_dict.get("review_datetime")
    if review_dt is None:
        review_date_str = ""
    else:
        review_date_str = parse_review_date(review_dt)

    # Always create a new practice record for historical tracking
    new_practice_record = PracticeRecord(
        id=None,
        tune_ref=tune_id,
        playlist_ref=playlist_ref,
        easiness=review_result_dict.get("easiness"),
        difficulty=review_result_dict.get("difficulty"),
        interval=review_result_dict.get("interval"),
        step=review_result_dict.get("step"),
        repetitions=review_result_dict.get("repetitions"),
        review_date=review_date_str,
        quality=quality_int,
        practiced=sitdown_date.strftime(TT_DATE_FORMAT),
    )

    # Always add the new practice record to the database
    db.add(new_practice_record)


class TuneScheduleUpdate(TypedDict):
    review_date: str


# DEADCODE: Dead code?
def update_practice_schedules(
    user_tune_updates: dict[str, TuneScheduleUpdate], playlist_ref: str
):
    with SessionLocal() as db:
        try:
            stmt = select(PracticeRecord).where(
                and_(
                    PracticeRecord.tune_ref.in_(
                        [int(tune_id) for tune_id in user_tune_updates]
                    ),
                    PracticeRecord.playlist_ref == playlist_ref,
                )
            )
            row_results = db.execute(stmt).scalars().all()

            data_to_update = []
            for row_result in row_results:
                # tune_id, easiness, interval, repetitions = row_result
                tune_id = row_result.tune_ref
                # easiness = row_result.easiness
                # interval = row_result.interval
                # repetitions = row_result.repetitions
                assert isinstance(tune_id, str)
                tune_update = user_tune_updates.get(tune_id)
                assert tune_update is not None
                review_date = tune_update.get("review_date")
                assert review_date is not None
                assert isinstance(user_tune_updates, Dict)

                if isinstance(review_date, datetime):
                    review_date_str = datetime.strftime(review_date, TT_DATE_FORMAT)
                elif isinstance(review_date, str):  # type: ignore
                    review_date_str = review_date
                else:
                    raise ValueError(
                        f"Unexpected review_date type: {type(review_date)}: {review_date}"
                    )

                data_to_update.append(
                    {
                        "tune_ref": tune_id,
                        "playlist_ref": playlist_ref,
                        "review_date": review_date_str,
                    }
                )

            for data in data_to_update:
                stmt = (
                    update(PracticeRecord)
                    .where(PracticeRecord.tune_ref == data["tune_ref"])
                    .values(data)
                )
                db.execute(stmt)

            db.commit()

        except Exception as e:
            db.rollback()
            raise e


def query_and_print_tune_by_id(tune_id: int, print_table=True):
    """Diagnostic function to query and print a tune by its ID.

    Args:
        tune_id (int): unique ID of the tune to query.
        print_table (bool, optional): only prints the table if True. Defaults to True.
    """
    with SessionLocal() as db:
        stmt = select(PracticeRecord).where(PracticeRecord.tune_ref == tune_id)
        rows = [db.execute(stmt).one()[0]]

        if print_table:
            rows_list = query_result_to_diagnostic_dict(
                rows, table_name="practice_record"
            )
            print("\n----------")
            print(tabulate(rows_list, headers="keys"))


def get_user_review_history(
    db: Session, user_ref: str, limit: int = 1000
) -> List[ReviewLog]:
    """Fetch user's review history and convert to FSRS ReviewLog format."""
    stmt = (
        select(PracticeRecord)
        .join(Playlist)
        .where(Playlist.user_ref == user_ref)
        .order_by(PracticeRecord.practiced.desc())
        .limit(limit)
    )

    practice_records = db.execute(stmt).scalars().all()
    review_logs = []

    for record in practice_records:
        if not record.practiced or not record.quality:
            continue

        try:
            practiced_dt = datetime.strptime(record.practiced, TT_DATE_FORMAT).replace(
                tzinfo=timezone.utc
            )
            review_dt = (
                datetime.strptime(record.review_date, TT_DATE_FORMAT).replace(
                    tzinfo=timezone.utc
                )
                if record.review_date
                else practiced_dt
            )

            # Convert quality to FSRS rating
            rating = quality_to_fsrs_rating(record.quality)

            """
            Represents the log entry of a Card object that has been reviewed.

            Attributes:
                card_id: The id of the card being reviewed.
                rating: The rating given to the card during the review.
                review_datetime: The date and time of the review.
                review_duration: The number of miliseconds it took to review the card or None if unspecified.
            """

            # Create ReviewLog entry
            review_log = ReviewLog(
                card_id=record.id,
                rating=rating,
                review_datetime=review_dt,
                review_duration=None,
            )
            review_logs.append(review_log)

        except (ValueError, TypeError) as e:
            log.warning(f"Skipping invalid review record: {e}")
            continue

    return review_logs


def optimize_fsrs_parameters(
    db: Session, user_ref: str, alg_type: AlgorithmType
) -> Tuple[Tuple[float, ...], float]:
    """
    Optimize FSRS parameters for a user using the Optimizer.

    Args:
        db (Session): SQLAlchemy session.
        user_ref (str): User reference ID.
        alg_type (AlgorithmType): Algorithm type (e.g., FSRS, SM2).

    Returns:
        Tuple[tuple, float]: Optimized parameters and loss value.
    """
    # Fetch user's review history
    review_logs = get_user_review_history(db, user_ref)

    if len(review_logs) < 10:
        log.warning(
            f"Insufficient review history for user {user_ref}: {len(review_logs)} records"
        )
        # Return default parameters
        scheduler = Scheduler()
        return scheduler.parameters, 0.0

    log.info(
        f"Optimizing FSRS parameters for user {user_ref} with {len(review_logs)} review records"
    )

    try:
        # Initialize optimizer with review logs
        optimizer = Optimizer(review_logs)

        # Run optimization
        optimized_params = optimizer.compute_optimal_parameters()

        log.info(f"FSRS optimization completed. Parameters: {optimized_params}")

        return (
            tuple(optimized_params),
            0.0,
        )  # FSRS optimizer doesn't return loss directly

    except Exception as e:
        log.error(f"Error optimizing FSRS parameters: {e}")
        # Return default parameters on error
        scheduler = Scheduler()
        return scheduler.parameters, 0.0


def create_tuned_scheduler(
    db: Session,
    user_ref: str,
    alg_type: AlgorithmType = AlgorithmType.FSRS,
    force_optimization: bool = False,
) -> Scheduler:
    """
    Create a new scheduler with optimized parameters for a user.

    Args:
        db (Session): SQLAlchemy session.
        user_ref (str): User reference ID.
        alg_type (AlgorithmType): Algorithm type (e.g., FSRS, SM2).
        force_optimization (bool): Force re-optimization even if preferences exist.

    Returns:
        Scheduler: A new scheduler with optimized parameters.
    """
    # Check if we should optimize or use existing preferences
    existing_prefs = None
    if not force_optimization:
        try:
            existing_prefs = get_prefs_spaced_repetition(db, user_ref, alg_type)
        except Exception:
            # No existing preferences, will optimize
            pass

    if existing_prefs and not force_optimization:
        # Use existing optimized parameters
        weights = json.loads(existing_prefs.fsrs_weights)
        scheduler = Scheduler(
            parameters=tuple(weights),
            desired_retention=existing_prefs.request_retention,
            maximum_interval=existing_prefs.maximum_interval,
            enable_fuzzing=existing_prefs.enable_fuzzing,
        )
        log.info(f"Using existing optimized parameters for user {user_ref}")
    else:
        # Optimize parameters
        optimized_weights, loss = optimize_fsrs_parameters(db, user_ref, alg_type)

        # Create scheduler with optimized parameters
        scheduler = Scheduler(
            parameters=optimized_weights,
            desired_retention=0.9,  # Default target retention
            maximum_interval=36500,  # Default max interval (~100 years)
            enable_fuzzing=True,
        )

        # Save the optimized parameters
        prefs = PrefsSpacedRepetition(
            user_id=user_ref,
            alg_type=alg_type,
            fsrs_weights=json.dumps(optimized_weights),
            request_retention=scheduler.desired_retention,
            maximum_interval=scheduler.maximum_interval,
            learning_steps=json.dumps(
                [td.total_seconds() for td in scheduler.learning_steps]
            ),
            relearning_steps=json.dumps(
                [td.total_seconds() for td in scheduler.relearning_steps]
            ),
            enable_fuzzing=scheduler.enable_fuzzing,
        )

        save_prefs_spaced_repetition(db, prefs)
        log.info(
            f"Created and saved optimized scheduler for user {user_ref} with loss: {loss}"
        )

    return scheduler


if __name__ == "__main__":
    query_and_print_tune_by_id(634)
