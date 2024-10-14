import logging
from datetime import datetime
from os import environ
from typing import Annotated, Any, Dict, List, Optional

from fastapi import APIRouter, Form, HTTPException
from starlette import status as status
from starlette.responses import HTMLResponse, RedirectResponse

from tunetrees.api.mappers.tunes_mapper import tunes_mapper
from tunetrees.app.database import SessionLocal
from tunetrees.app.practice import render_practice_page
from tunetrees.app.queries import (
    query_practice_list_recently_played,
    query_practice_list_scheduled,
    query_tune_staged,
)
from tunetrees.app.schedule import (
    TuneScheduleUpdate,
    TuneFeedbackUpdate,
    query_and_print_tune_by_id,
    update_practice_record,
    update_practice_feedbacks,
    update_practice_schedules,
)
from tunetrees.models.tunetrees import (
    Tune,
    t_practice_list_staged,
    t_practice_list_joined,
)
from pydantic import BaseModel

router = APIRouter(
    prefix="/tunetrees",
    tags=["tunetrees"],
)

tt_review_sitdown_date_str = environ.get("TT_REVIEW_SITDOWN_DATE", None)


@router.get("/practice", response_class=HTMLResponse)
async def practice_page():
    tt_review_sitdown_date = (
        datetime.fromisoformat(tt_review_sitdown_date_str)
        if tt_review_sitdown_date_str
        else None
    )

    html_result = await render_practice_page(review_sitdown_date=tt_review_sitdown_date)
    return html_result


@router.get("/get_practice_list_scheduled/{user_id}/{playlist_ref}")
async def get_scheduled(
    user_id: str, playlist_ref: str
) -> List[dict[str, Any]] | dict[str, str]:
    db = None
    try:
        db = SessionLocal()
        tunes_scheduled = query_practice_list_scheduled(
            db, limit=10, user_ref=int(user_id), playlist_ref=int(playlist_ref)
        )
        tune_list = [
            tunes_mapper(tune, t_practice_list_staged) for tune in tunes_scheduled
        ]
        return tune_list
    except Exception as e:
        logger = logging.getLogger("tunetrees.api")
        logger.error(f"Unable to fetch scheduled practice list: {e}")
        return {"error": f"Unable to fetch scheduled practice list: {e}"}
    finally:
        if db is not None:
            db.close()


@router.get("/get_tunes_recently_played/{user_id}/{playlist_ref}")
async def get_recently_played(
    user_id: str, playlist_ref: str
) -> List[dict[str, Any]] | dict[str, str]:
    db = None
    try:
        db = SessionLocal()
        tunes_recently_played: List[Tune] = query_practice_list_recently_played(
            db, user_ref=int(user_id), playlist_ref=int(playlist_ref)
        )
        tune_list = []
        for tune in tunes_recently_played:
            tune_list.append(tunes_mapper(tune, t_practice_list_staged))
        return tune_list
    except Exception as e:
        return {"error": f"Unable to fetch recently played tunes: {e}"}
    finally:
        if db is not None:
            db.close()


@router.get("/get_tune_staged/{user_id}/{playlist_ref}/{tune_id}")
async def get_tune_staged(
    user_id: str, playlist_ref: str, tune_id: str
) -> List[dict[str, Any]] | dict[str, str]:
    db = None
    try:
        db = SessionLocal()
        tunes_recently_played: List[Tune] = query_tune_staged(
            db,
            user_ref=int(user_id),
            playlist_ref=int(playlist_ref),
            tune_id=int(tune_id),
        )
        tune_list = []
        for tune in tunes_recently_played:
            tune_list.append(tunes_mapper(tune, t_practice_list_staged))
        return tune_list
    except Exception as e:
        return {"error": f"Unable to fetch recently played tunes: {e}"}
    finally:
        if db is not None:
            db.close()


