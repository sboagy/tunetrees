from typing import List, Optional

from pydantic import BaseModel
from enum import Enum


class AlgTypeEnum(str, Enum):
    SM2 = "SM2"
    FSRS = "FSRS"


class WhichTabEnum(str, Enum):
    scheduled = "scheduled"
    repertoire = "analysis"


class ScreenSizeEnum(str, Enum):
    small = "small"
    full = "full"


class PurposeEnum(str, Enum):
    practice = "practice"
    repertoire = "repertoire"
    analysis = "analysis"
    suggestions = "suggestions"


class PlaylistTuneModel(BaseModel):
    playlist_ref: int
    tune_ref: str
    current: str
    learned: str

    class Config:
        orm_mode = True


class TuneModel(BaseModel):
    id: int
    type: Optional[str]
    structure: Optional[str]
    title: Optional[str]
    mode: Optional[str]
    incipit: Optional[str]
    external_ref: List["ExternalRefModel"]
    user_annotation_set: List["UserAnnotationSetModel"]
    practice_record: List["PracticeRecordModel"]
    table_transient_data: List["TableTransientDataModel"]

    class Config:
        orm_mode = True


class UserModel(BaseModel):
    id: int
    hash: str
    name: str
    email: str
    email_verified: Optional[str]
    image: Optional[str]
    account: List["AccountModel"]
    playlist: List["PlaylistModel"]
    prefs_spaced_repetition: List["PrefsSpacedRepetitionModel"]
    session: List["SessionModel"]
    tab_group_main_state: List["TabGroupMainStateModel"]
    table_state: List["TableStateModel"]
    user_annotation_set: List["UserAnnotationSetModel"]
    table_transient_data: List["TableTransientDataModel"]

    class Config:
        orm_mode = True


class VerificationTokenModel(BaseModel):
    identifier: str
    token: str
    expires: str

    class Config:
        orm_mode = True


class AccountModel(BaseModel):
    user_id: int
    provider_account_id: str
    provider: str
    type: str
    access_token: Optional[str]
    id_token: Optional[str]
    refresh_token: Optional[str]
    scope: Optional[str]
    expires_at: Optional[int]
    session_state: Optional[str]
    token_type: Optional[str]

    class Config:
        orm_mode = True


class ExternalRefModel(BaseModel):
    id: int
    url: str
    tune_ref: int
    ref_type: Optional[str]

    class Config:
        orm_mode = True


class PlaylistModel(BaseModel):
    playlist_id: int
    user_ref: Optional[int]
    instrument: Optional[str]
    practice_record: List["PracticeRecordModel"]
    table_transient_data: List["TableTransientDataModel"]

    class Config:
        orm_mode = True


class PrefsSpacedRepetitionModel(BaseModel):
    alg_type: AlgTypeEnum
    user_id: int
    fsrs_weights: Optional[str]
    request_retention: Optional[float]
    maximum_interval: Optional[int]

    class Config:
        orm_mode = True


class SessionModel(BaseModel):
    expires: Optional[str]
    session_token: str
    user_id: Optional[int]

    class Config:
        orm_mode = True


class TabGroupMainStateModel(BaseModel):
    user_id: int
    id: int
    which_tab: WhichTabEnum

    class Config:
        orm_mode = True


class TableStateModel(BaseModel):
    user_id: int
    screen_size: ScreenSizeEnum
    purpose: PurposeEnum
    settings: Optional[str]

    class Config:
        orm_mode = True


class UserAnnotationSetModel(BaseModel):
    tune_ref: int
    note_private: Optional[str]
    note_public: Optional[str]
    tags: Optional[str]
    user_ref: int

    class Config:
        orm_mode = True


class PracticeRecordModel(BaseModel):
    playlist_ref: Optional[int]
    tune_ref: Optional[int]
    practiced: Optional[str]
    quality: Optional[str]
    id: int
    easiness: Optional[float]
    interval: Optional[int]
    repetitions: Optional[int]
    review_date: Optional[str]
    backup_practiced: Optional[str]
    stability: Optional[float]
    elapsed_days: Optional[int]
    lapses: Optional[int]
    state: Optional[int]

    class Config:
        orm_mode = True


class TableTransientDataModel(BaseModel):
    user_id: int
    tune_id: int
    playlist_id: int
    purpose: PurposeEnum
    note_private: Optional[str]
    note_public: Optional[str]
    recall_eval: Optional[str]

    class Config:
        orm_mode = True
