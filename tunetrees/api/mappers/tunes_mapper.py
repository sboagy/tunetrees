from tunetrees.models.tunetrees import Tune


def tunes_mapper(tune: Tune):
    tune_dict = {}
    tune_dict["id"] = tune[0]
    tune_dict["title"] = tune[1]
    tune_dict["type"] = tune[2]
    tune_dict["structure"] = tune[3]
    tune_dict["mode"] = tune[4]
    tune_dict["incipit"] = tune[5]
    tune_dict["learned"] = tune[6]
    tune_dict["practiced"] = tune[7]
    tune_dict["quality"] = tune[8]
    tune_dict["easiness"] = tune[9]
    tune_dict["interval"] = tune[10]
    tune_dict["repetitions"] = tune[11]
    tune_dict["review_date"] = tune[12]
    tune_dict["backup_practiced"] = tune[13]
    tune_dict["notes_private"] = tune[14]
    tune_dict["notes_public"] = tune[15]
    tune_dict["tags"] = tune[16]
    return tune_dict
