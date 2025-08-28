from typing import List, Optional

from sqlalchemy import Boolean, CheckConstraint, Column, Enum, Float, ForeignKey, ForeignKeyConstraint, Index, Integer, PrimaryKeyConstraint, Table, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, relationship
from sqlalchemy.orm.base import Mapped
from sqlalchemy.sql.sqltypes import NullType

Base = declarative_base()
metadata = Base.metadata


class DailyPracticeQueue(Base):
    __tablename__ = 'daily_practice_queue'
    __table_args__ = (
        UniqueConstraint('user_ref', 'playlist_ref', 'window_start_utc', 'tune_ref'),
        Index('idx_queue_generated_at', 'generated_at'),
        Index('idx_queue_user_playlist_active', 'user_ref', 'playlist_ref', 'active'),
        Index('idx_queue_user_playlist_bucket', 'user_ref', 'playlist_ref', 'bucket'),
        Index('idx_queue_user_playlist_window', 'user_ref', 'playlist_ref', 'window_start_utc')
    )

    user_ref = mapped_column(Integer, nullable=False)
    playlist_ref = mapped_column(Integer, nullable=False)
    window_start_utc = mapped_column(Text, nullable=False)
    window_end_utc = mapped_column(Text, nullable=False)
    tune_ref = mapped_column(Integer, nullable=False)
    bucket = mapped_column(Integer, nullable=False)
    order_index = mapped_column(Integer, nullable=False)
    snapshot_coalesced_ts = mapped_column(Text, nullable=False)
    generated_at = mapped_column(Text, nullable=False)
    id = mapped_column(Integer, primary_key=True)
    mode = mapped_column(Text)
    queue_date = mapped_column(Text)
    scheduled_snapshot = mapped_column(Text)
    latest_review_date_snapshot = mapped_column(Text)
    acceptable_delinquency_window_snapshot = mapped_column(Integer)
    tz_offset_minutes_snapshot = mapped_column(Integer)
    completed_at = mapped_column(Text)
    exposures_required = mapped_column(Integer)
    exposures_completed = mapped_column(Integer, server_default=text('0'))
    outcome = mapped_column(Text)
    active = mapped_column(Boolean, server_default=text('1'))


class Genre(Base):
    __tablename__ = 'genre'

    id = mapped_column(Text, primary_key=True)
    name = mapped_column(Text)
    region = mapped_column(Text)
    description = mapped_column(Text)

    tune_type: Mapped['TuneType'] = relationship('TuneType', secondary='genre_tune_type', back_populates='genre')
    tune: Mapped[List['Tune']] = relationship('Tune', uselist=True, back_populates='genre_')
    tune_override: Mapped[List['TuneOverride']] = relationship('TuneOverride', uselist=True, back_populates='genre_')


t_practice_list_joined = Table(
    'practice_list_joined', metadata,
    Column('id', Integer),
    Column('title', NullType),
    Column('type', NullType),
    Column('structure', NullType),
    Column('mode', NullType),
    Column('incipit', NullType),
    Column('genre', NullType),
    Column('deleted', Boolean),
    Column('private_for', Integer),
    Column('learned', Text),
    Column('goal', Text),
    Column('scheduled', Text),
    Column('latest_state', Integer),
    Column('latest_practiced', Text),
    Column('latest_quality', Integer),
    Column('latest_easiness', Float),
    Column('latest_difficulty', Float),
    Column('latest_interval', Integer),
    Column('latest_stability', Float),
    Column('latest_step', Integer),
    Column('latest_repetitions', Integer),
    Column('latest_review_date', Text),
    Column('latest_goal', Text),
    Column('latest_technique', Text),
    Column('tags', NullType),
    Column('playlist_ref', Integer),
    Column('user_ref', Integer),
    Column('playlist_deleted', Boolean),
    Column('notes', NullType),
    Column('favorite_url', Text),
    Column('has_override', NullType)
)


