from typing import Any

from sqlalchemy import Table
from sqlalchemy.engine.row import Row


def tunes_mapper(tune: Row[Any], table: Table) -> dict[str, Any]:
    """
    Maps a tune listing in the form of an array of values, to a dictionary.
    Arguably this function is greatly evil, and shouldn't be necessary in
    the first place.
    """

    tune_dict = {}

    # Since apparently there's no easy way to fetch the column index by name,
    # aside from iterating over the columns, I'm taking the inversae approach
    # of iterating over the columns and matching the column name in order to
    # create the mapping to a dictionary.

    # Why the list is mapped to a dictionary in the first place is an interesting question,
    # and something to be revisited later.  I'm guessing I did it this way over the course
    # of migration from various evolutions of the tables and interfaces.

    for i, column in enumerate(table.c):
        if column.name == "ID":
            tune_dict["id"] = tune[i]
        elif column.name == "Title":
            tune_dict["title"] = tune[i]
        elif column.name == "Type":
            tune_dict["type"] = tune[i]
        elif column.name == "Structure":
            tune_dict["structure"] = tune[i]
        elif column.name == "Mode":
            tune_dict["mode"] = tune[i]
        elif column.name == "Incipit":
            tune_dict["incipit"] = tune[i]
        elif column.name == "Learned":
            tune_dict["learned"] = tune[i]
        elif column.name == "Practiced":
            tune_dict["practiced"] = tune[i]
        elif column.name == "Quality":
            tune_dict["quality"] = tune[i]
        elif column.name == "Easiness":
            tune_dict["easiness"] = tune[i]
        elif column.name == "Interval":
            tune_dict["interval"] = tune[i]
        elif column.name == "Repetitions":
            tune_dict["repetitions"] = tune[i]
        elif column.name == "ReviewDate":
            tune_dict["review_date"] = tune[i]
        elif column.name == "BackupPracticed":
            tune_dict["backup_practiced"] = tune[i]
        elif column.name == "NotePrivate":
            tune_dict["notes_private"] = tune[i]
        elif column.name == "NotePublic":
            tune_dict["notes_public"] = tune[i]
        elif column.name == "Tags":
            tune_dict["tags"] = tune[i]
        elif column.name == "StagedNotesPrivate":
            if tune[i] is not None:
                # Special case to overwrite the committed value with a staged value.
                tune_dict["notes_private"] = tune[i]
        elif column.name == "StagedNotesPublic":
            if tune[i] is not None:
                # Special case to overwrite the committed value with a staged value.
                tune_dict["notes_public"] = tune[i]
        elif column.name == "StagedRecallEval":
            if tune[i] is not None:
                # Special case to overwrite the committed value with a staged value.
                tune_dict["recall_eval"] = tune[i]
        else:
            # Fallback to the original column name as the key
            tune_dict[column.name] = tune[i]
    return tune_dict
