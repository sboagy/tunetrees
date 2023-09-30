import logging
from typing import Annotated

import starlette.status as status
from fastapi import FastAPI, Form
from starlette.responses import HTMLResponse, RedirectResponse

from tunetrees.app.practice import render_practice_page
from tunetrees.app.schedule import submit_review, query_and_print_tune_by_id

from fastapi.middleware.cors import CORSMiddleware

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
    return {"message": f"Hello {name}"}


@app.get("/tunetrees/practice", response_class=HTMLResponse)
async def tunetrees():
    html_result = await render_practice_page()
    return html_result


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
