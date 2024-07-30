from typing import List

from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import get_practice_record_table, get_tune_table
from tunetrees.models.tunetrees import PracticeRecord, Tune


def clean_tune_data():  # sourcery skip: extract-method
    db = None
    try:
        db = SessionLocal()
        tunes: List[Tune] = get_tune_table(db, limit=1000)
        # Obviously you would normally just query for record 36

        for tune in tunes:
            if tune.Title:
                tune.Title = tune.Title.strip()
            if tune.Type:
                tune.Type = tune.Type.strip()
            if tune.Mode:
                tune.Mode = tune.Mode.strip()
            if tune.Structure:
                tune.Structure = tune.Structure.strip()
            if tune.Incipit:
                tune.Incipit = tune.Incipit.strip()
            print(
                f"\n{tune.ID=}, {tune.Title=}, {tune.Type=}, {tune.Mode=}, {tune.Structure=}, {tune.Incipit=}"
            )

        db.commit()
        db.flush(objects=tunes)

    finally:
        db.close()


def clean_practice_record_data():  # sourcery skip: extract-method
    db = None
    try:
        db = SessionLocal()

        practice_records: List[PracticeRecord] = get_practice_record_table(
            db, limit=1000
        )
        # Obviously you would normally just query for record 36

        for practice_record in practice_records:
            if practice_record.Practiced:
                practice_record.Practiced = practice_record.Practiced.strip()
            if practice_record.Feedback:
                practice_record.Feedback = practice_record.Feedback.strip()
            # if practice_record.PLAYLIST_REF:
            #     practice_record.PLAYLIST_REF = practice_record.PLAYLIST_REF.strip()
            if practice_record.TUNE_REF:
                practice_record.TUNE_REF = practice_record.TUNE_REF.strip()

            print(
                f"{practice_record.tune.Title=}, {practice_record.playlist.instrument=}, "
                f"{practice_record.PLAYLIST_REF=}, {practice_record.TUNE_REF=}, "
                f"{practice_record.Practiced=}, {practice_record.Feedback=}"
            )

        db.commit()
        db.flush(objects=practice_records)

    finally:
        db.close()


if __name__ == "__main__":
    # clean_tune_data()
    clean_practice_record_data()
