import json
from dataclasses import dataclass
from http.client import HTTPResponse
from os import environ
from pathlib import Path
from time import sleep
from typing import List, TypedDict
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def login_irishtune_info(
    data_dir: Path, page_url: str, username: str, password: str
) -> str:
    form_data = {
        "username": username,
        "password": password,
        "B1": "Submit",
        "jtest": "t",
        "IE8": "false",
        "from": "/my/",
    }
    form_data_encoded = urlencode(form_data).encode()
    # req = Request(page_url, headers={"User-Agent": "Mozilla/5.0"})
    req = Request(
        page_url,
        method="POST",
        headers=get_headers(),
    )
    web_byte = None
    for _ in range(4):
        try:
            http_response: HTTPResponse = urlopen(req, data=form_data_encoded)
            status = http_response.status
            print(f"{status}")
            web_byte = http_response.read()
            break
        except URLError as e:
            print(f"URLError = {str(e.reason)}", flush=True)
            sleep(2.0)
    if web_byte is None:
        print("Could not get page bytes")
        exit(-1)
    page = web_byte.decode("utf-8")
    login_output_file = data_dir.joinpath("output_login.html")
    with open(login_output_file, "w") as f:
        f.write(page)

    return page


def fetch_irishtune_info_playlist(data_dir: Path) -> str:
    form_data = {
        "action": "listall",
        "_": 1686614383963,
    }
    form_data_encoded = urlencode(form_data)
    page_url = f"https://www.irishtune.info/my/ctrlPlaylist.php?{form_data_encoded}"
    req = Request(
        page_url,
        headers=get_headers(),
    )
    web_byte = None
    for _ in range(4):
        try:
            http_response: HTTPResponse = urlopen(req)
            status = http_response.status
            print(f"{status}")
            while True:
                msg = http_response.readline()
                print(f"{msg}")
                if msg.startswith(b'{"status":') or msg == b"":
                    break
            if msg == b"":
                print("Can't discover JSON response")
                exit(-1)
            web_byte = msg
            break
        except URLError as e:
            print(f"URLError = {str(e.reason)}", flush=True)
            sleep(2.0)
    if web_byte is None:
        print("Could not get page bytes")
        exit(-1)
    page = web_byte.decode("utf-8")
    # page = page[page.find("{") :]
    try:
        check_loading = json.loads(page)
        assert check_loading["status"] == "OK"
    except json.JSONDecodeError as e:
        print(f"JSONDecodeError: {e}")
        exit(-1)

    login_output_file = data_dir.joinpath("output_playlist.json")
    with open(login_output_file, "w") as f:
        f.write(page)

    return page


def get_headers():
    return {
        "User-Agent": "Mozilla/5.0",
        # "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/113.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        # "Accept": "text/html",
        # "Accept-Language": "en-US,en;q=0.5",
        # "Accept-Encoding": "gzip, deflate, br",
        # "Content-Type": "application/x-www-form-urlencoded",
        # "Content-Length": "73",
        # "Origin": "https://www.irishtune.info",
        "Connection": "keep-alive",
        # "Referer": "https://www.irishtune.info/my/login.php",
        "Cookie": "MyIrishTuneInfo=b2dcbda34d41f29b2967f917e89fd77b",  # noqa
        # "Upgrade-Insecure-Requests": "1",
        # "Sec-Fetch-Dest": "document",
        # "Sec-Fetch-Mode": "navigate",
        # "Sec-Fetch-Site": "same-origin",
        # "Sec-Fetch-User": "?1",
    }


@dataclass
class IrishTuneInfoPlaylistRow:
    id: str
    type: str
    structure: str
    title: str
    mode: str
    incipit: str
    current: str
    learned: str
    practiced: str
    note_private: str
    note_public: str
    tags: str


class IrishTuneInfoPlaylistRowDict(TypedDict):
    id: str
    type: str
    structure: str
    title: str
    mode: str
    incipit: str
    current: str
    learned: str
    practiced: str
    note_private: str
    note_public: str
    tags: str


class IrishTuneInfoPlaylistDict(TypedDict):
    status: str
    data: List[IrishTuneInfoPlaylistRowDict]


def main():
    page_url = "https://www.irishtune.info/my/login2.php"
    data_dir = Path(__file__).parent.parent.parent.joinpath("iti_import_output")
    if not data_dir.exists():
        data_dir.mkdir()

    print(page_url)

    irishtuneinfo_username = environ.get("IRISHTUNEINFO_USERNAME_TT")
    irishtuneinfo_password = environ.get("IRISHTUNEINFO_PASSWORD_TT")

    if not irishtuneinfo_username or not irishtuneinfo_password:
        print("Please set IRISHTUNEINFO_USERNAME_ME and IRISHTUNEINFO_PASSWORD_ME")
        exit(-1)

    page = login_irishtune_info(
        data_dir,
        page_url,
        username=irishtuneinfo_username,
        password=irishtuneinfo_password,
    )

    assert page

    page: str = fetch_irishtune_info_playlist(data_dir)
    dump_obj: IrishTuneInfoPlaylistDict = json.loads(page)
    tunes_dict = dump_obj["data"]
    tunes_columns = [
        "ID",
        "Type",
        "Structure",
        "Title",
        "Mode",
        "Incipit",
        "Current",
        "Learned",
        "Practiced",
        "NotePrivate",
        "NotePublic",
        "Tags",
    ]
    # tunes_user_notes_columns = [
    #     "id",  # TUNE_REF
    #     # Add also user id column
    #     "note_private",
    #     "note_public",
    #     "tags",
    # ]
    # tunes_practice_record_columns = [
    #     "playlist_ref",  #
    #     "id",  # TUNE_REF (redundant, but will keep for now)
    #     # Add also user id column
    #     "practiced",
    #     "feedback",
    # ]
    # playlist_tunes_columns = [
    #     "playlist_ref",  # Joins
    #     "id",  # TUNE_REF
    #     "current",
    #     "learned",
    # ]
    tunes_dump_cvs = data_dir.joinpath("dump_tunes.cvs")
    # tune_user_notes_dump_cvs = data_dir.joinpath("dump_tune_user_notes.cvs")
    # practice_record_dump_cvs = data_dir.joinpath("dump_practice_records.cvs")
    # playlist_tunes_columns_cvs = data_dir.joinpath("dump_playlist_tunes.cvs")
    tables = {
        tunes_dump_cvs: tunes_columns,
        # tune_user_notes_dump_cvs: tunes_user_notes_columns,
        # practice_record_dump_cvs: tunes_practice_record_columns,
        # playlist_tunes_columns_cvs: playlist_tunes_columns,
    }
    for table_dump_cvs_path, columns in tables.items():
        with open(table_dump_cvs_path, "w") as f:
            f.write(", ".join(columns))
            f.write("\n")

    trans = str.maketrans(",\r\n", ";  ")

    for tune_dict in tunes_dict:
        # tune_row = IrishTuneInfoPlaylistRow(*tune_dict)
        for table_dump_cvs_path, columns in tables.items():
            with open(table_dump_cvs_path, "a") as f:
                utd = tune_dict  # untyped tune dict
                row_data: List[str] = [
                    (utd.get(k) or "").translate(trans) for k in columns
                ]
                f.write(", ".join(row_data))
                f.write("\n")

    # soup = BeautifulSoup(page, features="html.parser")
    #
    # print(soup)


if __name__ == "__main__":
    main()
