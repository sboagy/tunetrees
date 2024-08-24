import logging
from datetime import datetime
from os import environ
from typing import Annotated, Any, List

from fastapi import APIRouter, Form
from starlette import status as status
from starlette.responses import HTMLResponse, RedirectResponse

from tunetrees.api.mappers.tunes_mapper import tunes_mapper
from tunetrees.app.database import SessionLocal
from tunetrees.app.practice import render_practice_page
from tunetrees.app.queries import (
    get_practice_list_recently_played,
    get_practice_list_scheduled,
)
from tunetrees.app.schedule import query_and_print_tune_by_id, update_practice_record
from tunetrees.models.tunetrees import Tune

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
        tunes_scheduled = get_practice_list_scheduled(
            db, limit=10, user_ref=int(user_id), playlist_ref=int(playlist_ref)
        )
        tune_list = [tunes_mapper(tune) for tune in tunes_scheduled]
        return tune_list
    except Exception as e:
        return {"error": f"Unable to fetch scheduled practice list: {e}"}
    finally:
        if db is not None:
            db.close()


@router.get("/get_tunes_recently_played/{user_id}/{playlist_ref}")
async def get_recently_played(user_id: str, playlist_ref: str):
    db = None
    try:
        db = SessionLocal()
        tunes_recently_played: List[Tune] = get_practice_list_recently_played(
            db, limit=25, user_ref=int(user_id), playlist_ref=int(playlist_ref)
        )
        tune_list = []
        for tune in tunes_recently_played:
            tune_list.append(tunes_mapper(tune))
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

    update_practice_record(selected_tune, vote_type, playlist_id)

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

    update_practice_record(selected_tune, vote_type, playlist_id)

    query_and_print_tune_by_id(634)

    # I think this redirect is here in order to redirect to the practice page after
    # submitting feedback when the feedback was submitted via a form when using
    # the backend server directly. -sb
    #
    html_result = RedirectResponse("/practice", status_code=status.HTTP_302_FOUND)
    return html_result
