from pathlib import Path
from typing import List, Annotated

from fastapi import FastAPI, Form
from jinja2 import Environment, FileSystemLoader
from starlette.responses import HTMLResponse

from tunetrees.app.database import SessionLocal
from tunetrees.models.query import get_tune_table
from tunetrees.models.tunetrees import Tune

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/hello/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}


@app.get("/tunetrees/practice", response_class=HTMLResponse)
async def tunetrees():
    db = None
    try:
        db = SessionLocal()
        tunes_scheduled: List[Tune] = get_tune_table(db, limit=10)
        tunes_recently_played: List[Tune] = get_tune_table(db, skip=40, limit=10)
        tunetrees_package_top = Path(__file__).parent.parent
        assert tunetrees_package_top.exists()
        templates_folder = tunetrees_package_top.joinpath("templates")
        assert templates_folder.is_dir()
        assert templates_folder.joinpath("tunetrees.html.jinja2").exists()
        environment = Environment(loader=FileSystemLoader(templates_folder.absolute()))
        template = environment.get_template(name="tunetrees.html.jinja2")
        html_result = template.render(
            tunes_scheduled=tunes_scheduled, tunes_recently_played=tunes_recently_played
        )
    finally:
        db.close()

    return html_result


@app.post("/tunetrees/practice/feedback")
async def login(
    selected_tune: Annotated[int, Form()], vote_type: Annotated[str, Form()]
):
    result = {"selected_tune": selected_tune, "vote_type": vote_type}
    return result