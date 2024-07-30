from sqlalchemy import Column, Float, ForeignKey, Index, Integer, Table, Text, text
from sqlalchemy.orm import declarative_base, mapped_column, relationship

Base = declarative_base()
metadata = Base.metadata


class Account(Base):
    __tablename__ = "account"

    user_id = Column(Text, ForeignKey("user.ID"), primary_key=True)
    provider_account_id = Column(Text, primary_key=True)
    provider = Column(Text)
    type = Column(Text)
    access_token = Column(Text)
    id_token = Column(Text)
    refresh_token = Column(Text)
    scope = Column(Text)
    expires_at = Column(Integer)
    session_state = Column(Text)
    token_type = Column(Text)


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


class Session(Base):
    __tablename__ = "session"

    expires = mapped_column(Text)
    session_token = mapped_column(Text, primary_key=True)
    user_id = mapped_column(Text)

    # user: Mapped[Optional["User"]] = relationship("User", back_populates="session")


class Tune(Base):
    __tablename__ = "tune"

    ID = Column(Integer, primary_key=True)
    Type = Column(Text)
    Structure = Column(Text)
    Title = Column(Text)
    Mode = Column(Text)
    Incipit = Column(Text)

    practice_record = relationship("PracticeRecord", back_populates="tune")


class User(Base):
    __tablename__ = "user"

    ID = Column(Integer, primary_key=True)
    hash = Column(Text)
    first_name = Column(Text)
    middle_name = Column(Text)
    last_name = Column(Text)
    email = Column(Text)
    user_name = Column(Text)
    email_verified = Column(Text)
    image = Column(Text)

    playlist = relationship("Playlist", back_populates="user")


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

    PLAYLIST_ID = Column(Integer, primary_key=True)
    USER_REF = Column(ForeignKey("user.ID"))
    instrument = Column(Text)

    user = relationship("User", back_populates="playlist")
    practice_record = relationship("PracticeRecord", back_populates="playlist")


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


class PracticeRecord(Base):
    __tablename__ = "practice_record"

    PLAYLIST_REF = Column(ForeignKey("playlist.PLAYLIST_ID"))
    TUNE_REF = Column(ForeignKey("tune.ID"))
    Practiced = Column(Text)
    Quality = Column(Text)
    ID = Column(Integer, primary_key=True)
    Easiness = Column(Float)
    Interval = Column(Integer)
    Repetitions = Column(Integer)
    ReviewDate = Column(Integer)
    BackupPracticed = Column(Text)

    playlist = relationship("Playlist", back_populates="practice_record")
    tune = relationship("Tune", back_populates="practice_record")