t_practice_list_staged = Table(
    'practice_list_staged', metadata,
    Column('id', Integer),
    Column('title', NullType),
    Column('type', NullType),
    Column('structure', NullType),
    Column('mode', NullType),
    Column('incipit', NullType),
    Column('genre', NullType),
    Column('private_for', Integer),
    Column('deleted', Boolean),
    Column('learned', Text),
    Column('goal', NullType),
    Column('scheduled', Text),
    Column('user_ref', Integer),
    Column('playlist_id', Integer),
    Column('instrument', Text),
    Column('playlist_deleted', Boolean),
    Column('latest_state', NullType),
    Column('latest_practiced', NullType),
    Column('latest_quality', NullType),
    Column('latest_easiness', NullType),
    Column('latest_difficulty', NullType),
    Column('latest_stability', NullType),
    Column('latest_interval', NullType),
    Column('latest_step', NullType),
    Column('latest_repetitions', NullType),
    Column('latest_review_date', NullType),
    Column('latest_backup_practiced', NullType),
    Column('latest_goal', NullType),
    Column('latest_technique', NullType),
    Column('tags', NullType),
    Column('purpose', Text),
    Column('note_private', Text),
    Column('note_public', Text),
    Column('recall_eval', Text),
    Column('notes', NullType),
    Column('favorite_url', Text),
    Column('has_override', NullType),
    Column('has_staged', NullType)
)


class TuneType(Base):
    __tablename__ = 'tune_type'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='NewTable_PK'),
    )

    id = mapped_column(Text)
    name = mapped_column(Text)
    rhythm = mapped_column(Text)
    description = mapped_column(Text)

    genre: Mapped['Genre'] = relationship('Genre', secondary='genre_tune_type', back_populates='tune_type')


class User(Base):
    __tablename__ = 'user'

    id = mapped_column(Integer, primary_key=True)
    hash = mapped_column(Text)
    name = mapped_column(Text)
    email = mapped_column(Text)
    email_verified = mapped_column(Text, server_default=text('NULL'))
    image = mapped_column(Text)
    deleted = mapped_column(Boolean, server_default=text('FALSE'))
    sr_alg_type = mapped_column(Text)
    phone = mapped_column(Text)
    phone_verified = mapped_column(Text, server_default=text('NULL'))
    acceptable_delinquency_window = mapped_column(Integer, server_default=text('21'))

    account: Mapped[List['Account']] = relationship('Account', uselist=True, back_populates='user')
    instrument: Mapped[List['Instrument']] = relationship('Instrument', uselist=True, back_populates='user')
    playlist: Mapped[List['Playlist']] = relationship('Playlist', uselist=True, back_populates='user')
    prefs_spaced_repetition: Mapped[List['PrefsSpacedRepetition']] = relationship('PrefsSpacedRepetition', uselist=True, back_populates='user')
    session: Mapped[List['Session']] = relationship('Session', uselist=True, back_populates='user')
    tab_group_main_state: Mapped[List['TabGroupMainState']] = relationship('TabGroupMainState', uselist=True, back_populates='user')
    tune: Mapped[List['Tune']] = relationship('Tune', uselist=True, back_populates='user')
    note: Mapped[List['Note']] = relationship('Note', uselist=True, back_populates='user')
    table_state: Mapped[List['TableState']] = relationship('TableState', uselist=True, back_populates='user')
    table_transient_data: Mapped[List['TableTransientData']] = relationship('TableTransientData', uselist=True, back_populates='user')
    tag: Mapped[List['Tag']] = relationship('Tag', uselist=True, back_populates='user')
    tune_override: Mapped[List['TuneOverride']] = relationship('TuneOverride', uselist=True, back_populates='user')


class VerificationToken(Base):
    __tablename__ = 'verification_token'

    identifier = mapped_column(Text, primary_key=True)
    token = mapped_column(Text)
    expires = mapped_column(Text)


t_view_playlist_joined = Table(
    'view_playlist_joined', metadata,
    Column('playlist_id', Integer),
    Column('user_ref', Integer),
    Column('playlist_deleted', Boolean),
    Column('instrument_ref', Integer),
    Column('private_to_user', Integer),
    Column('instrument', Text),
    Column('description', Text),
    Column('genre_default', Text),
    Column('instrument_deleted', Boolean)
)


class Account(Base):
    __tablename__ = 'account'

    user_id = mapped_column(ForeignKey('user.id'), primary_key=True, nullable=False)
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

    user: Mapped['User'] = relationship('User', back_populates='account')


t_genre_tune_type = Table(
    'genre_tune_type', metadata,
    Column('genre_id', ForeignKey('genre.id'), primary_key=True),
    Column('tune_type_id', ForeignKey('tune_type.id'), primary_key=True)
)


class Instrument(Base):
    __tablename__ = 'instrument'
    __table_args__ = (
        UniqueConstraint('private_to_user', 'instrument'),
        Index('idx_instrument_instrument', 'instrument'),
        Index('idx_instrument_private_to_user', 'private_to_user')
    )

    id = mapped_column(Integer, primary_key=True)
    private_to_user = mapped_column(ForeignKey('user.id'))
    instrument = mapped_column(Text)
    description = mapped_column(Text)
    genre_default = mapped_column(Text)
    deleted = mapped_column(Boolean, server_default=text('FALSE'))

    user: Mapped[Optional['User']] = relationship('User', back_populates='instrument')


