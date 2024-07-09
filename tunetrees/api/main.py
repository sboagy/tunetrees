import logging
from os import environ
from typing import Annotated, List

import starlette.status as status
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import HTMLResponse, RedirectResponse

from tunetrees.api.mappers.tunes_mapper import tunes_mapper
from tunetrees.app.database import SessionLocal
from tunetrees.app.practice import render_practice_page
from tunetrees.app.queries import (
    get_practice_list_recently_played,
    get_practice_list_scheduled,
)
from tunetrees.app.schedule import submit_review, query_and_print_tune_by_id
from tunetrees.models.tunetrees import Tune

from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/hello/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}! Welcome to TuneTrees!"}


tt_review_sitdown_date_str = environ.get("TT_REVIEW_SITDOWN_DATE", None)


@app.get("/tunetrees/practice", response_class=HTMLResponse)
async def tunetrees():

    tt_review_sitdown_date = (
        datetime.fromisoformat(tt_review_sitdown_date_str)
        if tt_review_sitdown_date_str
        else None
    )

    html_result = await render_practice_page(review_sitdown_date=tt_review_sitdown_date)
    return html_result


@app.get("/tunetrees/get_practice_list_scheduled")
async def get_scheduled():
    db = None
    try:
        db = SessionLocal()
        tunes_scheduled: List[Tune] = get_practice_list_scheduled(db, limit=10)
        tune_list = []
        for tune in tunes_scheduled:
            tune_list.append(tunes_mapper(tune))
        return tune_list
    except:
        return "Unable to fetch scheduled practice list."
    finally:
        db.close()


@app.get("/tunetrees/get_tunes_recently_played")
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
    except:
        return "Unable to fetch recently played tunes."
    finally:
        db.close()


@app.post("/tunetrees/practice/feedback")
async def feedback(
    selected_tune: Annotated[int, Form()], vote_type: Annotated[str, Form()]
):
    logger = logging.getLogger("tunetrees.api")
    logger.debug(f"{selected_tune=}, {vote_type=}")
    query_and_print_tune_by_id(634)

    submit_review(selected_tune, vote_type)

    query_and_print_tune_by_id(634)

    html_result = RedirectResponse(
        "/tunetrees/practice", status_code=status.HTTP_302_FOUND
    )
    return html_result
