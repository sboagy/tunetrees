from typing import List
from datetime import datetime

from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import get_tune_table, get_practice_list_scheduled
from tunetrees.models.tunetrees import Tune


def test_basic_connect_and_read():
    db = None
    try:
        db = SessionLocal()
        tunes: List[Tune] = get_tune_table(db, limit=1000, print_table=True)
        # Obviously you would normally just query for record 36
        filtered = list(filter(lambda tune: tune.ID == 36, tunes))
        # filtered = [tune for tune in tunes if tune.ID == 36]
        assert filtered
        r36 = filtered[0]
        assert str(r36.Title) == "Lilting Fisherman"
        print(
            f"\n{r36.ID=}, {r36.Title=}, {r36.Type=}, {r36.Mode=}, {r36.Structure=}, {r36.Incipit=}"
        )
    finally:
        if db is not None:
            db.close()


def test_practice_list_joined():
    db = None
    try:
        db = SessionLocal()
        tunes: List[Tune] = get_practice_list_scheduled(
            db,
            limit=1000,
            print_table=True,
            review_sitdown_date=datetime.fromisoformat("2024-07-08 12:27:08"),
        )
        # Obviously you would normally just query for record 36
        filtered = list(filter(lambda tune: tune.ID == 924, tunes))
        # filtered = [tune for tune in tunes if tune.ID == 36]
        assert filtered
        r1714 = filtered[0]
        assert str(r1714.Title) == "Jenny Picking Cockles"
    finally:
        if db is not None:
            db.close()