@router.post("/practice/submit_feedback")
async def submit_feedback(
    selected_tune: Annotated[int, Form()],
    vote_type: Annotated[str, Form()],
    user_id: Annotated[str, Form()],
    playlist_id: Annotated[str, Form()],
):
    assert user_id
    logger = logging.getLogger("tunetrees.api")
    logger.debug(f"{selected_tune=}, {vote_type=}")
    # query_and_print_tune_by_id(634)

    update_practice_record(f"{selected_tune}", vote_type, playlist_id)

    return status.HTTP_302_FOUND


@router.post("/practice/submit_schedules/{playlist_id}")
async def submit_schedules(
    playlist_id: str,
    tune_updates: Dict[str, TuneScheduleUpdate],
):
    logger = logging.getLogger("tunetrees.api")
    logger.debug(f"{tune_updates=}")

    update_practice_schedules(tune_updates, playlist_id)

    return status.HTTP_302_FOUND


@router.post("/practice/submit_feedbacks/{playlist_id}")
async def submit_feedbacks(
    playlist_id: str,
    tune_updates: Dict[str, TuneFeedbackUpdate],
):
    logger = logging.getLogger("tunetrees.api")
    logger.debug(f"{tune_updates=}")

    update_practice_feedbacks(tune_updates, playlist_id)

    return status.HTTP_302_FOUND


@router.post("/practice/feedback")
async def feedback(
    selected_tune: Annotated[int, Form()],
    vote_type: Annotated[str, Form()],
    user_id: Annotated[str, Form()],
    playlist_id: Annotated[str, Form()],
):
    """Submit feedback for a tune for the direct use of the backend server.
    If successful, redirect to the practice page.
    """
    assert user_id
    logger = logging.getLogger("tunetrees.api")
    logger.debug(f"{selected_tune=}, {vote_type=}")
    query_and_print_tune_by_id(634)

    update_practice_record(f"{selected_tune}", vote_type, playlist_id)

    query_and_print_tune_by_id(634)

    # I think this redirect is here in order to redirect to the practice page after
    # submitting feedback when the feedback was submitted via a form when using
    # the backend server directly. -sb
    #
    html_result = RedirectResponse("/practice", status_code=status.HTTP_302_FOUND)
    return html_result


class PlaylistTune(BaseModel):
    ID: Optional[int]
    Title: Optional[str]
    Type: Optional[str]
    Structure: Optional[str]
    Mode: Optional[str]
    Incipit: Optional[str]
    Learned: Optional[str]
    Practiced: Optional[str]
    Quality: Optional[int]
    Easiness: Optional[float]
    Interval: Optional[int]
    Repetitions: Optional[int]
    ReviewDate: Optional[str]
    BackupPracticed: Optional[str]
    NotePrivate: Optional[str]
    NotePublic: Optional[str]
    Tags: Optional[str]
    USER_REF: Optional[int]
    PLAYLIST_REF: Optional[int]

    class Config:
        orm_mode = True


@router.put("/playlist-tune/{user_id}/{playlist_ref}/{tune_id}", response_model=dict)
async def update_playlist_tune(
    user_id: int, playlist_ref: int, tune_id: int, tune_update: PlaylistTune
):
    """
    Directly update a tune in the database.

    Args:
        user_id (int): Unique user ID.
        playlist_ref (int): Unique playlist ID.
        tune_id (int): Unique tune ID.
        tune_update (PlaylistTune): The fields to update (all optional).

    Note:
        At some point, access control for the tune table field updates may be needed,
        since the core tune data may be shared across users.

    Returns:
        dict: A dictionary containing either a success message or an error message.
            Example:
                {"success": "Tune updated successfully"}
                {"detail": "No tune found to update"}
                {"detail": "Unable to update tune: <error_message>"}
    """
    logger = logging.getLogger("tunetrees.api")
    try:
        with SessionLocal() as db:
            stmt = (
                t_practice_list_joined.update()
                .where(
                    t_practice_list_joined.c.USER_REF == user_id,
                    t_practice_list_joined.c.PLAYLIST_REF == playlist_ref,
                    t_practice_list_joined.c.ID == tune_id,
                )
                .values(**tune_update.model_dump(exclude_unset=True))
            )
            result = db.execute(stmt)
            db.commit()
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="No tune found to update")
            return {"success": "Tune updated successfully"}
    except Exception as e:
        logger.error(f"Unable to update tune ({tune_id}): {e}")
        raise HTTPException(status_code=500, detail=f"Unable to update tune: {e}")


