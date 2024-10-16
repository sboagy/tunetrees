from typing import List, Optional

from sqlalchemy import (
    Column,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Table,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, relationship

Base = declarative_base()
metadata = Base.metadata


t_practice_list_joined = Table(
    "practice_list_joined",
    metadata,
    Column("ID", Integer),
    Column("Title", Text),
    Column("Type", Text),
    Column("Structure", Text),
    Column("Mode", Text),
    Column("Incipit", Text),
    Column("Learned", Text),
    Column("Practiced", Text),
    Column("Quality", Text),
    Column("Easiness", Float),
    Column("Interval", Integer),
    Column("Repetitions", Integer),
    Column("ReviewDate", Text),
    Column("BackupPracticed", Text),
    Column("NotePrivate", Text),
    Column("NotePublic", Text),
    Column("Tags", Text),
    Column("USER_REF", Integer),
    Column("PLAYLIST_REF", Integer),
)


t_practice_list_staged = Table(
    "practice_list_staged",
    metadata,
    Column("ID", Integer),
    Column("Title", Text),
    Column("Type", Text),
    Column("Structure", Text),
    Column("Mode", Text),
    Column("Incipit", Text),
    Column("Learned", Text),
    Column("USER_REF", Integer),
    Column("PLAYLIST_REF", Integer),
    Column("Instrument", Text),
    Column("Practiced", Text),
    Column("Quality", Text),
    Column("Easiness", Float),
    Column("Interval", Integer),
    Column("Repetitions", Integer),
    Column("ReviewDate", Text),
    Column("BackupPracticed", Text),
    Column("NotePrivate", Text),
    Column("NotePublic", Text),
    Column("Tags", Text),
    Column("Purpose", Text),
    Column("StagedNotesPrivate", Text),
    Column("StagedNotesPublic", Text),
    Column("StagedRecallEval", Text),
)


class PracticeRecord(Base):
    __tablename__ = "practice_record"

    PLAYLIST_REF = mapped_column(Integer)
    TUNE_REF = mapped_column(Text)
    Practiced = mapped_column(Text)
    Quality = mapped_column(Text)
    ID = mapped_column(Integer, primary_key=True)
    Easiness = mapped_column(Float)
    Interval = mapped_column(Integer)
    Repetitions = mapped_column(Integer)
    ReviewDate = mapped_column(Text)
    BackupPracticed = mapped_column(Text)


class Tune(Base):
    __tablename__ = "tune"

    ID = mapped_column(Integer, primary_key=True)
    Type = mapped_column(Text)
    Structure = mapped_column(Text)
    Title = mapped_column(Text)
    Mode = mapped_column(Text)
    Incipit = mapped_column(Text)

    external_ref: Mapped[List["ExternalRef"]] = relationship(
        "ExternalRef", uselist=True, back_populates="tune"
    )
    user_annotation_set: Mapped[List["UserAnnotationSet"]] = relationship(
        "UserAnnotationSet", uselist=True, back_populates="tune"
    )
    playlist_tune: Mapped[List["PlaylistTune"]] = relationship(
        "PlaylistTune", uselist=True, back_populates="tune"
    )
    table_transient_data: Mapped[List["TableTransientData"]] = relationship(
        "TableTransientData", uselist=True, back_populates="tune"
    )


class User(Base):
    __tablename__ = "user"

    id = mapped_column(Integer, primary_key=True)
    hash = mapped_column(Text)
    name = mapped_column(Text)
    email = mapped_column(Text)
    email_verified = mapped_column(Text, server_default=text("NULL"))
    image = mapped_column(Text)

    account: Mapped[List["Account"]] = relationship(
        "Account", uselist=True, back_populates="user"
    )
    playlist: Mapped[List["Playlist"]] = relationship(
        "Playlist", uselist=True, back_populates="user"
    )
    session: Mapped[List["Session"]] = relationship(
        "Session", uselist=True, back_populates="user"
    )
    tab_group_main_state: Mapped[List["TabGroupMainState"]] = relationship(
        "TabGroupMainState", uselist=True, back_populates="user"
    )
    table_state: Mapped[List["TableState"]] = relationship(
        "TableState", uselist=True, back_populates="user"
    )
    user_annotation_set: Mapped[List["UserAnnotationSet"]] = relationship(
        "UserAnnotationSet", uselist=True, back_populates="user"
    )
    table_transient_data: Mapped[List["TableTransientData"]] = relationship(
        "TableTransientData", uselist=True, back_populates="user"
    )


class VerificationToken(Base):
    __tablename__ = "verification_token"

    identifier = mapped_column(Text, primary_key=True)
    token = mapped_column(Text)
    expires = mapped_column(Text)


class Account(Base):
    __tablename__ = "account"

    user_id = mapped_column(ForeignKey("user.id"), primary_key=True, nullable=False)
    provider_account_id = mapped_column(Text, primary_key=True)
    provider = mapped_column(Text)
    type = mapped_column(Text)
    access_token = mapped_column(Text)
    id_token = mapped_column(Text)
    refresh_token = mapped_column(Text)
    scope = mapped_column(Text)
    expires_at = mapped_column(Integer)
    session_state = mapped_column(Text)
    token_type = mapped_column(Text)

    user: Mapped["User"] = relationship("User", back_populates="account")


class ExternalRef(Base):
    __tablename__ = "external_ref"

    id = mapped_column(Integer, primary_key=True)
    url = mapped_column(Text, nullable=False)
    tune_ref = mapped_column(ForeignKey("tune.ID"), nullable=False)
    ref_type = mapped_column(Text)

    tune: Mapped["Tune"] = relationship("Tune", back_populates="external_ref")


class Playlist(Base):
    __tablename__ = "playlist"
    __table_args__ = (
        Index("playlists_USER_REF_index", "USER_REF"),
        Index("playlists_instrument_index", "instrument"),
    )

    PLAYLIST_ID = mapped_column(Integer, primary_key=True)
    USER_REF = mapped_column(ForeignKey("user.id"))
    instrument = mapped_column(Text)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="playlist")
    playlist_tune: Mapped[List["PlaylistTune"]] = relationship(
        "PlaylistTune", uselist=True, back_populates="playlist"
    )
    table_transient_data: Mapped[List["TableTransientData"]] = relationship(
        "TableTransientData", uselist=True, back_populates="playlist"
    )