class Playlist(Base):
    __tablename__ = 'playlist'
    __table_args__ = (
        UniqueConstraint('user_ref', 'instrument_ref'),
    )

    playlist_id = mapped_column(Integer, primary_key=True)
    user_ref = mapped_column(ForeignKey('user.id'))
    instrument_ref = mapped_column(Integer)
    deleted = mapped_column(Boolean, server_default=text('FALSE'))
    sr_alg_type = mapped_column(Text)

    user: Mapped[Optional['User']] = relationship('User', back_populates='playlist')
    note: Mapped[List['Note']] = relationship('Note', uselist=True, back_populates='playlist')
    playlist_tune: Mapped[List['PlaylistTune']] = relationship('PlaylistTune', uselist=True, back_populates='playlist')
    practice_record: Mapped[List['PracticeRecord']] = relationship('PracticeRecord', uselist=True, back_populates='playlist')
    table_state: Mapped[List['TableState']] = relationship('TableState', uselist=True, back_populates='playlist')
    table_transient_data: Mapped[List['TableTransientData']] = relationship('TableTransientData', uselist=True, back_populates='playlist')


class PrefsSchedulingOptions(User):
    __tablename__ = 'prefs_scheduling_options'

    acceptable_delinquency_window = mapped_column(Integer, nullable=False, server_default=text('21'))
    user_id = mapped_column(ForeignKey('user.id'), primary_key=True)
    min_reviews_per_day = mapped_column(Integer)
    max_reviews_per_day = mapped_column(Integer)
    days_per_week = mapped_column(Integer)
    weekly_rules = mapped_column(Text)
    exceptions = mapped_column(Text)


class PrefsSpacedRepetition(Base):
    __tablename__ = 'prefs_spaced_repetition'

    alg_type = mapped_column(Enum('SM2', 'FSRS'), primary_key=True, nullable=False)
    user_id = mapped_column(ForeignKey('user.id'), primary_key=True)
    fsrs_weights = mapped_column(Text)
    request_retention = mapped_column(Float)
    maximum_interval = mapped_column(Integer)
    learning_steps = mapped_column(Text)
    relearning_steps = mapped_column(Text)
    enable_fuzzing = mapped_column(Integer)

    user: Mapped[Optional['User']] = relationship('User', back_populates='prefs_spaced_repetition')


class Session(Base):
    __tablename__ = 'session'

    expires = mapped_column(Text)
    session_token = mapped_column(Text, primary_key=True)
    user_id = mapped_column(ForeignKey('user.id'))

    user: Mapped[Optional['User']] = relationship('User', back_populates='session')


class TabGroupMainState(Base):
    __tablename__ = 'tab_group_main_state'

    user_id = mapped_column(ForeignKey('user.id'), nullable=False)
    id = mapped_column(Integer, primary_key=True)
    which_tab = mapped_column(Enum('scheduled', 'repertoire', 'catalog', 'analysis'), server_default=text("'practice'"))
    playlist_id = mapped_column(Integer)
    tab_spec = mapped_column(Text)
    practice_show_submitted = mapped_column(Integer, server_default=text('0'))
    practice_mode_flashcard = mapped_column(Integer, server_default=text('0'))

    user: Mapped['User'] = relationship('User', back_populates='tab_group_main_state')


class Tune(Base):
    __tablename__ = 'tune'
    __table_args__ = (
        ForeignKeyConstraint(['genre'], ['genre.id'], name='FK_tune_genre'),
        ForeignKeyConstraint(['private_for'], ['user.id'], name='tune_user_FK')
    )

    id = mapped_column(Integer, primary_key=True)
    type = mapped_column(Text)
    structure = mapped_column(Text)
    title = mapped_column(Text)
    mode = mapped_column(Text)
    incipit = mapped_column(Text)
    genre = mapped_column(Text)
    deleted = mapped_column(Boolean, server_default=text('FALSE'))
    private_for = mapped_column(Integer)

    genre_: Mapped[Optional['Genre']] = relationship('Genre', back_populates='tune')
    user: Mapped[Optional['User']] = relationship('User', back_populates='tune')
    note: Mapped[List['Note']] = relationship('Note', uselist=True, back_populates='tune')
    playlist_tune: Mapped[List['PlaylistTune']] = relationship('PlaylistTune', uselist=True, back_populates='tune')
    practice_record: Mapped[List['PracticeRecord']] = relationship('PracticeRecord', uselist=True, back_populates='tune')
    reference: Mapped[List['Reference']] = relationship('Reference', uselist=True, back_populates='tune')
    table_transient_data: Mapped[List['TableTransientData']] = relationship('TableTransientData', uselist=True, back_populates='tune')
    tag: Mapped[List['Tag']] = relationship('Tag', uselist=True, back_populates='tune')
    tune_override: Mapped[List['TuneOverride']] = relationship('TuneOverride', uselist=True, back_populates='tune')