@router.post("/playlist-tune/{user_id}/{playlist_ref}", response_model=dict)
async def create_playlist_tune(user_id: int, playlist_ref: int, tune: PlaylistTune):
    """
    Create a new tune in the database.

    Args:
        user_id (int): Unique user ID.
        playlist_ref (int): Unique playlist ID.
        tune (PlaylistTune): The tune data to create.

    Returns:
        dict: A dictionary containing either a success message or an error message.
            Example:
                {"success": "Tune created successfully"}
                {"detail": "Unable to create tune: <error_message>"}
    """
    logger = logging.getLogger("tunetrees.api")
    try:
        with SessionLocal() as db:
            stmt = t_practice_list_joined.insert().values(
                USER_REF=user_id,
                PLAYLIST_REF=playlist_ref,
                **tune.model_dump(exclude_unset=True),
            )
            db.execute(stmt)
            db.commit()
            return {"success": "Tune created successfully"}
    except Exception as e:
        logger.error(f"Unable to create tune: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to create tune: {e}")


@router.delete("/playlist-tune/{user_id}/{playlist_ref}/{tune_id}", response_model=dict)
async def delete_playlist_tune(user_id: int, playlist_ref: int, tune_id: int):
    """
    Delete a tune from the database.

    Args:
        user_id (int): Unique user ID.
        playlist_ref (int): Unique playlist ID.
        tune_id (int): Unique tune ID.

    Returns:
        dict: A dictionary containing either a success message or an error message.
            Example:
                {"success": "Tune deleted successfully"}
                {"detail": "No tune found to delete"}
                {"detail": "Unable to delete tune: <error_message>"}
    """
    logger = logging.getLogger("tunetrees.api")
    try:
        with SessionLocal() as db:
            stmt = t_practice_list_joined.delete().where(
                t_practice_list_joined.c.USER_REF == user_id,
                t_practice_list_joined.c.PLAYLIST_REF == playlist_ref,
                t_practice_list_joined.c.ID == tune_id,
            )
            result = db.execute(stmt)
            db.commit()
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="No tune found to delete")
            return {"success": f"Tune {tune_id} deleted successfully"}
    except Exception as e:
        logger.error(f"Unable to delete tune ({tune_id}): {e}")
        raise HTTPException(status_code=500, detail=f"Unable to delete tune: {e}")


@router.get(
    "/playlist-tune/{user_id}/{playlist_ref}/{tune_id}", response_model=PlaylistTune
)
async def get_playlist_tune(user_id: int, playlist_ref: int, tune_id: int):
    """
    Retrieve a tune from the database.

    Args:
        user_id (int): Unique user ID.
        playlist_ref (int): Unique playlist ID.
        tune_id (int): Unique tune ID.

    Returns:
        PlaylistTune | dict[str, str]: The retrieved tune data or an error message.
            Example:
                PlaylistTune object
                {"detail": "Tune not found"}
                {"detail": "Unable to fetch tune: <error_message>"}
    """
    logger = logging.getLogger("tunetrees.api")
    try:
        with SessionLocal() as db:
            stmt = t_practice_list_joined.select().where(
                t_practice_list_joined.c.USER_REF == user_id,
                t_practice_list_joined.c.PLAYLIST_REF == playlist_ref,
                t_practice_list_joined.c.ID == tune_id,
            )
            result = db.execute(stmt).fetchone()
            if result is None:
                raise HTTPException(
                    status_code=404, detail=f"Tune not found: ({tune_id})"
                )
            result_dict = result._mapping
            return PlaylistTune(**result_dict)
    except Exception as e:
        logger.error(f"Unable to fetch tune ({tune_id}): {e}")
        raise HTTPException(status_code=500, detail=f"Unable to fetch tune: {e}")
