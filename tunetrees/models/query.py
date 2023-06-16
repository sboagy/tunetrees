from typing import List, Any

from sqlalchemy.orm import Session, Query

from tunetrees.models.tunetrees import Tune, PracticeRecord


def get_tune_table(db: Session, skip: int = 0, limit: int = 100) -> List[Tune]:
    query: Query[Any] = db.query(Tune)
    return query.offset(skip).limit(limit).all()

def get_practice_record_table(db: Session, skip: int = 0, limit: int = 100) -> List[PracticeRecord]:
    query: Query[Any] = db.query(PracticeRecord)
    return query.offset(skip).limit(limit).all()
