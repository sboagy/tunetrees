import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, TypedDict, cast

from fsrs import Card, Rating
from sqlalchemy import and_, select, update
from sqlalchemy.orm.session import Session
from supermemo2 import sm_two
from tabulate import tabulate
from dateutil.parser import parse

from tunetrees.api.preferences import AlgorithmType
from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import (
    get_practice_record_table,
    query_result_to_diagnostic_dict,
)
from tunetrees.models.quality import NEW, NOT_SET, RESCHEDULED, quality_lookup
from tunetrees.models.tunetrees import Playlist, PracticeRecord, PrefsSpacedRepetition

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
#             review = sm_two.first_review(quality, practiced)
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


def update_practice_record(
    tune_id: str,
    quality: str,
    playlist_ref: str,
):
    with SessionLocal() as db:
        try:
            stmt = select(PracticeRecord).where(
                and_(
                    PracticeRecord.tune_ref == tune_id,
                    PracticeRecord.playlist_ref == playlist_ref,
                )
            )
            row_result = db.execute(stmt).one_or_none()

            if row_result:
                practice_record: PracticeRecord = row_result[0]
                quality_int = quality_lookup.get(quality, -1)
                if quality_int == -1:
                    raise ValueError(f"Unexpected quality value: {quality}")

                if quality == NEW or quality == RESCHEDULED:
                    stmt = select(PracticeRecord.practiced).where(
                        and_(
                            PracticeRecord.tune_ref == tune_id,
                            PracticeRecord.playlist_ref == playlist_ref,
                        )
                    )
                    practiced_result = db.execute(stmt).one_or_none()
                    if practiced_result:
                        practiced_str = practiced_result[0]
                    else:
                        practiced_str = datetime.now(timezone.utc).strftime(
                            TT_DATE_FORMAT
                        )

                    practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

                    review = sm_two.first_review(quality_int, practiced)

                    review_date_str = datetime.strftime(
                        datetime.now(timezone.utc), TT_DATE_FORMAT
                    )

                else:
                    practiced_str = datetime.strftime(
                        datetime.now(timezone.utc), TT_DATE_FORMAT
                    )
                    practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

                    review = sm_two.review(
                        quality_int,
                        practice_record.easiness,
                        practice_record.interval,
                        practice_record.repetitions,
                        practiced,
                    )

                    review_date = review.get("review_datetime")
                    if isinstance(review_date, datetime):
                        review_date_str = datetime.strftime(review_date, TT_DATE_FORMAT)
                    elif isinstance(review_date, str):
                        review_date_str = review_date
                    else:
                        raise ValueError(
                            f"Unexpected review_date type: {type(review_date)}: {review_date}"
                        )

                practice_record.review_date = review_date_str

                db.execute(
                    update(PracticeRecord)
                    .where(
                        and_(
                            PracticeRecord.tune_ref == tune_id,
                            PracticeRecord.playlist_ref == playlist_ref,
                        )
                    )
                    .values(
                        easiness=review.get("easiness"),
                        interval=review.get("interval"),
                        repetitions=review.get("repetitions"),
                        review_date=review_date_str,
                        quality=quality,
                        practiced=practiced_str,
                    ),
                    execution_options={"synchronize_session": False},
                )

                db.commit()
                db.flush()
            else:
                print("No PracticeRecord found for the given tune_id and playlist_ref")

        except Exception as e:
            db.rollback()
            raise e


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
        return AlgorithmType.SM2


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


def quality_to_fsrs_rating(quality: int) -> Rating:
    if quality in (0, 1):
        return Rating.Again
    elif quality == 2:
        return Rating.Hard
    elif quality == 3:
        return Rating.Good
    elif quality in (4, 5):
        return Rating.Easy
    else:
        raise ValueError(f"Unexpected quality value: {quality}")


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
    easiness: float
    interval: int
    repetitions: int
    review_datetime: str


