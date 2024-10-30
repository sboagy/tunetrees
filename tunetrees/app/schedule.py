import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, TypedDict, cast

from fsrs import Card, Rating
from sqlalchemy import Column, and_, select, update
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
    db = None
    try:
        db = SessionLocal()

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

    finally:
        if db is not None:
            db.close()


def initialize_review_records_from_practiced(
    print_table=True, from_backup_practiced=True
):  # sourcery skip: extract-method
    db = None
    try:
        db = SessionLocal()

        rows: List[PracticeRecord] = get_practice_record_table(db, limit=10000)

        for row in rows:
            # The values are:
            #
            #     Quality: The quality of recalling the answer from a scale of 0 to 5.
            #         5: perfect response.
            #         4: correct response after a hesitation.
            #         3: correct response recalled with serious difficulty.
            #         2: incorrect response; where the correct one seemed easy to recall.
            #         1: incorrect response; the correct one remembered.
            #         0: complete blackout.
            #     Easiness: The easiness factor, a multiplier that affects the size of the interval, determine by the quality of the recall.
            #     Interval: The gap/space between your next review.
            #     Repetitions: The count of correct response (quality >= 3) you have in a row.

            practiced_str: Column[str] = (
                row.backup_practiced if from_backup_practiced else row.practiced
            )
            if practiced_str is None:
                continue
            row.practiced = practiced_str

            # TODO: Get rid of these "type: ignore" escapes!
            quality = 1  # could calculate from how recent, or??  Otherwise, ¯\_(ツ)_/¯
            practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)  # type: ignore
            review = sm_two.first_review(quality, practiced)
            row.easiness = review.easiness  # type: ignore
            row.interval = review.interval  # type: ignore
            row.repetitions = review.repetitions  # type: ignore
            review_date_str = datetime.strftime(review.review_date, TT_DATE_FORMAT)  # type: ignore
            row.review_date = review_date_str  # type: ignore
            row.quality = quality  # type: ignore

        db.commit()
        db.flush(objects=rows)

        if print_table:
            rows_list = query_result_to_diagnostic_dict(
                rows, table_name="practice_record"
            )
            print("\n----------")
            print(tabulate(rows_list, headers="keys"))

    finally:
        if db is not None:
            db.close()


class BadTuneID(Exception):
    """Tune not found."""


def update_practice_record(
    tune_id: str,
    quality: str,
    playlist_ref: str,
):
    db = SessionLocal()
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

            # quality = 1  # could calculate from how recent, or??  Otherwise, ¯\_(ツ)_/¯
            # practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)  # type: ignore
            # review = sm_two.first_review(quality, practiced)

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
                    practiced_str = datetime.now(timezone.utc).strftime(TT_DATE_FORMAT)

                practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

                review = sm_two.first_review(quality_int, practiced)

                # Ignore the review date for new or rescheduled tunes, since the
                # sm_two algorithm seems to put it one day after the last practiced date,
                # which will probably be an aged out tune for tunetrees.  So, we'll just
                # set the review date to the current date, but respect the other values.
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

            # Update the PracticeRecord with the new review data
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
            # Handle the case where no PracticeRecord is found
            print("No PracticeRecord found for the given tune_id and playlist_ref")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# TODO: In the functions below, `update_practice_feedbacks` and `update_practice_schedules`, should
# be combined into a single function that takes a `TuneUpdate` object that includes both the feedback
# and the review date.  This would allow updating of other fields such as notes, etc. and would
# generally be more flexible.  The current separation is just a temporary measure to get the
# functionality working, and make the respective logic more clear.


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
    # It's a little ridiculous to have to fetch the user_ref from the playlist table, so
    # I should probably just pass user_ref to the API endpoint.  On the other hand, that seems
    # a tad redundant, since the playlist_ref implies the user_ref.  I'm gonna kick this can down
    # the road for now, until I determine how playlists and spaced repetition prefs might interact,
    # if at all.

    # Fetch user_ref from the playlist table
    stmt = select(Playlist.user_ref).where(Playlist.playlist_id == playlist_ref)
    user_ref_result = db.execute(stmt).one_or_none()
    if user_ref_result:
        user_ref = user_ref_result[0]
    else:
        raise ValueError(f"No playlist found for playlist_ref: {playlist_ref}")

    return user_ref


def e_factor_to_difficulty(e_factor: float) -> float:
    """
    Transforms an SM-2 E-Factor to an FSRS Difficulty (D).

    Args:
      e_factor: The E-Factor value from SM-2 (float between 1.3 and 2.5).

    Returns:
      The corresponding Difficulty (D) value for FSRS (float between 1 and 10).
    """
    normalized_e = (e_factor - 1.3) / (2.5 - 1.3)
    inverted_e = 1 - normalized_e
    d = 1 + inverted_e * 9
    return float(round(d))