class Session(Base):
    __tablename__ = "session"

    expires = mapped_column(Text)
    session_token = mapped_column(Text, primary_key=True)
    user_id = mapped_column(ForeignKey("user.id"))

    user: Mapped[Optional["User"]] = relationship("User", back_populates="session")


class TabGroupMainState(Base):
    __tablename__ = "tab_group_main_state"

    user_id = mapped_column(ForeignKey("user.id"), nullable=False)
    id = mapped_column(Integer, primary_key=True)
    which_tab = mapped_column(
        Enum("scheduled", "repertoire", "analysis"), server_default=text("'practice'")
    )

    user: Mapped["User"] = relationship("User", back_populates="tab_group_main_state")


class TableState(Base):
    __tablename__ = "table_state"

    user_id = mapped_column(ForeignKey("user.id"), primary_key=True, nullable=False)
    screen_size = mapped_column(Enum("small", "full"), primary_key=True, nullable=False)
    purpose = mapped_column(
        Enum("practice", "repertoire", "analysis"), primary_key=True, nullable=False
    )
    settings = mapped_column(Text)

    user: Mapped["User"] = relationship("User", back_populates="table_state")


class UserAnnotationSet(Base):
    __tablename__ = "user_annotation_set"

    USER_REF = mapped_column(
        ForeignKey("user.id"),
        primary_key=True,
        nullable=False,
        server_default=text("1"),
    )
    TUNE_REF = mapped_column(ForeignKey("tune.ID"), primary_key=True)
    NotePrivate = mapped_column(Text)
    NotePublic = mapped_column(Text)
    Tags = mapped_column(Text)

    tune: Mapped[Optional["Tune"]] = relationship(
        "Tune", back_populates="user_annotation_set"
    )
    user: Mapped["User"] = relationship("User", back_populates="user_annotation_set")


class PlaylistTune(Base):
    __tablename__ = "playlist_tune"

    PLAYLIST_REF = mapped_column(ForeignKey("playlist.PLAYLIST_ID"), primary_key=True)
    TUNE_REF = mapped_column(ForeignKey("tune.ID"), primary_key=True)
    Current = mapped_column(Text)
    Learned = mapped_column(Text)

    playlist: Mapped[Optional["Playlist"]] = relationship(
        "Playlist", back_populates="playlist_tune"
    )
    tune: Mapped[Optional["Tune"]] = relationship(
        "Tune", back_populates="playlist_tune"
    )


class TableTransientData(Base):
    __tablename__ = "table_transient_data"

    user_id = mapped_column(ForeignKey("user.id"), primary_key=True, nullable=False)
    tune_id = mapped_column(ForeignKey("tune.ID"), primary_key=True, nullable=False)
    playlist_id = mapped_column(
        ForeignKey("playlist.PLAYLIST_ID"), primary_key=True, nullable=False
    )
    purpose = mapped_column(
        Enum("practice", "repertoire", "suggestions"), primary_key=True
    )
    notes_private = mapped_column(Text)
    notes_public = mapped_column(Text)
    recall_eval = mapped_column(Text)

    playlist: Mapped["Playlist"] = relationship(
        "Playlist", back_populates="table_transient_data"
    )
    tune: Mapped["Tune"] = relationship("Tune", back_populates="table_transient_data")
    user: Mapped["User"] = relationship("User", back_populates="table_transient_data")