class Note(Base):
    __tablename__ = 'note'
    __table_args__ = (
        CheckConstraint('favorite in (0, 1)'),
        Index('idx_tune_playlist', 'tune_ref', 'playlist_ref'),
        Index('idx_tune_playlist_user_public', 'tune_ref', 'playlist_ref', 'user_ref', 'public'),
        Index('idx_tune_user', 'tune_ref', 'user_ref')
    )

    id = mapped_column(Integer, primary_key=True)
    tune_ref = mapped_column(ForeignKey('tune.id'), nullable=False)
    user_ref = mapped_column(ForeignKey('user.id'))
    playlist_ref = mapped_column(ForeignKey('playlist.playlist_id'))
    created_date = mapped_column(Text)
    note_text = mapped_column(Text)
    public = mapped_column(Boolean, server_default=text('FALSE'))
    favorite = mapped_column(Integer)
    deleted = mapped_column(Boolean, server_default=text('FALSE'))

    playlist: Mapped[Optional['Playlist']] = relationship('Playlist', back_populates='note')
    tune: Mapped['Tune'] = relationship('Tune', back_populates='note')
    user: Mapped[Optional['User']] = relationship('User', back_populates='note')


class PlaylistTune(Base):
    __tablename__ = 'playlist_tune'

    playlist_ref = mapped_column(ForeignKey('playlist.playlist_id'), primary_key=True, nullable=False)
    tune_ref = mapped_column(ForeignKey('tune.id'), primary_key=True, nullable=False)
    deleted = mapped_column(Boolean, nullable=False, server_default=text('FALSE'))
    current = mapped_column(Text)
    learned = mapped_column(Text)
    goal = mapped_column(Text, server_default=text("'recall'"))
    scheduled = mapped_column(Text)

    playlist: Mapped['Playlist'] = relationship('Playlist', back_populates='playlist_tune')
    tune: Mapped['Tune'] = relationship('Tune', back_populates='playlist_tune')


class PracticeRecord(Base):
    __tablename__ = 'practice_record'
    __table_args__ = (
        UniqueConstraint('tune_ref', 'playlist_ref', 'practiced'),
        Index('practice_record_id_index', 'id'),
        Index('practice_record_practiced_index', 'practiced'),
        Index('practice_record_tune_playlist_practiced_index', 'tune_ref', 'playlist_ref', 'practiced')
    )

    id = mapped_column(Integer, primary_key=True)
    playlist_ref = mapped_column(ForeignKey('playlist.playlist_id'))
    tune_ref = mapped_column(ForeignKey('tune.id'))
    practiced = mapped_column(Text)
    quality = mapped_column(Integer)
    easiness = mapped_column(Float)
    interval = mapped_column(Integer)
    repetitions = mapped_column(Integer)
    review_date = mapped_column(Text)
    backup_practiced = mapped_column(Text)
    stability = mapped_column(Float)
    elapsed_days = mapped_column(Integer)
    lapses = mapped_column(Integer)
    state = mapped_column(Integer)
    difficulty = mapped_column(Float)
    step = mapped_column(Integer)
    goal = mapped_column(Text, server_default=text("'recall'"))
    technique = mapped_column(Text)

    playlist: Mapped[Optional['Playlist']] = relationship('Playlist', back_populates='practice_record')
    tune: Mapped[Optional['Tune']] = relationship('Tune', back_populates='practice_record')