def difficulty_to_e_factor(d: float) -> float:
    """
    Transforms an FSRS Difficulty (D) to an SM-2 E-Factor.

    Args:
      d: The Difficulty (D) value from FSRS (int between 1 and 10).

    Returns:
      The corresponding E-Factor value for SM-2 (float between 1.3 and 2.5).
    """
    normalized_d = (d - 1) / 9
    inverted_d = 1 - normalized_d
    e_factor = 1.3 + inverted_d * (2.5 - 1.3)
    return e_factor


def quality_to_fsrs_rating(quality: int) -> Rating:
    """
    Transforms a 6-value SM-2 Quality grade to a 4-value FSRS Rating.

    Args:
      quality: The Quality grade from SM-2 (int between 0 and 5).

    Returns:
      The corresponding Rating value for FSRS (Rating enum).
    """
    if quality in (0, 1):  # blackout or failed
        return Rating.Again
    elif quality == 2:  # barely
        return Rating.Hard
    elif quality == 3:  # struggled
        return Rating.Good
    elif quality in (4, 5):  # trivial or perfect
        return Rating.Easy
    else:
        raise ValueError(f"Unexpected quality value: {quality}")


def fsrs_rating_to_quality(rating: Rating):
    """
    Transforms a 4-value FSRS Rating to a 6-value SM-2 Quality grade.

    Args:
      rating: The Rating value from FSRS (Rating enum).

    Returns:
      The corresponding Quality grade for SM-2 (int between 0 and 5).
    """
    if rating == Rating.Again:
        return 0  # blackout (could also be 1 for failed, depending on preference)
    elif rating == Rating.Hard:
        return 2  # barely
    elif rating == Rating.Good:
        return 3  # struggled
    elif rating == Rating.Easy:
        return 5  # perfect (could also be 4 for trivial)


class ReviewResult(TypedDict):
    easiness: float
    interval: int
    repetitions: int
    review_datetime: str


def update_practice_feedbacks(
    user_tune_updates: dict[str, TuneFeedbackUpdate], playlist_ref: str | int
):
    playlist_ref = int(playlist_ref)
    with SessionLocal() as db:
        try:
            # Usage
            user_ref = fetch_user_ref_from_playlist_ref(db, playlist_ref)
            alg_type: AlgorithmType = fetch_algorithm_type(db, user_ref)

            stmt = select(
                PracticeRecord.tune_ref,
                PracticeRecord.easiness,
                PracticeRecord.interval,
                PracticeRecord.repetitions,
            ).where(
                and_(
                    PracticeRecord.tune_ref.in_(
                        [int(tune_id) for tune_id in user_tune_updates]
                    ),
                    PracticeRecord.playlist_ref == playlist_ref,
                )
            )
            row_results = db.execute(stmt).all()

            data_to_update = []
            for row_result in row_results:
                tune_id, easiness, interval, repetitions = row_result
                tune_id_int = int(tune_id)
                tune_update = user_tune_updates.get(tune_id)
                if tune_update is None:
                    # try with a string key
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
                            PracticeRecord.tune_ref == tune_id_int,
                            PracticeRecord.playlist_ref == playlist_ref,
                        )
                    )
                    # We want to preserve the original practiced date for rescheduled tunes,
                    # since a reschedule isn't a real practice event, but a re-scheduling of
                    # the tune for review.
                    practiced_result = db.execute(stmt).one_or_none()
                    if practiced_result:
                        practiced_str = practiced_result[0]
                    else:
                        practiced_str = datetime.strftime(
                            datetime.now(timezone.utc), TT_DATE_FORMAT
                        )

                    practiced_faux = datetime.now(timezone.utc) - timedelta(days=1)

                    if alg_type == AlgorithmType.SM2:
                        review = cast(
                            ReviewResult,
                            sm_two.first_review(quality_int, practiced_faux),
                        )
                    else:
                        card = Card()
                        due_str = datetime.strftime(card.due, TT_DATE_FORMAT)
                        review = ReviewResult(
                            easiness=card.difficulty,
                            interval=card.scheduled_days,
                            repetitions=card.reps,
                            review_datetime=due_str,
                        )
                        raise ValueError(f"Unexpected algorithm type: {alg_type}")
                else:
                    practiced_str = datetime.strftime(
                        datetime.now(timezone.utc), TT_DATE_FORMAT
                    )
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
                    # Remove milliseconds and seconds
                    review_date_dt = review_date_dt.replace(second=0, microsecond=0)
                    review_date_str = review_date_dt.strftime(TT_DATE_FORMAT)
                else:
                    raise ValueError(
                        f"Unexpected review_date type: {type(review_date)}: {review_date}"
                    )

                data_to_update.append(
                    {
                        "tune_ref": tune_id_int,
                        "playlist_ref": playlist_ref,
                        "interval": review["interval"],
                        "easiness": review["easiness"],
                        "repetitions": review["repetitions"],
                        "review_date": review_date_str,
                        "quality": quality_int,
                        "practiced": practiced_str,
                    }
                )

            # After the good intentions of trying to batch the updates, just do them one at a time
            # for now.  At least it's basically set up for full batch updates in the future,
            # and this looping is hidden from the rest of the code.
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

            # Consider using bulk update in the future

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


