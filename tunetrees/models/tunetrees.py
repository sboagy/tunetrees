from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Index, Integer, Table, Text, text
from sqlalchemy.orm import registry, relationship

mapper_registry = registry()
metadata = mapper_registry.metadata


@mapper_registry.mapped
@dataclass
class Tune:
    __tablename__ = "tune"
    __sa_dataclass_metadata_key__ = "sa"

    ID: int = field(init=False, metadata={"sa": Column(Integer, primary_key=True)})
    Type: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    Structure: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    Title: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    Mode: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    Incipit: Optional[str] = field(default=None, metadata={"sa": Column(Text)})

    practice_record: List[PracticeRecord] = field(
        default_factory=list,
        metadata={"sa": relationship("PracticeRecord", back_populates="tune")},
    )


@mapper_registry.mapped
@dataclass
class User:
    __tablename__ = "user"
    __sa_dataclass_metadata_key__ = "sa"

    ID: int = field(init=False, metadata={"sa": Column(Integer, primary_key=True)})
    hash: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    first_name: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    middle_name: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    last_name: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    email: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    user_name: Optional[str] = field(default=None, metadata={"sa": Column(Text)})

    playlist: List[Playlist] = field(
        default_factory=list,
        metadata={"sa": relationship("Playlist", back_populates="user")},
    )


@mapper_registry.mapped
@dataclass
class Playlist:
    __tablename__ = "playlist"
    __table_args__ = (
        Index("playlists_USER_REF_index", "USER_REF"),
        Index("playlists_instrument_index", "instrument"),
    )
    __sa_dataclass_metadata_key__ = "sa"

    PLAYLIST_ID: int = field(
        init=False, metadata={"sa": Column(Integer, primary_key=True)}
    )
    USER_REF: Optional[int] = field(
        default=None, metadata={"sa": Column(ForeignKey("user.ID"))}
    )
    instrument: Optional[str] = field(default=None, metadata={"sa": Column(Text)})

    user: Optional[User] = field(
        default=None, metadata={"sa": relationship("User", back_populates="playlist")}
    )
    practice_record: List[PracticeRecord] = field(
        default_factory=list,
        metadata={"sa": relationship("PracticeRecord", back_populates="playlist")},
    )


t_user_annotation_set = Table(
    "user_annotation_set",
    metadata,
    Column("TUNE_REF", ForeignKey("tune.ID")),
    Column("NotePrivate", Text),
    Column("NotePublic", Text),
    Column("Tags", Text),
    Column("USER_REF", ForeignKey("user.ID"), nullable=False, server_default=text("1")),
)


t_playlist_tune = Table(
    "playlist_tune",
    metadata,
    Column("PLAYLIST_REF", ForeignKey("playlist.PLAYLIST_ID")),
    Column("TUNE_REF", ForeignKey("tune.ID")),
    Column("Current", Text),
    Column("Learned", Text),
)


@mapper_registry.mapped
@dataclass
class PracticeRecord:
    __tablename__ = "practice_record"
    __sa_dataclass_metadata_key__ = "sa"

    PLAYLIST_REF: Optional[int] = field(
        default=None, metadata={"sa": Column(ForeignKey("playlist.PLAYLIST_ID"))}
    )
    TUNE_REF: Optional[str] = field(
        default=None, metadata={"sa": Column(ForeignKey("tune.ID"))}
    )
    Practiced: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    Feedback: Optional[str] = field(default=None, metadata={"sa": Column(Text)})
    ID: int = field(init=False, metadata={"sa": Column(Integer, primary_key=True)})

    playlist: Optional[Playlist] = field(
        default=None,
        metadata={"sa": relationship("Playlist", back_populates="practice_record")},
    )
    tune: Optional[Tune] = field(
        default=None,
        metadata={"sa": relationship("Tune", back_populates="practice_record")},
    )
