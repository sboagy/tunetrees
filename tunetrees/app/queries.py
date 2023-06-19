from typing import List, Any, Dict

from sqlalchemy import func
from sqlalchemy.orm import Session, Query
from tabulate import tabulate

from tunetrees.app.database import SessionLocal
from tunetrees.models.tunetrees import (
    Tune,
    PracticeRecord,
    t_practice_list_joined,
)
from datetime import datetime, timedelta


def query_result_to_diagnostic_dict(rows, table_name) -> List[Dict[str, Any]]:
    rows_list = []
    for row in rows:
        column_names = row.metadata.tables[table_name].columns.keys()
        row_dict = {k: getattr(row, k) for k in column_names}
        rows_list.append(row_dict)
    return rows_list


def get_tune_table(
    db: Session, skip: int = 0, limit: int = 100, print_table=False
) -> List[Tune]:
    query: Query[Any] = db.query(Tune)
    rows = query.offset(skip).limit(limit).all()
    if print_table:
        rows_list = query_result_to_diagnostic_dict(rows, table_name="tune")
        print("\n----------")
        print(tabulate(rows_list, headers="keys"))
    return rows


def get_practice_record_table(
    db: Session, skip: int = 0, limit: int = 100, print_table=False
) -> List[PracticeRecord]:
    query: Query[Any] = db.query(PracticeRecord)
    rows = query.offset(skip).limit(limit).all()

    if print_table:
        rows_list = query_result_to_diagnostic_dict(rows, table_name="practice_record")
        print(tabulate(rows_list, headers="keys"))

    return rows


def get_practice_list_scheduled(
    db: Session, skip: int = 0, limit: int = 10, print_table=False
) -> List[t_practice_list_joined]:
    query: Query[Any] = db.query(t_practice_list_joined)
    scheduled_rows = (
        query.
        filter(func.DATE(t_practice_list_joined.columns.get("ReviewDate")) <= (datetime.today()-timedelta(days=3))).
        order_by(
            func.DATE(t_practice_list_joined.columns.get("ReviewDate")).asc()
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    aged_rows = (
        query.order_by(
            func.DATE(t_practice_list_joined.columns.get("ReviewDate")).asc()
        )
        .offset(skip)
        .limit(limit-len(scheduled_rows))
        .all()
    )
    rows = scheduled_rows+aged_rows

    if print_table:
        print("\n--------")
        print(tabulate(rows, headers=t_practice_list_joined.columns.keys()))

    return rows


def get_practice_list_recently_played(
    db: Session, skip: int = 0, limit: int = 100, print_table=False
) -> List[t_practice_list_joined]:
    query: Query[Any] = db.query(t_practice_list_joined)
    rows = (
        query.order_by(
            func.DATE(t_practice_list_joined.columns.get("Practiced")).desc()
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    if print_table:
        print("\n--------")
        print(tabulate(rows, headers=t_practice_list_joined.columns.keys()))

    return rows


def _run_experiment():
    db = None
    try:
        db = SessionLocal()
        tunes: List[Tune] = get_practice_list_scheduled(db, limit=10, print_table=True)
        assert tunes
    finally:
        if db:
            db.close()


if __name__ == "__main__":
    _run_experiment()
