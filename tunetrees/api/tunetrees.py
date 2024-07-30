import logging
from datetime import datetime
from os import environ
from typing import Annotated, List

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
from tunetrees.app.schedule import query_and_print_tune_by_id, submit_review
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


@router.get("/get_practice_list_scheduled")
async def get_scheduled():
    db = None
    try:
        db = SessionLocal()
        tunes_scheduled: List[Tune] = get_practice_list_scheduled(db, limit=10)
        tune_list = []
        for tune in tunes_scheduled:
            tune_list.append(tunes_mapper(tune))
        return tune_list
    except Exception as e:
        return {"error": f"Unable to fetch scheduled practice list: {e}"}
    finally:
        if db is not None:
            db.close()


@router.get("/get_tunes_recently_played")
async def get_recently_played():
    db = None
    try:
        db = SessionLocal()
        tunes_recently_played: List[Tune] = get_practice_list_recently_played(
            db, limit=25
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


@router.post("/practice/feedback")
async def feedback(
    selected_tune: Annotated[int, Form()], vote_type: Annotated[str, Form()]
):
    logger = logging.getLogger("tunetrees.api")
    logger.debug(f"{selected_tune=}, {vote_type=}")
    query_and_print_tune_by_id(634)

    submit_review(selected_tune, vote_type)

    query_and_print_tune_by_id(634)

    html_result = RedirectResponse("/practice", status_code=status.HTTP_302_FOUND)
    return html_result
