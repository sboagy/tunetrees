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
from tunetrees.models.quality import quality_lookup
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


class TuneUpdate(TypedDict):
    feedback: str


def update_practice_records(
    user_tune_updates: dict[str, TuneUpdate], playlist_ref: str
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
            quality_int = quality_lookup.get(quality, -1)
            if quality_int == -1:
                raise ValueError(f"Unexpected quality value: {quality_int}")

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
                    "Quality": quality,
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


def query_and_print_tune_by_id(tune_id: int, print_table=True):
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
