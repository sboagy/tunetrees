from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm.query import Query

from tunetrees.models.tunetrees import (
    ExternalRef,
    PlaylistTune,
    PracticeRecord,
    Tune,
    UserAnnotationSet,
)


class PracticeListJoined:
    def __init__(
        self,
        id_,
        title,
        type_,
        structure,
        mode,
        incipit,
        learned,
        practiced,
        quality,
        easiness,
        interval,
        repetitions,
        review_date,
        backup_practiced,
        note_private,
        note_public,
        tags,
        url,
        ref_type,
    ):
        self.TuneID = id_
        self.TuneTitle = title
        self.TuneType = type_
        self.TuneStructure = structure
        self.TuneMode = mode
        self.TuneIncipit = incipit
        self.PlaylistLearned = learned
        self.PracticeDate = practiced
        self.PracticeQuality = quality
        self.PracticeEasiness = easiness
        self.PracticeInterval = interval
        self.PracticeRepetitions = repetitions
        self.PracticeReviewDate = review_date
        self.PracticeBackupPracticed = backup_practiced
        self.AnnotationNotePrivate = note_private
        self.AnnotationNotePublic = note_public
        self.AnnotationTags = tags
        self.ExternalRefUrl = url
        self.ExternalRefType = ref_type


def get_practice_list_joined(
    session: Session, playlist_ref: int, user_ref: int
) -> list[PracticeListJoined]:
    query = (
        session.query(
            Tune.ID.label("TuneID"),
            Tune.Title.label("TuneTitle"),
            Tune.Type.label("TuneType"),
            Tune.Structure.label("TuneStructure"),
            Tune.Mode.label("TuneMode"),
            Tune.Incipit.label("TuneIncipit"),
            PlaylistTune.Learned.label("PlaylistLearned"),
            PracticeRecord.Practiced.label("PracticeDate"),
            PracticeRecord.Quality.label("PracticeQuality"),
            PracticeRecord.Easiness.label("PracticeEasiness"),
            PracticeRecord.Interval.label("PracticeInterval"),
            PracticeRecord.Repetitions.label("PracticeRepetitions"),
            PracticeRecord.ReviewDate.label("PracticeReviewDate"),
            PracticeRecord.BackupPracticed.label("PracticeBackupPracticed"),
            UserAnnotationSet.NotePrivate.label("AnnotationNotePrivate"),
            UserAnnotationSet.NotePublic.label("AnnotationNotePublic"),
            UserAnnotationSet.Tags.label("AnnotationTags"),
            ExternalRef.url.label("ExternalRefUrl"),
            ExternalRef.ref_type.label("ExternalRefType"),
        )
        .join(PlaylistTune, Tune.ID == PlaylistTune.TUNE_REF)
        .join(PracticeRecord, Tune.ID == PracticeRecord.TUNE_REF)
        .join(UserAnnotationSet, Tune.ID == UserAnnotationSet.TUNE_REF)
        .outerjoin(ExternalRef, Tune.ID == ExternalRef.tune_ref)
        .filter(PlaylistTune.PLAYLIST_REF == playlist_ref)
        .filter(UserAnnotationSet.USER_REF == user_ref)
    )

    results = query.all()
    tune_list = []
    for result in results:
        tune_list.append(PracticeListJoined(*result))

    return tune_list


practice_list_columns = {
    "TuneID": 0,
    "TuneTitle": 1,
    "TuneType": 2,
    "TuneStructure": 3,
    "TuneMode": 4,
    "TuneIncipit": 5,
    "PlaylistLearned": 6,
    "PracticeDate": 7,
    "PracticeQuality": 8,
    "PracticeEasiness": 9,
    "PracticeInterval": 10,
    "PracticeRepetitions": 11,
    "PracticeReviewDate": 12,
    "PracticeBackupPracticed": 13,
    "AnnotationNotePrivate": 14,
    "AnnotationNotePublic": 15,
    "AnnotationTags": 16,
    "ExternalRefUrl": 17,
    "ExternalRefType": 18,
}


def practice_list_column_index(key: str) -> int:
    return practice_list_columns.get(key, -1)


def get_practice_list_query(session: Session, playlist_ref, user_ref) -> Query[Any]:
    query = (
        session.query(
            Tune.ID.label("TuneID"),
            Tune.Title.label("TuneTitle"),
            Tune.Type.label("TuneType"),
            Tune.Structure.label("TuneStructure"),
            Tune.Mode.label("TuneMode"),
            Tune.Incipit.label("TuneIncipit"),
            PlaylistTune.Learned.label("PlaylistLearned"),
            PracticeRecord.Practiced.label("PracticeDate"),
            PracticeRecord.Quality.label("PracticeQuality"),
            PracticeRecord.Easiness.label("PracticeEasiness"),
            PracticeRecord.Interval.label("PracticeInterval"),
            PracticeRecord.Repetitions.label("PracticeRepetitions"),
            PracticeRecord.ReviewDate.label("PracticeReviewDate"),
            PracticeRecord.BackupPracticed.label("PracticeBackupPracticed"),
            UserAnnotationSet.NotePrivate.label("AnnotationNotePrivate"),
            UserAnnotationSet.NotePublic.label("AnnotationNotePublic"),
            UserAnnotationSet.Tags.label("AnnotationTags"),
            ExternalRef.url.label("ExternalRefUrl"),
            ExternalRef.ref_type.label("ExternalRefType"),
        )
        .join(PlaylistTune, Tune.ID == PlaylistTune.TUNE_REF)
        .join(PracticeRecord, Tune.ID == PracticeRecord.TUNE_REF)
        .join(UserAnnotationSet, Tune.ID == UserAnnotationSet.TUNE_REF)
        .outerjoin(ExternalRef, Tune.ID == ExternalRef.tune_ref)
        .filter(PlaylistTune.PLAYLIST_REF == playlist_ref)
        .filter(UserAnnotationSet.USER_REF == user_ref)
    )
    return query
