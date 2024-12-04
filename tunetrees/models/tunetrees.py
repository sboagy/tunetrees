from typing import List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, relationship
from sqlalchemy.sql.sqltypes import NullType

Base = declarative_base()
metadata = Base.metadata


class Genre(Base):
    __tablename__ = "genre"

    id = mapped_column(Text, primary_key=True)
    name = mapped_column(Text)
    region = mapped_column(Text)
    description = mapped_column(Text)

    tune: Mapped[List["Tune"]] = relationship(
        "Tune", uselist=True, back_populates="genre_"
    )


class PlaylistTune(Base):
    __tablename__ = "playlist_tune"

    playlist_ref = mapped_column(Integer, primary_key=True)
    tune_ref = mapped_column(Integer, primary_key=True)
    current = mapped_column(Text)
    learned = mapped_column(Text)
    deleted = mapped_column(Boolean, server_default=text("FALSE"))


t_practice_list_joined = Table(
    "practice_list_joined",
    metadata,
    Column("id", Integer),
    Column("title", Text),
    Column("type", Text),
    Column("structure", Text),
    Column("mode", Text),
    Column("incipit", Text),
    Column("genre", Text),
    Column("deleted", Boolean),
    Column("learned", Text),
    Column("practiced", Text),
    Column("quality", Text),
    Column("easiness", Float),
    Column("interval", Integer),
    Column("repetitions", Integer),
    Column("review_date", Text),
    Column("tags", Text),
    Column("playlist_ref", Integer),
    Column("user_ref", Integer),
    Column("playlist_deleted", Boolean),
    Column("notes", NullType),
    Column("favorite_url", Text),
)


t_practice_list_staged = Table(
    "practice_list_staged",
    metadata,
    Column("id", Integer),
    Column("title", Text),
    Column("type", Text),
    Column("structure", Text),
    Column("mode", Text),
    Column("incipit", Text),
    Column("genre", Text),
    Column("deleted", Boolean),
    Column("learned", Text),
    Column("user_ref", Integer),
    Column("playlist_id", Integer),
    Column("instrument", Text),
    Column("playlist_deleted", Boolean),
    Column("practiced", Text),
    Column("quality", Text),
    Column("easiness", Float),
    Column("interval", Integer),
    Column("repetitions", Integer),
    Column("review_date", Text),
    Column("backup_practiced", Text),
    Column("tags", Text),
    Column("purpose", Text),
    Column("staged_notes_private", Text),
    Column("staged_notes_public", Text),
    Column("staged_recall_eval", Text),
    Column("notes", NullType),
    Column("favorite_url", Text),
)