class Reference(Base):
    __tablename__ = 'reference'
    __table_args__ = (
        CheckConstraint("ref_type in ('website', 'audio', 'video')"),
        Index('idx_tune_public', 'tune_ref', 'public'),
        Index('idx_tune_user_ref', 'tune_ref', 'user_ref'),
        Index('idx_user_tune_public', 'user_ref', 'tune_ref', 'public')
    )

    id = mapped_column(Integer, primary_key=True)
    url = mapped_column(Text, nullable=False)
    tune_ref = mapped_column(ForeignKey('tune.id'), nullable=False)
    ref_type = mapped_column(Text)
    public = mapped_column(Boolean)
    favorite = mapped_column(Boolean)
    user_ref = mapped_column(Integer)
    comment = mapped_column(Text)
    title = mapped_column(Text)
    deleted = mapped_column(Boolean, server_default=text('FALSE'))

    tune: Mapped['Tune'] = relationship('Tune', back_populates='reference')


class TableState(Base):
    __tablename__ = 'table_state'

    user_id = mapped_column(ForeignKey('user.id'), primary_key=True, nullable=False)
    screen_size = mapped_column(Enum('small', 'full'), primary_key=True, nullable=False)
    purpose = mapped_column(Enum('practice', 'repertoire', 'catalog', 'analysis'), primary_key=True, nullable=False)
    playlist_id = mapped_column(ForeignKey('playlist.playlist_id'), primary_key=True, nullable=False)
    settings = mapped_column(Text)
    current_tune = mapped_column(Integer, server_default=text('null'))

    playlist: Mapped['Playlist'] = relationship('Playlist', back_populates='table_state')
    user: Mapped['User'] = relationship('User', back_populates='table_state')


class TableTransientData(Base):
    __tablename__ = 'table_transient_data'

    user_id = mapped_column(ForeignKey('user.id'), primary_key=True)
    tune_id = mapped_column(ForeignKey('tune.id'), primary_key=True)
    playlist_id = mapped_column(ForeignKey('playlist.playlist_id'), primary_key=True)
    purpose = mapped_column(Text)
    note_private = mapped_column(Text)
    note_public = mapped_column(Text)
    recall_eval = mapped_column(Text)
    practiced = mapped_column(Text)
    quality = mapped_column(Integer)
    easiness = mapped_column(Float)
    difficulty = mapped_column(Float)
    interval = mapped_column(Integer)
    step = mapped_column(Integer)
    repetitions = mapped_column(Integer)
    review_date = mapped_column(Text)
    backup_practiced = mapped_column(Text)
    goal = mapped_column(Text)
    technique = mapped_column(Text)
    stability = mapped_column(Float)
    state = mapped_column(Integer, server_default=text('2'))

    playlist: Mapped[Optional['Playlist']] = relationship('Playlist', back_populates='table_transient_data')
    tune: Mapped[Optional['Tune']] = relationship('Tune', back_populates='table_transient_data')
    user: Mapped[Optional['User']] = relationship('User', back_populates='table_transient_data')


class Tag(Base):
    __tablename__ = 'tag'
    __table_args__ = (
        UniqueConstraint('user_ref', 'tune_ref', 'tag_text'),
        Index('idx_user_ref_tag_text', 'user_ref', 'tag_text'),
        Index('idx_user_ref_tune_ref', 'user_ref', 'tune_ref')
    )

    user_ref = mapped_column(ForeignKey('user.id'), nullable=False)
    tune_ref = mapped_column(ForeignKey('tune.id'), nullable=False)
    tag_text = mapped_column(Text, nullable=False)
    tag_id = mapped_column(Integer, primary_key=True)

    tune: Mapped['Tune'] = relationship('Tune', back_populates='tag')
    user: Mapped['User'] = relationship('User', back_populates='tag')


class TuneOverride(Base):
    __tablename__ = 'tune_override'
    __table_args__ = (
        ForeignKeyConstraint(['genre'], ['genre.id'], name='FK_tune_override_genre'),
        ForeignKeyConstraint(['tune_ref'], ['tune.id'], name='tune_override_tune_FK'),
        ForeignKeyConstraint(['user_ref'], ['user.id'], name='tune_override_user_FK')
    )

    id = mapped_column(Integer, primary_key=True)
    tune_ref = mapped_column(Integer, nullable=False)
    user_ref = mapped_column(Integer, nullable=False)
    title = mapped_column(Text)
    type = mapped_column(Text)
    structure = mapped_column(Text)
    genre = mapped_column(Text)
    mode = mapped_column(Text)
    incipit = mapped_column(Text)
    deleted = mapped_column(Boolean, server_default=text('FALSE'))

    genre_: Mapped[Optional['Genre']] = relationship('Genre', back_populates='tune_override')
    tune: Mapped['Tune'] = relationship('Tune', back_populates='tune_override')
    user: Mapped['User'] = relationship('User', back_populates='tune_override')
