import pickle
import re
import sys
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

# import the Beautiful soup functions to parse the data returned from the website
from bs4 import BeautifulSoup

SETS_RESULTS_TXT = "sets_results.txt"

FOIN_SESSION_TXT = "foin_session.txt"

SET_OVERRIDES_TXT = "set_overrides.txt"

DATA_DIR_NAME = "data"

PLAYLIST_TXT = "playlist.txt"

DATA_SETS_RESULTS_HTML = "sets_results.html"

TUNE_LIST_PICKLE_FILE_NAME = "tune_list_sets.pkl"

sys.setrecursionlimit(10000)

MAX_TUNES_IN_SET = 3


@dataclass
class TuneInSetSpec:
    """Class for keeping track of an item in inventory."""

    tune_id: str
    tune_name: str
    from_album: Optional[str] = None


@dataclass
class TuneGoesIntoSpec:
    tune_id: str
    tune_name: str
    follows: List[TuneInSetSpec]
    goes_into: List[TuneInSetSpec]


@dataclass
class TuneFollowsGoesIntoSpec(TuneGoesIntoSpec):
    pass


@dataclass
class TuneFollowsGoesIntoSpecAnalysis(TuneGoesIntoSpec):
    pass


@dataclass
class TuneSet:
    """Class for keeping track of an item in inventory."""

    tune_list: List[TuneInSetSpec]
    locked: bool
    from_album: Optional[str] = None


regex = r"#(?P<tune_id>\d+)\[(?P<tune_name>[A-z0-9 \']+).*\]"


class FollowsOrGoesInto(Enum):
    FOLLOWS = 1
    GOES_INTO = 2


def extract_tunes_from_set_table(soup, table_id: str) -> List[TuneInSetSpec]:
    follows_list: List[TuneInSetSpec] = []

    follows = soup.find_all("table", id=table_id)

    for follow_table in follows:
        rows = follow_table.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) > 0:
                tune_anchors = cells[0].find_all("a")
                tune_anchors_len = len(tune_anchors)
                if tune_anchors_len >= 1:
                    href: Optional[str]
                    if tune_anchors_len == 1:
                        title = tune_anchors[0].string
                        href = tune_anchors[0].get("href")
                    else:  # zero
                        title = tune_anchors[1].string
                        href = tune_anchors[1].get("href")
                    from_album = cells[1].string
                    if href is not None:
                        _, _, tune_id, _ = href.split("/")
                        record = TuneInSetSpec(
                            tune_id=tune_id, tune_name=title, from_album=from_album
                        )
                        follows_list.append(record)
                else:
                    print("ERROR! Did not find anchor cell!")
                    print(row.prettify())
                    sys.exit(-1)

    return follows_list


def process_set_link_list(  # sourcery skip: low-code-quality
    tune_analysis: TuneFollowsGoesIntoSpecAnalysis,
    tune_dict: Dict[str, TuneFollowsGoesIntoSpecAnalysis],
    set_list: List[Optional[TuneSet]],
    set_id_top: int,
    siblings: List[TuneInSetSpec],
    which: FollowsOrGoesInto,
    match_albums: bool = True,
):
    for sibling in siblings:
        if sibling.tune_id in tune_dict:
            for tunes_set in set_list:
                if tunes_set is None:
                    continue
                if tunes_set.locked:
                    continue

                # Constrain sets to be from same album
                if (
                    match_albums
                    and tunes_set.from_album is not None
                    and tunes_set.from_album != sibling.from_album
                ):
                    continue

                tune_list = tunes_set.tune_list
                if len(tune_list) < MAX_TUNES_IN_SET:
                    next_sibling_set_rec = (
                        tune_list[len(tune_list) - 1]
                        if which == FollowsOrGoesInto.FOLLOWS
                        else tune_list[0]
                    )
                    if next_sibling_set_rec.tune_id == sibling.tune_id:
                        tune_record = TuneInSetSpec(
                            tune_id=tune_analysis.tune_id,
                            tune_name=tune_analysis.tune_name,
                            from_album=sibling.from_album,
                        )
                        if len(tune_list) == 1:
                            tune_list[0].from_album = sibling.from_album
                        if which == FollowsOrGoesInto.FOLLOWS:
                            tune_list.append(tune_record)
                        else:
                            tune_list.insert(0, tune_record)

                        if tunes_set.from_album is None:
                            tunes_set.from_album = sibling.from_album

                        # print("moved to be a follow tune: %d to %d, len is now %d" % (
                        #     set_id_top, set_id2, len(set_list[set_id2])))
                        set_list[set_id_top] = None
                        break
        if set_list[set_id_top] is None:
            # Then we've already processed it
            break


def find_index_for_single_tune_in_set_list(set_list: List[TuneSet], tune_id: str):
    return next(
        (
            set_id
            for set_id, tunes_set in enumerate(set_list)
            if tunes_set is not None and tunes_set.tune_list[0].tune_id == tune_id
        ),
        -1,
    )