class User(Base):
    __tablename__ = "user"

    id = mapped_column(Integer, primary_key=True)
    hash = mapped_column(Text)
    name = mapped_column(Text)
    email = mapped_column(Text)
    email_verified = mapped_column(Text, server_default=text("NULL"))
    image = mapped_column(Text)
    deleted = mapped_column(Boolean, server_default=text("FALSE"))

    account: Mapped[List["Account"]] = relationship(
        "Account", uselist=True, back_populates="user"
    )
    playlist: Mapped[List["Playlist"]] = relationship(
        "Playlist", uselist=True, back_populates="user"
    )
    prefs_spaced_repetition: Mapped[List["PrefsSpacedRepetition"]] = relationship(
        "PrefsSpacedRepetition", uselist=True, back_populates="user"
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
    note: Mapped[List["Note"]] = relationship(
        "Note", uselist=True, back_populates="user"
    )
    table_transient_data: Mapped[List["TableTransientData"]] = relationship(
        "TableTransientData", uselist=True, back_populates="user"
    )
    tag: Mapped[List["Tag"]] = relationship("Tag", uselist=True, back_populates="user")
    user_annotation_set: Mapped[List["UserAnnotationSet"]] = relationship(
        "UserAnnotationSet", uselist=True, back_populates="user"
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


class Playlist(Base):
    __tablename__ = "playlist"
    __table_args__ = (
        UniqueConstraint("user_ref", "instrument"),
        Index("idx_playlist_instrument", "instrument"),
        Index("idx_playlist_user_ref", "user_ref"),
    )

    playlist_id = mapped_column(Integer, primary_key=True)
    user_ref = mapped_column(ForeignKey("user.id"))
    instrument = mapped_column(Text)
    description = mapped_column(Text)
    genre_default = mapped_column(Text)
    deleted = mapped_column(Boolean, server_default=text("FALSE"))

    user: Mapped[Optional["User"]] = relationship("User", back_populates="playlist")
    note: Mapped[List["Note"]] = relationship(
        "Note", uselist=True, back_populates="playlist"
    )
    practice_record: Mapped[List["PracticeRecord"]] = relationship(
        "PracticeRecord", uselist=True, back_populates="playlist"
    )
    table_transient_data: Mapped[List["TableTransientData"]] = relationship(
        "TableTransientData", uselist=True, back_populates="playlist"
    )


class PrefsSpacedRepetition(Base):
    __tablename__ = "prefs_spaced_repetition"

    alg_type = mapped_column(Enum("SM2", "FSRS"), primary_key=True, nullable=False)
    user_id = mapped_column(ForeignKey("user.id"), primary_key=True)
    fsrs_weights = mapped_column(Text)
    request_retention = mapped_column(Float)
    maximum_interval = mapped_column(Integer)

    user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="prefs_spaced_repetition"
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
        Enum("scheduled", "repertoire", "catalog", "analysis"),
        server_default=text("'practice'"),
    )
    playlist_id = mapped_column(Integer)
    tab_spec = mapped_column(Text)

    user: Mapped["User"] = relationship("User", back_populates="tab_group_main_state")


class TableState(Base):
    __tablename__ = "table_state"

    user_id = mapped_column(ForeignKey("user.id"), primary_key=True, nullable=False)
    screen_size = mapped_column(Enum("small", "full"), primary_key=True, nullable=False)
    purpose = mapped_column(
        Enum("practice", "repertoire", "catalog", "analysis"),
        primary_key=True,
        nullable=False,
    )
    settings = mapped_column(Text)
    current_tune = mapped_column(Integer, server_default=text("null"))
    playlist_id = mapped_column(Integer)

    user: Mapped["User"] = relationship("User", back_populates="table_state")


class Tune(Base):
    __tablename__ = "tune"

    id = mapped_column(Integer, primary_key=True)
    type = mapped_column(Text)
    structure = mapped_column(Text)
    title = mapped_column(Text)
    mode = mapped_column(Text)
    incipit = mapped_column(Text)
    genre = mapped_column(ForeignKey("genre.id"))
    deleted = mapped_column(Boolean, server_default=text("FALSE"))

    genre_: Mapped[Optional["Genre"]] = relationship("Genre", back_populates="tune")
    note: Mapped[List["Note"]] = relationship(
        "Note", uselist=True, back_populates="tune"
    )
    practice_record: Mapped[List["PracticeRecord"]] = relationship(
        "PracticeRecord", uselist=True, back_populates="tune"
    )
    reference: Mapped[List["Reference"]] = relationship(
        "Reference", uselist=True, back_populates="tune"
    )
    table_transient_data: Mapped[List["TableTransientData"]] = relationship(
        "TableTransientData", uselist=True, back_populates="tune"
    )
    tag: Mapped[List["Tag"]] = relationship("Tag", uselist=True, back_populates="tune")
    user_annotation_set: Mapped[List["UserAnnotationSet"]] = relationship(
        "UserAnnotationSet", uselist=True, back_populates="tune"
    )


class Note(Base):
    __tablename__ = "note"
    __table_args__ = (
        CheckConstraint("favorite in (0, 1)"),
        Index("idx_tune_playlist", "tune_ref", "playlist_ref"),
        Index(
            "idx_tune_playlist_user_public",
            "tune_ref",
            "playlist_ref",
            "user_ref",
            "public",
        ),
        Index("idx_tune_user", "tune_ref", "user_ref"),
    )

    id = mapped_column(Integer, primary_key=True)
    user_ref = mapped_column(ForeignKey("user.id"), nullable=False)
    tune_ref = mapped_column(ForeignKey("tune.id"), nullable=False)
    playlist_ref = mapped_column(ForeignKey("playlist.playlist_id"))
    created_date = mapped_column(Text)
    note_text = mapped_column(Text)
    public = mapped_column(Boolean, server_default=text("FALSE"))
    favorite = mapped_column(Integer)
    deleted = mapped_column(Boolean, server_default=text("FALSE"))

    playlist: Mapped[Optional["Playlist"]] = relationship(
        "Playlist", back_populates="note"
    )
    tune: Mapped["Tune"] = relationship("Tune", back_populates="note")
    user: Mapped["User"] = relationship("User", back_populates="note")


class PracticeRecord(Base):
    __tablename__ = "practice_record"
    __table_args__ = (UniqueConstraint("tune_ref", "playlist_ref"),)

    id = mapped_column(Integer, primary_key=True)
    playlist_ref = mapped_column(ForeignKey("playlist.playlist_id"))
    tune_ref = mapped_column(ForeignKey("tune.id"))
    practiced = mapped_column(Text)
    quality = mapped_column(Text)
    easiness = mapped_column(Float)
    interval = mapped_column(Integer)
    repetitions = mapped_column(Integer)
    review_date = mapped_column(Text)
    backup_practiced = mapped_column(Text)
    stability = mapped_column(Float)
    elapsed_days = mapped_column(Integer)
    lapses = mapped_column(Integer)
    state = mapped_column(Integer)

    playlist: Mapped[Optional["Playlist"]] = relationship(
        "Playlist", back_populates="practice_record"
    )
    tune: Mapped[Optional["Tune"]] = relationship(
        "Tune", back_populates="practice_record"
    )


class Reference(Base):
    __tablename__ = "reference"
    __table_args__ = (
        CheckConstraint("ref_type in ('website', 'audio', 'video')"),
        Index("idx_tune_public", "tune_ref", "public"),
        Index("idx_tune_user_ref", "tune_ref", "user_ref"),
        Index("idx_user_tune_public", "user_ref", "tune_ref", "public"),
    )

    id = mapped_column(Integer, primary_key=True)
    url = mapped_column(Text, nullable=False)
    tune_ref = mapped_column(ForeignKey("tune.id"), nullable=False)
    ref_type = mapped_column(Text)
    public = mapped_column(Boolean)
    favorite = mapped_column(Boolean)
    user_ref = mapped_column(Integer)
    comment = mapped_column(Text)
    title = mapped_column(Text)
    deleted = mapped_column(Boolean, server_default=text("FALSE"))

    tune: Mapped["Tune"] = relationship("Tune", back_populates="reference")


class TableTransientData(Base):
    __tablename__ = "table_transient_data"

    user_id = mapped_column(ForeignKey("user.id"), primary_key=True)
    tune_id = mapped_column(ForeignKey("tune.id"), primary_key=True)
    playlist_id = mapped_column(ForeignKey("playlist.playlist_id"), primary_key=True)
    purpose = mapped_column(Text)
    note_private = mapped_column(Text)
    note_public = mapped_column(Text)
    recall_eval = mapped_column(Text)

    playlist: Mapped[Optional["Playlist"]] = relationship(
        "Playlist", back_populates="table_transient_data"
    )
    tune: Mapped[Optional["Tune"]] = relationship(
        "Tune", back_populates="table_transient_data"
    )
    user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="table_transient_data"
    )


