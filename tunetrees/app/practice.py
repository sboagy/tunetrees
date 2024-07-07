from pathlib import Path
from typing import List

from jinja2 import Environment, FileSystemLoader

from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import (
    get_practice_list_recently_played,
    get_practice_list_scheduled,
)
from tunetrees.models.tunetrees import Tune


async def render_practice_page() -> str:
    db = None
    try:
        db = SessionLocal()
        tunes_scheduled: List[Tune] = get_practice_list_scheduled(db, limit=10)
        tunes_recently_played: List[Tune] = get_practice_list_recently_played(
            db, limit=25
        )
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
        if db is not None:
            db.close()
    return html_result
