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


def get_most_recent_review_date(db: Session) -> datetime:
    query: Query[Any] = db.query(t_practice_list_joined)
    most_recent_schedualed = query.order_by(
        func.DATE(t_practice_list_joined.columns.get("Practiced")).desc()
    ).limit(1)

    review_date_column_name = "ReviewDate"
    review_date = t_practice_list_joined.columns.get(review_date_column_name)
    assert review_date is not None
    review_date_column_index = list(t_practice_list_joined.columns.keys()).index(
        review_date_column_name
    )
    most_recent_review_date_str = most_recent_schedualed[0][review_date_column_index]
    most_recent_review_date = datetime.fromisoformat(most_recent_review_date_str)
    return most_recent_review_date


def get_practice_list_scheduled(
    db: Session, skip: int = 0, limit: int = 10, print_table=False
) -> List[Tune]:
    most_recent_review_date = get_most_recent_review_date(db)
    # Get all tunes scheduled between most_recent_review_date and today, but limit to the `limit` var.

    query: Query[Any] = db.query(t_practice_list_joined)
    scheduled_rows: List[Tune] = (
        query.filter(
            func.DATE(t_practice_list_joined.columns.get("ReviewDate"))
            > most_recent_review_date
        )
        .filter(
            func.DATE(t_practice_list_joined.columns.get("ReviewDate"))
            <= (datetime.today())
        )
        .order_by(func.DATE(t_practice_list_joined.columns.get("ReviewDate")).desc())
        .offset(skip)
        .limit(15)
        .all()
    )
    # aged_limit = limit-len(scheduled_rows)
    # if aged_limit <= 0:
    #     aged_limit = 2
    aged_limit = 2
    aged_rows: List[Tune] = (
        query.order_by(func.DATE(t_practice_list_joined.columns.get("Practiced")).asc())
        .offset(skip)
        .limit(aged_limit)
        .all()
    )
    rows = scheduled_rows + aged_rows

    if print_table:
        print("\n--------")
        print(tabulate(rows, headers=t_practice_list_joined.columns.keys()))

    return rows


def get_practice_list_recently_played(
    db: Session, skip: int = 0, limit: int = 100, print_table=False
) -> List[Tune]:
    query: Query[Any] = db.query(t_practice_list_joined)
    rows: List[Tune] = (
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
