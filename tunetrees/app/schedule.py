from datetime import datetime
from typing import List

from sqlalchemy import select, update
from tabulate import tabulate

from supermemo2 import SMTwo
from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import (
    get_practice_record_table,
    query_result_to_diagnostic_dict,
)
from tunetrees.models.quality import quality_lookup
from tunetrees.models.tunetrees import PracticeRecord

TT_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def backup_practiced_dates():  # sourcery skip: extract-method
    db = None
    try:
        db = SessionLocal()

        practice_records: List[PracticeRecord] = get_practice_record_table(
            db, limit=10000
        )

        for practice_record in practice_records:
            if practice_record.Practiced:
                practice_record.BackupPracticed = practice_record.Practiced

            print(
                f"{practice_record.tune.Title=}, {practice_record.playlist.instrument=}, "
                f"{practice_record.PLAYLIST_REF=}, {practice_record.TUNE_REF=}, "
                f"{practice_record.Practiced=}, {practice_record.Feedback=}"
            )

        db.commit()
        db.flush(objects=practice_records)

    finally:
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

            practiced_str = (
                row.BackupPracticed if from_backup_practiced else row.Practiced
            )
            if not practiced_str:
                continue
            row.Practiced = practiced_str
            quality = 1  # could calculate from how recent, or??  Otherwise, ¯\_(ツ)_/¯
            practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)
            review = SMTwo.first_review(quality, practiced)
            row.Easiness = review.easiness
            row.Interval = review.interval
            row.Repetitions = review.repetitions
            review_date_str = datetime.strftime(review.review_date, TT_DATE_FORMAT)
            row.ReviewDate = review_date_str
            row.Quality = quality

        db.commit()
        db.flush(objects=rows)

        if print_table:
            rows_list = query_result_to_diagnostic_dict(
                rows, table_name="practice_record"
            )
            print("\n----------")
            print(tabulate(rows_list, headers="keys"))

    finally:
        db.close()


class BadTuneID(Exception):
    """Tune not found."""


def submit_review(tune_id: int, feedback: str):
    db = None
    quality = quality_lookup.get(feedback)
    if quality < 0:
        return
    assert quality <= quality_lookup.get("perfect")
    try:
        db = SessionLocal()

        practiced_str = datetime.strftime(datetime.now(), TT_DATE_FORMAT)
        practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)

        stmt = select(PracticeRecord).where(PracticeRecord.TUNE_REF == tune_id)
        row = db.execute(stmt).one()[0]

        review = SMTwo(row.Easiness, row.Interval, row.Repetitions).review(quality, practiced)
        review_date_str = datetime.strftime(review.review_date, TT_DATE_FORMAT)

        db.execute(
            update(PracticeRecord)
            .where(PracticeRecord.TUNE_REF == tune_id)
            .values(
                Easiness=review.easiness,
                Interval=review.interval,
                Repetitions=review.repetitions,
                ReviewDate=review_date_str,
                Quality=quality,
                Practiced=practiced_str,
            ),
            execution_options={"synchronize_session": False},
        )

        db.commit()
        db.flush()

    except Exception as e:
        print(f"Exception occurred when updating practice record {e}")
        raise
    finally:
        if db:
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
