from typing import List

from tunetrees.app.database import SessionLocal
from tunetrees.models.query import get_tune_table
from tunetrees.models.tunetrees import Tune


def test_basic_connect_and_read():
    db = None
    try:
        db = SessionLocal()
        tunes: List[Tune] = get_tune_table(db, limit=1000)
        # Obviously you would normally just query for record 36
        filtered = list(filter(lambda tune: tune.ID == 36, tunes))
        # filtered = [tune for tune in tunes if tune.ID == 36]
        assert filtered
        r36 = filtered[0]
        assert r36.Title == "Lilting Fisherman"
        print(
            f"\n{r36.ID=}, {r36.Title=}, {r36.Type=}, {r36.Mode=}, {r36.Structure=}, {r36.Incipit=}"
        )
    finally:
        db.close()