def update_practice_schedules(
    user_tune_updates: dict[str, TuneScheduleUpdate], playlist_ref: str
):
    db = SessionLocal()
    try:
        # Prepare data for bulk update
        # quality_int_lookup = {
        #     tune_id: quality_lookup.get(update_dict.get("feedback"), -1)
        #     for tune_id, update_dict in user_tune_updates.items()
        # }
        # quality_feedback_lookup = {
        #     tune_update["tune_id"]: tune_update.get("feedback")
        #     for tune_update in user_tune_updates
        # }
        stmt = select(
            PracticeRecord.tune_ref,
            PracticeRecord.easiness,
            PracticeRecord.interval,
            PracticeRecord.repetitions,
        ).where(
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
            tune_id, easiness, interval, repetitions = row_result  # type: ignore
            assert isinstance(tune_id, str)
            tune_update = user_tune_updates.get(tune_id)
            assert tune_update is not None
            review_date = tune_update.get("review_date")
            assert review_date is not None
            assert isinstance(user_tune_updates, Dict)

            # practiced_str = datetime.strftime(datetime.now(timezone.utc), TT_DATE_FORMAT)
            # practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

            # review = sm_two.review(
            #     quality_int,
            #     easiness,
            #     interval,
            #     repetitions,
            #     practiced,
            # )
            # review_date = review.get("review_datetime")
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
                    # "interval": review.get("interval"),
                    # "easiness": review.get("easiness"),
                    # "repetitions": review.get("repetitions"),
                    "review_date": review_date_str,
                    # "quality": quality,
                    # "practiced": practiced_str,
                }
            )

        # Execute bulk update
        # stmt = update(PracticeRecord).values(data_to_update)
        # If I just execute the above statement, I get:
        # InvalidRequestError('UPDATE construct does not support multiple parameter sets.')

        # So, after the good intentions of trying to batch the updates, just do them one at a time
        # for now.  At least it's basically set up for full batch updates in the future,
        # and this looping is hidden from the rest of the code.
        for data in data_to_update:
            stmt = (
                update(PracticeRecord)
                .where(PracticeRecord.tune_ref == data["tune_ref"])
                .values(data)
            )
            db.execute(stmt)

        # But I might be able to try something like this in the future,
        # not sure how much faster it would be though, or if it really
        # matters for the limited number of updates we're likely to be doing
        # here.
        #
        # # Assuming we have a 'tune_id' field in your data_to_update
        # stmt = (
        #     update(PracticeRecord)
        #     .join(
        #         data_to_update,
        #         PracticeRecord.TUNE_REF == data_to_update.c.TUNE_REF,
        #     )
        #     .values(
        #         PracticeRecord.review_date=data_to_update.c.review_date,
        #         PracticeRecord.quality=data_to_update.c.quality,
        #         PracticeRecord.practiced=data_to_update.c.practiced,
        #     )
        # )
        # db.execute(stmt)

        db.commit()

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def query_and_print_tune_by_id(tune_id: int, print_table=True):
    """Diagnostic function to query and print a tune by its ID.

    Args:
        tune_id (int): unique ID of the tune to query.
        print_table (bool, optional): only prints the table if True. Defaults to True.
    """
    db = None
    try:
        db = SessionLocal()

        stmt = select(PracticeRecord).where(PracticeRecord.tune_ref == tune_id)
        rows = [db.execute(stmt).one()[0]]

        if print_table:
            rows_list = query_result_to_diagnostic_dict(
                rows, table_name="practice_record"
            )
            print("\n----------")
            print(tabulate(rows_list, headers="keys"))
    finally:
        if db:
            db.close()


if __name__ == "__main__":
    # clean_tune_data()
    # initialize_review_records_from_practiced()
    # backup_practiced_dates()
    query_and_print_tune_by_id(634)
    # submit_review(634, "barely")
    # query_and_print_tune_by_id(634, print_table=True)
