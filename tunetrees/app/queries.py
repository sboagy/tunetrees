from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, func
from sqlalchemy.engine.row import Row
from sqlalchemy.orm import Query, Session
from tabulate import tabulate

from tunetrees.app.database import SessionLocal
from tunetrees.models.practice_list_joined import (
    get_practice_list_query,
    practice_list_columns,
)
from tunetrees.models.tunetrees import (
    Playlist,
    PracticeRecord,
    Tune,
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


def get_playlist_ids_for_user(session: Session, USER_REF) -> List[int]:
    playlist_ids = (
        session.query(Playlist.PLAYLIST_ID).filter(Playlist.USER_REF == USER_REF).all()
    )
    return [playlist_id[0] for playlist_id in playlist_ids]


def get_most_recent_review_date(session: Session, playlist_ref: int) -> None | datetime:
    most_recent_review_date = (
        session.query(PracticeRecord)
        .filter(PracticeRecord.PLAYLIST_REF == playlist_ref)
        .order_by(desc(PracticeRecord.ReviewDate))
        .first()
    )
    if most_recent_review_date is None:
        return None
    most_recent_review_date_str = most_recent_review_date.ReviewDate
    most_recent_review_date = datetime.fromisoformat(most_recent_review_date_str)
    return most_recent_review_date


def get_most_recent_practiced(session: Session, playlist_ref: int):
    most_recent_practice = (
        session.query(PracticeRecord)
        .filter(PracticeRecord.PLAYLIST_REF == playlist_ref)
        .order_by(desc(PracticeRecord.Practiced))
        .first()
    )
    if most_recent_practice is None:
        return None
    most_recent_practice_date_str = most_recent_practice.Practiced
    most_recent_practice_date = datetime.fromisoformat(most_recent_practice_date_str)
    return most_recent_practice_date


def get_practice_list_scheduled(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    print_table=False,
    review_sitdown_date: Optional[datetime] = None,
    acceptable_delinquency_window=7,
    playlist_ref=1,
    user_ref=1,
) -> List[Row[Any]]:
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

    practice_list_query = get_practice_list_query(db, playlist_ref, user_ref)

    scheduled_rows: List[Row] = (
        practice_list_query.where(
            PracticeRecord.ReviewDate
            > review_sitdown_date - timedelta(acceptable_delinquency_window)
        )
        .where(PracticeRecord.ReviewDate <= review_sitdown_date)
        .order_by(func.DATE(PracticeRecord.ReviewDate).desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    aged_limit = limit - len(scheduled_rows)
    if aged_limit <= 0:
        aged_limit = 2
    aged_limit = 2
    aged_rows: List[Tune] = (
        practice_list_query.order_by(func.DATE(PracticeRecord.Practiced).asc())
        .offset(skip)
        .limit(aged_limit)
        .all()
    )
    rows = scheduled_rows + aged_rows

    # if print_table:
    #     print("\n--------")
    #     print(tabulate(rows, headers=t_practice_list_joined.columns.keys()))

    return rows


def get_practice_list_recently_played(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    print_table=False,
    playlist_ref=1,
    user_ref=1,
) -> List[Tune]:
    query = get_practice_list_query(db, playlist_ref, user_ref)
    rows: List[Tune] = (
        query.order_by(func.DATE(PracticeRecord.Practiced).desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # TODO: make a decent print_table function
    # if print_table:
    #     print("\n--------")
    #     print(tabulate(rows, headers=t_practice_list_joined.columns.keys()))

    return rows


def _run_experiment():
    db = None
    try:
        db = SessionLocal()
        tunes = get_practice_list_scheduled(db, limit=10, print_table=True)
        for tune in tunes:
            for column_name in practice_list_columns:
                column_index = practice_list_columns[column_name]
                if column_index != 0:
                    print("   ", end="")
                print(f"{column_name}: {tune[column_index]}")
                # assert tunes
    finally:
        if db:
            db.close()


if __name__ == "__main__":
    _run_experiment()
