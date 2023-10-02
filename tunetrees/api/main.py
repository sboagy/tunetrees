import logging
from typing import Annotated, List

import starlette.status as status
from fastapi import FastAPI, Form
from starlette.responses import HTMLResponse, RedirectResponse
from fastapi.encoders import jsonable_encoder


from tunetrees.app.practice import render_practice_page
from tunetrees.app.queries import get_practice_list_scheduled
from tunetrees.app.schedule import submit_review, query_and_print_tune_by_id

from tunetrees.app.database import SessionLocal
from tunetrees.models.tunetrees import Tune

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
    return {"message": f"Hello {name}! Welcome to TuneTrees!"}


@app.get("/tunetrees/practice", response_class=HTMLResponse)
async def tunetrees():
    html_result = await render_practice_page()
    return html_result

@app.get("/tunetrees/get_practice_list_scheduled")
async def get_scheduled():
    db = None
    try:
        db = SessionLocal()
        tunes_scheduled: List[Tune] = get_practice_list_scheduled(db, limit=10)
        tune_list = []
        #TODO build mapper to handle this 
        for tune in tunes_scheduled:
            tune_each = {}
            tune_each["tune_id"]= tune[0]
            tune_each["tune_name"] = tune[1]
            tune_each["tune_type"] = tune[2]       
            tune_each["tune_key"] = tune[4]
            tune_each["tune_incipit"] = tune[5]
            tune_each["scheduled"] = tune[6]
            tune_each["last_practiced"] = tune[7]
            tune_each["notes_private"] = tune[14]
            tune_each["notes_public"] = tune[15]
            tune_each["tags"] = tune[16]
            tune_list.append(tune_each)
        print(tunes_scheduled[0])
        return tune_list
    except:
        return "Unable to fetch scheduled practice list."
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