def process_goes_into(
    set_list: List[Optional[TuneSet]],
    prev_id: str,
    goes_into_id: str,
    goes_into_name: str,
    goes_into_album: str,
):
    for tunes_set in set_list:
        if tunes_set is None:
            continue
        tune_list = tunes_set.tune_list
        if len(tune_list) < MAX_TUNES_IN_SET:
            next_sibling_set_rec = tune_list[len(tune_list) - 1]

            if next_sibling_set_rec.tune_id == prev_id:
                tune_record = TuneInSetSpec(
                    tune_id=goes_into_id,
                    tune_name=goes_into_name,
                    from_album=goes_into_album,
                )
                if len(tune_list) == 1:
                    tunes_set.locked = True
                    tunes_set.from_album = goes_into_album
                    tune_list[0].from_album = goes_into_album

                tune_list.append(tune_record)

                # print("moved to be a follow tune: %d to %d, len is now %d" % (
                #     set_id_top, set_id2, len(set_list[set_id2])))
                set_id_top = find_index_for_single_tune_in_set_list(
                    set_list, goes_into_id
                )
                if not set_list[set_id_top].locked:
                    set_list[set_id_top] = None
                break


def clean_nulls_from_list(items):
    return [e for e in items if e is not None]


def main():
    tune_list: List[TuneFollowsGoesIntoSpec] = []
    tune_dict: Dict[str, TuneFollowsGoesIntoSpecAnalysis] = {}

    data_dir = Path(__file__).parent.parent.joinpath(DATA_DIR_NAME)
    assert data_dir.exists()
    assert data_dir.is_dir()

    tune_list_sets_pkl = data_dir.joinpath(TUNE_LIST_PICKLE_FILE_NAME)

    if tune_list_sets_pkl.exists() and tune_list_sets_pkl.is_file():
        with open(tune_list_sets_pkl, "rb") as f:
            tune_list = pickle.load(f)
    else:
        last_throttle_time = time.time()
        playlist_txt = data_dir.joinpath(PLAYLIST_TXT)
        assert playlist_txt.exists()
        with open(playlist_txt) as f:
            for line in f:
                duration_since_last_throttle = time.time() - last_throttle_time
                # print("duration_since_last_throttle: %f" % duration_since_last_throttle)
                if duration_since_last_throttle > 2.0:
                    print("resting...", flush=True)
                    time.sleep(1.0)
                    last_throttle_time = time.time()

                line = line.strip()
                rhythm, title, structure, key, first_2_bars, tags, tune_id = line.split(
                    "\t"
                )

                page_url = "https://www.irishtune.info/tune/%s/" % tune_id

                print(page_url)

                req = Request(page_url, headers={"User-Agent": "Mozilla/5.0"})

                for x in range(4):
                    try:
                        web_byte = urlopen(req).read()
                        break
                    except URLError as e:
                        print("URLError = " + str(e.reason), flush=True)
                        time.sleep(2.0)

                page = web_byte.decode("utf-8")

                soup = BeautifulSoup(page, features="html.parser")

                follows_list: List[TuneInSetSpec] = extract_tunes_from_set_table(
                    soup, "follows"
                )
                goes_into_list: List[TuneInSetSpec] = extract_tunes_from_set_table(
                    soup, "goesInto"
                )

                tune_record = TuneFollowsGoesIntoSpec(
                    tune_id=tune_id,
                    tune_name=title,
                    follows=follows_list,
                    goes_into=goes_into_list,
                )
                tune_list.append(tune_record)

    with open(tune_list_sets_pkl, "wb") as f:
        pickle.dump(tune_list, f)

    for tune_rec in tune_list:
        tune_dict[tune_rec.tune_id] = TuneFollowsGoesIntoSpecAnalysis(
            tune_id=tune_rec.tune_id,
            tune_name=tune_rec.tune_name,
            follows=tune_rec.follows,
            goes_into=tune_rec.goes_into,
        )

    print_before_after_tunes(tune_list, tune_dict, False)

    set_list: List[TuneSet] = []

    print("=== set attempt ===")
    for key in tune_dict:
        tune_analysis = tune_dict[key]
        set_list.append(
            TuneSet(
                tune_list=[
                    TuneInSetSpec(
                        tune_id=tune_analysis.tune_id,
                        tune_name=tune_analysis.tune_name,
                        from_album=None,
                    )
                ],
                locked=False,
                from_album=None,
            )
        )

    set_overrides_path = data_dir.joinpath(SET_OVERRIDES_TXT)
    with open(set_overrides_path) as f:
        for line in f:
            line = line.strip()
            tunes = line.split("/")
            prev_id = None
            for tune in tunes:
                matches = re.match(regex, tune)
                tune_id = matches.group("tune_id")
                tune_name = matches.group("tune_name")
                # print("---> %s %s" % (tune_id, tune_name))

                if prev_id is not None:
                    process_goes_into(set_list, prev_id, tune_id, tune_name, "me")

                prev_id = tune_id

    foin_session_path = data_dir.joinpath(FOIN_SESSION_TXT)
    with open(foin_session_path) as f:
        for line in f:
            line = line.strip()
            tunes = line.split("/")
            prev_id = None
            for tune in tunes:
                matches = re.match(regex, tune)
                tune_id = matches.group("tune_id")
                tune_name = matches.group("tune_name")
                # print("---> %s %s" % (tune_id, tune_name))

                if prev_id is not None:
                    process_goes_into(set_list, prev_id, tune_id, tune_name, "fs")

                prev_id = tune_id

    match_albums = True
    for x in range(20):
        changes_made = 0
        for set_id_top, tune_set in enumerate(set_list):
            if tune_set is None:
                continue
            tune_list: List[TuneInSetSpec] = tune_set.tune_list
            if len(tune_list) == 1:
                tune_analysis = tune_dict[tune_list[0].tune_id]

                process_set_link_list(
                    tune_analysis,
                    tune_dict,
                    set_list,
                    set_id_top,
                    tune_analysis.follows,
                    FollowsOrGoesInto.FOLLOWS,
                    match_albums=match_albums,
                )

                if set_list[set_id_top] is None:
                    # Then we've already processed it, continue to next tune
                    changes_made += 1
                    continue

                process_set_link_list(
                    tune_analysis,
                    tune_dict,
                    set_list,
                    set_id_top,
                    tune_analysis.goes_into,
                    FollowsOrGoesInto.GOES_INTO,
                    match_albums=match_albums,
                )

                if set_list[set_id_top] is None:
                    # Then we've already processed it, continue to next tune
                    changes_made += 1

        set_list = clean_nulls_from_list(set_list)

        if changes_made == 0:
            if match_albums:
                match_albums = False
                print("Trying with match_albums set to false: %d" % x)
            else:
                print("Giving up trying to assemble sets: %d" % x)
                break

    print("=== print set ===")

    sets_results_path = data_dir.joinpath(SETS_RESULTS_TXT)
    with open(sets_results_path, "w") as f:
        for tune_set in set_list:
            sequence_id = 0
            tune_list: List[TuneInSetSpec] = tune_set.tune_list
            for tune_spec in tune_list:
                print(
                    "#%s[%s, %s]"
                    % (tune_spec.tune_id, tune_spec.tune_name, tune_spec.from_album),
                    end="",
                )
                f.write(
                    "#%s[%s, %s]"
                    % (tune_spec.tune_id, tune_spec.tune_name, tune_spec.from_album)
                )
                sequence_id += 1
                if sequence_id < len(tune_list):
                    print("/", end="")
                    f.write("/")
                else:
                    print("")
                    f.write("\n")
                    # print(" from_album: %s" % tune_set.from_album)
                    # f.write(" from_album: %s\n" % tune_set.from_album)

    sets_results_html_path = data_dir.joinpath(DATA_SETS_RESULTS_HTML)
    with open(sets_results_html_path, "w") as f:
        f.write("<html>\n")
        for tune_set in set_list:
            sequence_id = 0
            tune_list: List[TuneInSetSpec] = tune_set.tune_list
            f.write("<p>")
            for tune_spec in tune_list:
                # print("#%s[%s, %s]" % (tune_spec.tune_id, tune_spec.tune_name, tune_spec.from_album), end='')
                if tune_spec.from_album is None:
                    f.write(
                        '<a href="https://www.irishtune.info/tune/%s/">%s</a>'
                        % (tune_spec.tune_id, tune_spec.tune_name)
                    )
                else:
                    f.write(
                        '<a href="https://www.irishtune.info/tune/%s/">%s (%s)</a>'
                        % (tune_spec.tune_id, tune_spec.tune_name, tune_spec.from_album)
                    )

                sequence_id += 1
                if sequence_id < len(tune_list):
                    f.write("/")
                # else:
                #    print(" from_album: %s" % tune_set.from_album)
            f.write("</p>\n")
        f.write("</html>\n")


def print_before_after_tunes(
    tune_list: List[TuneFollowsGoesIntoSpec], tune_dict: Dict, print_it: bool
) -> None:
    if not print_it:
        return

    for tune_rec in tune_list:
        print(f"{tune_rec.tune_id}: {tune_rec.tune_name}")

        print("    This tune follows:")
        for prev_tune in tune_rec.follows:
            if prev_tune.tune_id in tune_dict:
                print(
                    f"        id: {prev_tune.tune_id}, name: {prev_tune.tune_name}, from_album: {prev_tune.from_album}"
                )

        print("    This tune goes into:")
        for goes_into_tune in tune_rec.goes_into:
            if goes_into_tune.tune_id in tune_dict:
                print(
                    f"        id: {goes_into_tune.tune_id}, name: {goes_into_tune.tune_name}, from_album: {goes_into_tune.from_album}"
                )


if __name__ == "__main__":
    main()