class Tag(Base):
    __tablename__ = "tag"
    __table_args__ = (
        UniqueConstraint("user_ref", "tune_ref", "tag_text"),
        Index("idx_user_ref_tag_text", "user_ref", "tag_text"),
        Index("idx_user_ref_tune_ref", "user_ref", "tune_ref"),
    )

    user_ref = mapped_column(ForeignKey("user.id"), nullable=False)
    tune_ref = mapped_column(ForeignKey("tune.id"), nullable=False)
    tag_text = mapped_column(Text, nullable=False)
    tag_id = mapped_column(Integer, primary_key=True)

    tune: Mapped["Tune"] = relationship("Tune", back_populates="tag")
    user: Mapped["User"] = relationship("User", back_populates="tag")


class UserAnnotationSet(Base):
    __tablename__ = "user_annotation_set"

    tune_ref = mapped_column(ForeignKey("tune.id"), primary_key=True)
    note_private = mapped_column(Text)
    note_public = mapped_column(Text)
    tags = mapped_column(Text)
    user_ref = mapped_column(ForeignKey("user.id"), primary_key=True)
    deleted = mapped_column(Boolean, server_default=text("FALSE"))

    tune: Mapped[Optional["Tune"]] = relationship(
        "Tune", back_populates="user_annotation_set"
    )
    user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="user_annotation_set"
    )
