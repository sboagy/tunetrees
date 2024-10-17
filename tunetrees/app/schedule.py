import logging
from datetime import datetime
from typing import Dict, List, TypedDict

from sqlalchemy import Column, and_, select, update
from supermemo2 import sm_two
from tabulate import tabulate

from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import (
    get_practice_record_table,
    query_result_to_diagnostic_dict,
)
from tunetrees.models.quality import NEW, NOT_SET, RESCHEDULED, quality_lookup
from tunetrees.models.tunetrees import PracticeRecord

log = logging.getLogger()

TT_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def backup_practiced_dates():  # sourcery skip: extract-method
    db = None
    try:
        db = SessionLocal()

        practice_records: List[PracticeRecord] = get_practice_record_table(
            db, limit=10000
        )

        for practice_record in practice_records:
            practice_record.BackupPracticed = practice_record.Practiced

            assert practice_record.tune
            assert practice_record.playlist

            print(
                f"{practice_record.tune.Title=}, {practice_record.playlist.instrument=}, "
                f"{practice_record.PLAYLIST_REF=}, {practice_record.TUNE_REF=}, "
                f"{practice_record.Practiced=}, {practice_record.Feedback=}"
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
                row.BackupPracticed if from_backup_practiced else row.Practiced
            )
            if practiced_str is None:
                continue
            row.Practiced = practiced_str

            # TODO: Get rid of these "type: ignore" escapes!
            quality = 1  # could calculate from how recent, or??  Otherwise, ¯\_(ツ)_/¯
            practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)  # type: ignore
            review = sm_two.first_review(quality, practiced)
            row.Easiness = review.easiness  # type: ignore
            row.Interval = review.interval  # type: ignore
            row.Repetitions = review.repetitions  # type: ignore
            review_date_str = datetime.strftime(review.review_date, TT_DATE_FORMAT)  # type: ignore
            row.ReviewDate = review_date_str  # type: ignore
            row.Quality = quality  # type: ignore

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
                PracticeRecord.TUNE_REF == tune_id,
                PracticeRecord.PLAYLIST_REF == playlist_ref,
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
                stmt = select(PracticeRecord.Practiced).where(
                    and_(
                        PracticeRecord.TUNE_REF == tune_id,
                        PracticeRecord.PLAYLIST_REF == playlist_ref,
                    )
                )
                practiced_result = db.execute(stmt).one_or_none()
                if practiced_result:
                    practiced_str = practiced_result[0]
                else:
                    practiced_str = datetime.strftime(datetime.now(), TT_DATE_FORMAT)

                practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

                review = sm_two.first_review(quality_int, practiced)

                # Ignore the review date for new or rescheduled tunes, since the
                # sm_two algorithm seems to put it one day after the last practiced date,
                # which will probably be an aged out tune for tunetrees.  So, we'll just
                # set the review date to the current date, but respect the other values.
                review_date_str = datetime.strftime(datetime.now(), TT_DATE_FORMAT)

            else:
                practiced_str = datetime.strftime(datetime.now(), TT_DATE_FORMAT)
                practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

                review = sm_two.review(
                    quality_int,
                    practice_record.Easiness,
                    practice_record.Interval,
                    practice_record.Repetitions,
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
            practice_record.ReviewDate = review_date_str

            db.execute(
                update(PracticeRecord)
                .where(
                    and_(
                        PracticeRecord.TUNE_REF == tune_id,
                        PracticeRecord.PLAYLIST_REF == playlist_ref,
                    )
                )
                .values(
                    Easiness=review.get("easiness"),
                    Interval=review.get("interval"),
                    Repetitions=review.get("repetitions"),
                    ReviewDate=review_date_str,
                    Quality=quality,
                    Practiced=practiced_str,
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


def update_practice_feedbacks(
    user_tune_updates: dict[str, TuneFeedbackUpdate], playlist_ref: str
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
            PracticeRecord.TUNE_REF,
            PracticeRecord.Easiness,
            PracticeRecord.Interval,
            PracticeRecord.Repetitions,
        ).where(
            and_(
                PracticeRecord.TUNE_REF.in_(
                    [int(tune_id) for tune_id in user_tune_updates]
                ),
                PracticeRecord.PLAYLIST_REF == playlist_ref,
            )
        )
        row_results = db.execute(stmt).all()

        data_to_update = []
        for row_result in row_results:
            tune_id, easiness, interval, repetitions = row_result
            assert isinstance(tune_id, str)
            tune_update = user_tune_updates.get(tune_id)
            assert tune_update is not None
            quality = tune_update.get("feedback")
            assert quality is not None
            assert isinstance(user_tune_updates, Dict)
            quality_int = quality_lookup.get(quality, -2)
            if quality_int == -2:
                raise ValueError(f"Unexpected quality value: {quality_int}")
            if quality == NOT_SET:
                continue

            if quality == NEW or quality == RESCHEDULED:
                stmt = select(PracticeRecord.Practiced).where(
                    and_(
                        PracticeRecord.TUNE_REF == tune_id,
                        PracticeRecord.PLAYLIST_REF == playlist_ref,
                    )
                )
                practiced_result = db.execute(stmt).one_or_none()
                if practiced_result:
                    practiced_str = practiced_result[0]
                else:
                    practiced_str = datetime.strftime(datetime.now(), TT_DATE_FORMAT)

                practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

                review = sm_two.first_review(quality_int, practiced)
                # Ignore the review date for new or rescheduled tunes, since the
                # sm_two algorithm seems to put it one day after the last practiced date,
                # which will probably be an aged out tune for tunetrees.  So, we'll just
                # set the review date to the current date, but respect the other values.
                review_date_str = datetime.strftime(datetime.now(), TT_DATE_FORMAT)
            else:
                practiced_str = datetime.strftime(datetime.now(), TT_DATE_FORMAT)
                practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

                review = sm_two.review(
                    quality_int,
                    easiness,
                    interval,
                    repetitions,
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

            data_to_update.append(
                {
                    "TUNE_REF": tune_id,
                    "PLAYLIST_REF": playlist_ref,
                    "Interval": review.get("interval"),
                    "Easiness": review.get("easiness"),
                    "Repetitions": review.get("repetitions"),
                    "ReviewDate": review_date_str,
                    "Quality": quality_int,
                    "Practiced": practiced_str,
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
                .where(PracticeRecord.TUNE_REF == data["TUNE_REF"])
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
        #         PracticeRecord.ReviewDate=data_to_update.c.ReviewDate,
        #         PracticeRecord.Quality=data_to_update.c.Quality,
        #         PracticeRecord.Practiced=data_to_update.c.Practiced,
        #     )
        # )
        # db.execute(stmt)

        db.commit()

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


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
            PracticeRecord.TUNE_REF,
            PracticeRecord.Easiness,
            PracticeRecord.Interval,
            PracticeRecord.Repetitions,
        ).where(
            and_(
                PracticeRecord.TUNE_REF.in_(
                    [int(tune_id) for tune_id in user_tune_updates]
                ),
                PracticeRecord.PLAYLIST_REF == playlist_ref,
            )
        )
        row_results = db.execute(stmt).all()

        data_to_update = []
        for row_result in row_results:
            tune_id, easiness, interval, repetitions = row_result
            assert isinstance(tune_id, str)
            tune_update = user_tune_updates.get(tune_id)
            assert tune_update is not None
            review_date = tune_update.get("review_date")
            assert review_date is not None
            assert isinstance(user_tune_updates, Dict)

            # practiced_str = datetime.strftime(datetime.now(), TT_DATE_FORMAT)
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
            elif isinstance(review_date, str):
                review_date_str = review_date
            else:
                raise ValueError(
                    f"Unexpected review_date type: {type(review_date)}: {review_date}"
                )

            data_to_update.append(
                {
                    "TUNE_REF": tune_id,
                    "PLAYLIST_REF": playlist_ref,
                    # "Interval": review.get("interval"),
                    # "Easiness": review.get("easiness"),
                    # "Repetitions": review.get("repetitions"),
                    "ReviewDate": review_date_str,
                    # "Quality": quality,
                    # "Practiced": practiced_str,
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
                .where(PracticeRecord.TUNE_REF == data["TUNE_REF"])
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
        #         PracticeRecord.ReviewDate=data_to_update.c.ReviewDate,
        #         PracticeRecord.Quality=data_to_update.c.Quality,
        #         PracticeRecord.Practiced=data_to_update.c.Practiced,
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

        stmt = select(PracticeRecord).where(PracticeRecord.TUNE_REF == tune_id)
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
