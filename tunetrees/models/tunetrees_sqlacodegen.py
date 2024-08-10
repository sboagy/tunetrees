from typing import List, Optional

from sqlalchemy import Column, Float, ForeignKey, Index, Integer, Table, Text, text
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, relationship

# from sqlalchemy.orm.base import Mapped

Base = declarative_base()
metadata = Base.metadata


class Account(Base):
    __tablename__ = "account"

    user_id = mapped_column(Text, primary_key=True, nullable=False)
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
    Column("ReviewDate", Integer),
    Column("BackupPracticed", Text),
    Column("NotePrivate", Text),
    Column("NotePublic", Text),
    Column("Tags", Text),
)


class Tune(Base):
    __tablename__ = "tune"

    ID = mapped_column(Integer, primary_key=True)
    Type = mapped_column(Text)
    Structure = mapped_column(Text)
    Title = mapped_column(Text)
    Mode = mapped_column(Text)
    Incipit = mapped_column(Text)

    practice_record: Mapped[List["PracticeRecord"]] = relationship(
        "PracticeRecord", uselist=True, back_populates="tune"
    )


class User(Base):
    __tablename__ = "user"

    id = mapped_column(Integer, primary_key=True)
    hash = mapped_column(Text)
    name = mapped_column(Text)
    email = mapped_column(Text)
    email_verified = mapped_column(Text, server_default=text("NULL"))
    image = mapped_column(Text)

    playlist: Mapped[List["Playlist"]] = relationship(
        "Playlist", uselist=True, back_populates="user"
    )
    session: Mapped[List["Session"]] = relationship(
        "Session", uselist=True, back_populates="user"
    )


class VerificationToken(Base):
    __tablename__ = "verification_token"

    identifier = mapped_column(Text, primary_key=True)
    token = mapped_column(Text)
    expires = mapped_column(Text)


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
    practice_record: Mapped[List["PracticeRecord"]] = relationship(
        "PracticeRecord", uselist=True, back_populates="playlist"
    )


class Session(Base):
    __tablename__ = "session"

    expires = mapped_column(Text)
    session_token = mapped_column(Text, primary_key=True)
    user_id = mapped_column(ForeignKey("user.id"))

    user: Mapped[Optional["User"]] = relationship("User", back_populates="session")


t_user_annotation_set = Table(
    "user_annotation_set",
    metadata,
    Column("TUNE_REF", ForeignKey("tune.ID")),
    Column("NotePrivate", Text),
    Column("NotePublic", Text),
    Column("Tags", Text),
    Column("USER_REF", ForeignKey("user.id"), nullable=False, server_default=text("1")),
)


t_playlist_tune = Table(
    "playlist_tune",
    metadata,
    Column("PLAYLIST_REF", ForeignKey("playlist.PLAYLIST_ID")),
    Column("TUNE_REF", ForeignKey("tune.ID")),
    Column("Current", Text),
    Column("Learned", Text),
)


class PracticeRecord(Base):
    __tablename__ = "practice_record"

    PLAYLIST_REF = mapped_column(ForeignKey("playlist.PLAYLIST_ID"))
    TUNE_REF = mapped_column(ForeignKey("tune.ID"))
    Practiced = mapped_column(Text)
    Quality = mapped_column(Text)
    ID = mapped_column(Integer, primary_key=True)
    Easiness = mapped_column(Float)
    Interval = mapped_column(Integer)
    Repetitions = mapped_column(Integer)
    ReviewDate = mapped_column(Integer)
    BackupPracticed = mapped_column(Text)

    playlist: Mapped[Optional["Playlist"]] = relationship(
        "Playlist", back_populates="practice_record"
    )
    tune: Mapped[Optional["Tune"]] = relationship(
        "Tune", back_populates="practice_record"
    )
