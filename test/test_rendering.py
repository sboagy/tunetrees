from pathlib import Path
from typing import List

from jinja2 import Environment, FileSystemLoader

from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import get_tune_table
from tunetrees.models.tunetrees import Tune


def test_tunetrees_template():
    db = None
    try:
        db = SessionLocal()
        tunes_scheduled: List[Tune] = get_tune_table(db, limit=10)
        tunes_recently_played: List[Tune] = get_tune_table(db, skip=40, limit=10)
        tunetrees_package_top = Path(__file__).parent.parent.joinpath("tunetrees")
        assert tunetrees_package_top.exists()
        templates_folder = tunetrees_package_top.joinpath("templates")
        assert templates_folder.is_dir()
        assert templates_folder.joinpath("tunetrees.html.jinja2").exists()
        environment = Environment(loader=FileSystemLoader(templates_folder.absolute()))
        template = environment.get_template(name="tunetrees.html.jinja2")
        html_result = template.render(
            tunes_scheduled=tunes_scheduled, tunes_recently_played=tunes_recently_played
        )
        assert ">Alasdruim's March<" in html_result
        print(html_result)

    finally:
        if db is not None:
            db.close()