def update_practice_feedbacks(  # noqa: C901
    user_tune_updates: dict[str, TuneFeedbackUpdate],
    playlist_ref: str | int,
    review_sitdown_date: Optional[datetime] = None,
):
    playlist_ref = int(playlist_ref)
    sitdown_date = review_sitdown_date or datetime.now(timezone.utc)
    with SessionLocal() as db:
        try:
            # TODO: This needs to handle the case where the user_tune_updates entry
            #       is not found.  The simplest solution is to query one tune at a time.
            user_ref = fetch_user_ref_from_playlist_ref(db, playlist_ref)
            alg_type: AlgorithmType = fetch_algorithm_type(db, user_ref)

            stmt = select(PracticeRecord).where(
                and_(
                    PracticeRecord.tune_ref.in_(
                        [int(tune_id) for tune_id in user_tune_updates]
                    ),
                    PracticeRecord.playlist_ref == playlist_ref,
                )
            )
            row_results = db.execute(stmt).all()

            data_to_update = []
            for row_result_tuple in row_results:
                # row_result_tuple is of type `Tuple[PracticeRecord]`.  I'm not sure
                # yet why that tuple layer is there.
                row_result = row_result_tuple[0]
                tune_id = row_result.tune_ref
                easiness = row_result.easiness
                interval = row_result.interval
                repetitions = row_result.repetitions
                tune_update = user_tune_updates.get(tune_id)
                if tune_update is None:
                    tune_update = user_tune_updates.get(str(tune_id))
                if tune_update is None:
                    raise ValueError(f"No update found for tune_id: {tune_id}")
                quality = tune_update.get("feedback")
                if not quality:
                    raise ValueError(
                        f"Quality is is not specified for tune_id: {tune_id}"
                    )
                quality_int = quality_lookup.get(quality, -2)
                if quality_int == -2:
                    raise ValueError(f"Unexpected quality value: {quality_int}")
                if quality == NOT_SET:
                    continue

                if quality == NEW or quality == RESCHEDULED:
                    stmt = select(PracticeRecord.practiced).where(
                        and_(
                            PracticeRecord.tune_ref == tune_id,
                            PracticeRecord.playlist_ref == playlist_ref,
                        )
                    )
                    practiced_result = db.execute(stmt).one_or_none()

                    if practiced_result:
                        # This is the case where the user just wants the tune to be scheduled for review
                        # immediately, presumably so they can practice it, but we don't want to change
                        # any of the other metrics.
                        quality_int = row_result.quality
                        practiced_str = row_result.practiced
                        review_date_str = datetime.strftime(
                            sitdown_date, TT_DATE_FORMAT
                        )
                        review = ReviewResult(
                            easiness=row_result.easiness,
                            interval=row_result.interval,
                            repetitions=row_result.repetitions,
                            review_datetime=review_date_str,
                        )

                    elif alg_type == AlgorithmType.SM2:
                        # This is the case where the user hasn't ever practiced the tune.
                        practiced_str = datetime.strftime(sitdown_date, TT_DATE_FORMAT)
                        practiced_faux = sitdown_date - timedelta(days=1)

                        review = cast(
                            ReviewResult,
                            sm_two.first_review(quality_int, practiced_faux),
                        )
                    else:
                        practiced_str = datetime.strftime(sitdown_date, TT_DATE_FORMAT)
                        card = Card()
                        due_str = datetime.strftime(card.due, TT_DATE_FORMAT)
                        review = ReviewResult(
                            easiness=card.difficulty
                            if card.difficulty is not None
                            else 0.0,
                            interval=0,
                            repetitions=0,
                            review_datetime=due_str,
                        )
                        raise ValueError(f"Unexpected algorithm type: {alg_type}")
                else:
                    practiced_str = datetime.strftime(sitdown_date, TT_DATE_FORMAT)
                    practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

                    if alg_type == AlgorithmType.SM2:
                        review = cast(
                            ReviewResult,
                            sm_two.review(
                                quality_int,
                                easiness,
                                interval,
                                repetitions,
                                practiced,
                            ),
                        )
                    else:
                        raise ValueError(f"Unexpected algorithm type: {alg_type}")

                review_date = review.get("review_datetime")
                if isinstance(review_date, datetime):
                    review_date_str = datetime.strftime(review_date, TT_DATE_FORMAT)
                elif isinstance(review_date, str):  # type: ignore
                    try:
                        review_date_dt = parse(review_date)
                    except ValueError:
                        log.error(f"Unable to parse date: {review_date}")
                        raise
                    review_date_dt = review_date_dt.replace(second=0, microsecond=0)
                    review_date_str = review_date_dt.strftime(TT_DATE_FORMAT)
                else:
                    raise ValueError(
                        f"Unexpected review_date type: {type(review_date)}: {review_date}"
                    )

                data_to_update.append(
                    {
                        "tune_ref": tune_id,
                        "playlist_ref": playlist_ref,
                        "interval": review["interval"],
                        "easiness": review["easiness"],
                        "repetitions": review["repetitions"],
                        "review_date": review_date_str,
                        "quality": quality_int,
                        "practiced": practiced_str,
                    }
                )

            for data in data_to_update:
                tune_id_int = int(data["tune_ref"])
                stmt = select(PracticeRecord).where(
                    PracticeRecord.tune_ref == tune_id_int,
                    PracticeRecord.playlist_ref == playlist_ref,
                )
                record = db.execute(stmt).scalars().first()
                if record:
                    for key, value in data.items():
                        if key not in {"tune_ref", "playlist_ref"}:
                            setattr(record, key, value)
                else:
                    log.error(f"No record found for tune_ref: {data['tune_ref']}")

            db.commit()

            for data in data_to_update:
                updated_record = (
                    db.query(PracticeRecord)
                    .filter(
                        PracticeRecord.tune_ref == data["tune_ref"],
                        PracticeRecord.playlist_ref == int(playlist_ref),
                    )
                    .first()
                )
                if updated_record:
                    print("After update:", updated_record.review_date)
                else:
                    print(
                        "No record found after update for tune_ref:", data["tune_ref"]
                    )

        except Exception as e:
            db.rollback()
            log.error(f"An error occurred during the update: {e}")
            raise


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


if __name__ == "__main__":
    query_and_print_tune_by_id(634)
