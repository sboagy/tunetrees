from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, desc, func
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


def find_dict_index(data: list, key, value):
    for i, item in enumerate(data):
        if item[key] == value:
            return i
    return -1


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
    (This version uses the practice_list_joined view, instead of
    constructing a view via the get_practice_list_query function.)

    Get all tunes scheduled between the acceptable_delinquency_window and review_sitdown_date, but limit number to the `limit` var.

    Args:
        db (Session): _description_
        skip (int, optional): _description_. Defaults to 0.
        limit (int, optional): _description_. Defaults to 10.
        print_table (bool, optional): _description_. Defaults to False.
        review_sitdown_date (_type_, optional): _description_. Defaults to datetime.today().
        acceptable_delinquency_window (int, optional): _description_. Defaults to 7 days.
        playlist_ref (int, optional): The playlist ID to filter on. Defaults to 1.
        user_ref (int, optional): The user ID to filter on. Defaults to 1.

    Returns:
        List[Tune]: tunes scheduled between the acceptable_delinquency_window and review_sitdown_date, but limit number to the `limit` var.
    """
    if review_sitdown_date is None:
        review_sitdown_date = datetime.today()
        print("review_sitdown_date is None, using today: ", review_sitdown_date)
    assert isinstance(review_sitdown_date, datetime)

    # This is really strange, but it seems to be necessary to add a
    # day to the review_sitdown_date to get this to agree with the
    # older code. I don't know why this is necessary!  Probably
    # a bad hack.
    review_sitdown_date = review_sitdown_date + timedelta(days=1)

    lower_bound_date = review_sitdown_date - timedelta(
        days=acceptable_delinquency_window
    )

    # Create the query
    practice_list_query = db.query(t_practice_list_joined).filter(
        and_(
            t_practice_list_joined.c.USER_REF == user_ref,
            t_practice_list_joined.c.PLAYLIST_REF == playlist_ref,
            t_practice_list_joined.c.ReviewDate > lower_bound_date,
            t_practice_list_joined.c.ReviewDate <= review_sitdown_date,
        )
    )

    scheduled_rows_query_sorted = practice_list_query.order_by(
        func.DATE(t_practice_list_joined.c.ReviewDate).desc()
    )
    scheduled_rows_query_clipped = scheduled_rows_query_sorted.offset(skip).limit(limit)

    scheduled_rows: List[Row] = scheduled_rows_query_clipped.all()

    tune_type_column_index = find_dict_index(
        scheduled_rows_query_clipped.column_descriptions, "name", "Type"
    )
    scheduled_rows = sorted(scheduled_rows, key=lambda row: row[tune_type_column_index])

    aged_limit = limit - len(scheduled_rows)
    if aged_limit <= 0:
        aged_limit = 2
    aged_limit = 2

    practice_list_query2 = db.query(t_practice_list_joined).filter(
        and_(
            t_practice_list_joined.c.USER_REF == user_ref,
            t_practice_list_joined.c.PLAYLIST_REF == playlist_ref,
        )
    )

    aged_rows: List[Tune] = (
        practice_list_query2.order_by(
            func.DATE(t_practice_list_joined.c.Practiced).asc()
        )
        .offset(skip)
        .limit(aged_limit)
        .all()
    )
    rows = scheduled_rows + aged_rows

    # if print_table:
    #     print("\n--------")
    #     print(tabulate(rows, headers=t_practice_list_joined.columns.keys()))

    return rows


def get_practice_list_scheduled_dynamic_view_construction(
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
    (This version constructs a view via the get_practice_list_query function
    instead of the practice_list_joined view.)
    (Note: This version of the function is not used at this time.)

    Get all tunes scheduled between the acceptable_delinquency_window and review_sitdown_date, but limit number to the `limit` var.

    Args:
        db (Session): _description_
        skip (int, optional): _description_. Defaults to 0.
        limit (int, optional): _description_. Defaults to 10.
        print_table (bool, optional): _description_. Defaults to False.
        review_sitdown_date (_type_, optional): _description_. Defaults to datetime.today().
        acceptable_delinquency_window (int, optional): _description_. Defaults to 7 days.
        playlist_ref (int, optional): The playlist ID to filter on. Defaults to 1.
        user_ref (int, optional): The user ID to filter on. Defaults to 1.

    Returns:
        List[Tune]: tunes scheduled between the acceptable_delinquency_window and review_sitdown_date, but limit number to the `limit` var.
    """
    if review_sitdown_date is None:
        review_sitdown_date = datetime.today()
        print("review_sitdown_date is None, using today: ", review_sitdown_date)
    assert isinstance(review_sitdown_date, datetime)

    # This is really strange, but it seems to be necessary to add a
    # day to the review_sitdown_date to get this to agree with the
    # older code. I don't know why this is necessary.
    review_sitdown_date = review_sitdown_date + timedelta(days=1)

    practice_list_query = get_practice_list_query(db, playlist_ref, user_ref)

    practice_list_query_scheduled = practice_list_query.where(
        and_(
            PracticeRecord.ReviewDate
            > (review_sitdown_date - timedelta(acceptable_delinquency_window)),
            PracticeRecord.ReviewDate <= review_sitdown_date,
        )
    )
    scheduled_rows_query_sorted = practice_list_query_scheduled.order_by(
        func.DATE(PracticeRecord.ReviewDate).desc()
    )
    scheduled_rows_query_clipped = scheduled_rows_query_sorted.offset(skip).limit(limit)

    scheduled_rows: List[Row] = scheduled_rows_query_clipped.all()

    tune_type_column_index = find_dict_index(
        scheduled_rows_query_clipped.column_descriptions, "name", "TuneType"
    )
    scheduled_rows = sorted(scheduled_rows, key=lambda row: row[tune_type_column_index])

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
