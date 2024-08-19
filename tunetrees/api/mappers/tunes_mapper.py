from typing import Any

from sqlalchemy.engine.row import Row

from tunetrees.models.practice_list_joined import (
    practice_list_columns,
)


def tunes_mapper(tune: Row[Any]) -> dict[str, Any]:
    tune_dict = {}
    tune_dict["id"] = tune[practice_list_columns["TuneID"]]
    tune_dict["title"] = tune[practice_list_columns["TuneTitle"]]
    tune_dict["type"] = tune[practice_list_columns["TuneType"]]
    tune_dict["structure"] = tune[practice_list_columns["TuneStructure"]]
    tune_dict["mode"] = tune[practice_list_columns["TuneMode"]]
    tune_dict["incipit"] = tune[practice_list_columns["TuneIncipit"]]
    tune_dict["learned"] = tune[practice_list_columns["PlaylistLearned"]]
    tune_dict["practiced"] = tune[practice_list_columns["PracticeDate"]]
    tune_dict["quality"] = tune[practice_list_columns["PracticeQuality"]]
    tune_dict["easiness"] = tune[practice_list_columns["PracticeEasiness"]]
    tune_dict["interval"] = tune[practice_list_columns["PracticeInterval"]]
    tune_dict["repetitions"] = tune[practice_list_columns["PracticeRepetitions"]]
    tune_dict["review_date"] = tune[practice_list_columns["PracticeReviewDate"]]
    tune_dict["backup_practiced"] = tune[
        practice_list_columns["PracticeBackupPracticed"]
    ]
    tune_dict["notes_private"] = tune[practice_list_columns["AnnotationNotePrivate"]]
    tune_dict["notes_public"] = tune[practice_list_columns["AnnotationNotePublic"]]
    tune_dict["tags"] = tune[practice_list_columns["AnnotationTags"]]
    return tune_dict
