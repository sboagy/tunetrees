import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from typing_extensions import TypedDict

from fsrs import Rating, Scheduler, ReviewLog
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


def fsrs_rating_to_quality(rating: Rating):
    if rating == Rating.Again:
        return 0
    elif rating == Rating.Hard:
        return 2
    elif rating == Rating.Good:
        return 3
    elif rating == Rating.Easy:
        return 5


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
    review_sitdown_date: Optional[datetime] = None,
) -> None:
    playlist_ref_int: int = int(playlist_ref)
    sitdown_date: datetime = review_sitdown_date or datetime.now(timezone.utc)
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
                    sitdown_date=sitdown_date,
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
        # db.add(practice_record)
        return practice_record


def parse_review_date(review_date: datetime | str) -> str:
    if isinstance(review_date, datetime):
        return datetime.strftime(review_date, TT_DATE_FORMAT)
    elif isinstance(review_date, str):  # type: ignore
        try:
            review_date_dt = parse(review_date)
        except ValueError:
            log.error(f"Unable to parse date: {review_date}")
            raise
        review_date_dt = review_date_dt.replace(second=0, microsecond=0)
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


def _process_single_tune_feedback(
    db: Session,
    tune_id: str,
    tune_update: TuneFeedbackUpdate,
    user_ref: str,
    playlist_ref: int,
    sitdown_date: datetime,
    alg_type: AlgorithmType,
) -> None:
    practice_record = get_latest_practice_record(db, tune_id, playlist_ref)
    quality_int = validate_and_get_quality(tune_update, tune_id)
    if quality_int is None:
        return
    quality_str = tune_update.get("feedback")

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
            quality=quality_int,
            practiced=sitdown_date,
            quality_text=quality_str,
        )
    else:
        last_review_str = practice_record.review_date

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
            quality=quality_int,
            easiness=practice_record.easiness,
            interval=practice_record.interval,
            repetitions=practice_record.repetitions,
            practiced=sitdown_date,
            stability=getattr(practice_record, "stability", None),
            difficulty=getattr(practice_record, "difficulty", None),
            step=getattr(practice_record, "step", None),
            last_review=last_review,
        )

    review_dt = review_result_dict.get("review_datetime")
    if review_dt is None:
        review_date_str = ""
    else:
        review_date_str = parse_review_date(review_dt)

    practice_record.easiness = review_result_dict.get("easiness")
    practice_record.difficulty = review_result_dict.get("difficulty")
    practice_record.interval = review_result_dict.get("interval")
    practice_record.step = review_result_dict.get("step")
    practice_record.repetitions = review_result_dict.get("repetitions")
    practice_record.review_date = review_date_str
    practice_record.quality = quality_int
    practice_record.practiced = sitdown_date.strftime(TT_DATE_FORMAT)


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
            practiced_dt = datetime.strptime(record.practiced, TT_DATE_FORMAT)
            review_dt = (
                datetime.strptime(record.review_date, TT_DATE_FORMAT)
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


if __name__ == "__main__":
    query_and_print_tune_by_id(634)
