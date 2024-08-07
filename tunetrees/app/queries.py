from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Query, Session
from tabulate import tabulate

from tunetrees.api.auth import User
from tunetrees.app.database import SessionLocal
from tunetrees.models.tunetrees import (
    PracticeRecord,
    Tune,
    t_practice_list_joined,
)


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


def get_most_recent_practice_date(db: Session) -> datetime:
    query: Query[Any] = db.query(t_practice_list_joined)
    most_recent_schedualed = query.order_by(
        func.DATE(t_practice_list_joined.columns.get("Practiced")).desc()
    ).limit(1)

    practice_date_column_name = "Practiced"
    practice_date = t_practice_list_joined.columns.get(practice_date_column_name)
    assert practice_date is not None
    practice_date_column_index = list(t_practice_list_joined.columns.keys()).index(
        practice_date_column_name
    )
    most_recent_practice_date_str = most_recent_schedualed[0][
        practice_date_column_index
    ]
    most_recent_practice_date = datetime.fromisoformat(most_recent_practice_date_str)
    return most_recent_practice_date


def get_practice_list_scheduled(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    print_table=False,
    review_sitdown_date: Optional[datetime] = None,
    acceptable_delinquency_window=7,
) -> List[Tune]:
    """Get a list of tunes to practice on the review_sitdown_date.

    Get all tunes scheduled between the acceptable_delinquency_window and review_sitdown_date, but limit number to the `limit` var.

    Args:
        db (Session): _description_
        skip (int, optional): _description_. Defaults to 0.
        limit (int, optional): _description_. Defaults to 10.
        print_table (bool, optional): _description_. Defaults to False.
        review_sitdown_date (_type_, optional): _description_. Defaults to datetime.today().
        acceptable_delinquency_window (int, optional): _description_. Defaults to 7 days.

    Returns:
        List[Tune]: tunes scheduled between the acceptable_delinquency_window and review_sitdown_date, but limit number to the `limit` var.
    """
    if review_sitdown_date is None:
        review_sitdown_date = datetime.today()
    assert isinstance(review_sitdown_date, datetime)

    query: Query[Any] = db.query(t_practice_list_joined)
    scheduled_rows: List[Tune] = (
        query.filter(
            func.DATE(t_practice_list_joined.columns.get("ReviewDate"))
            > review_sitdown_date - timedelta(acceptable_delinquency_window)
        )
        .filter(
            func.DATE(t_practice_list_joined.columns.get("ReviewDate"))
            <= review_sitdown_date
        )
        .order_by(func.DATE(t_practice_list_joined.columns.get("ReviewDate")).desc())
        .offset(skip)
        .limit(limit)
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


def get_user(db: Session, id: str) -> User:
    stmt = select(User).where(User.id == id)
    result = db.execute(stmt)


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
