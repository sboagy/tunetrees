CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE IF NOT EXISTS "session"
(
    expires       TEXT,
    session_token TEXT
        constraint session_pk
            primary key,
    user_id       TEXT
        constraint session_user_ID_fk
            references user
);
CREATE TABLE IF NOT EXISTS "verification_token"
(
    identifier TEXT
        constraint verification_token_pk
            primary key,
    token      TEXT
        constraint verification_token_pk_2
            unique,
    expires    TEXT
);
CREATE TABLE IF NOT EXISTS "account"
(
    user_id             TEXT not null
        constraint account_user_id_fk
            references user,
    provider_account_id TEXT,
    provider            TEXT,
    type                TEXT,
    access_token        TEXT,
    id_token            TEXT,
    refresh_token       TEXT,
    scope               TEXT,
    expires_at          integer,
    session_state       TEXT,
    token_type          TEXT,
    constraint account_pk
        primary key (provider_account_id, user_id)
);
CREATE TABLE IF NOT EXISTS "user"
(
    id             integer           not null
        constraint users_pk
            primary key autoincrement,
    hash           TEXT,
    name           TEXT,
    email          TEXT,
    email_verified TEXT default NULL null on conflict ignore,
    image          TEXT
, deleted BOOLEAN DEFAULT FALSE, sr_alg_type TEXT);
CREATE TABLE IF NOT EXISTS "prefs_spaced_repetition"
(
    alg_type TEXT not null,
    user_id  INTEGER
        constraint prefs_spaced_repetition_user_FK
            references user, fsrs_weights TEXT, request_retention REAL, maximum_interval integer,
    constraint prefs_spaced_repetition_pk
        primary key (user_id, alg_type),
    constraint check_name
        check (alg_type IN ('SM2', 'FSRS')) on conflict rollback
);
CREATE TABLE IF NOT EXISTS "table_transient_data"
(
    user_id      INTEGER
        constraint table_transient_data_user_id_fk
            references user,
    tune_id      INTEGER
        constraint table_transient_data_tune_id_fk
            references tune,
    playlist_id  INTEGER
        constraint table_transient_data_playlist_playlist_id_fk
            references playlist,
    purpose      TEXT,
    note_private TEXT,
    note_public  TEXT,
    recall_eval  TEXT,
    constraint table_transient_data_pk
        primary key (tune_id, user_id, playlist_id)
);
CREATE TABLE IF NOT EXISTS "playlist_tune"
(
    playlist_ref INTEGER,
    tune_ref     INTEGER,
    current      TEXT,
    learned      TEXT, deleted BOOLEAN DEFAULT FALSE,
    constraint playlist_tune_pk
        primary key (tune_ref, playlist_ref)
);
CREATE TABLE IF NOT EXISTS "tag"
(
    tag_id   INTEGER
        primary key autoincrement,
    user_ref INTEGER not null
        references user,
    tune_ref INTEGER not null
        references tune,
    tag_text TEXT    not null,
    unique (user_ref, tune_ref, tag_text)
);
CREATE INDEX idx_user_ref_tag_text
    on tag (user_ref, tag_text);
CREATE INDEX idx_user_ref_tune_ref
    on tag (user_ref, tune_ref);
CREATE TABLE genre
(
    id          TEXT not null
        constraint genre_pk
            primary key,
    name        TEXT,
    region      TEXT,
    description TEXT
);
CREATE TABLE IF NOT EXISTS "tab_group_main_state"
(
    user_id     INTEGER                 not null
        constraint tab_group_main_state_user_id_fk
            references user,
    which_tab   TEXT default 'practice' null on conflict replace,
    id          integer                 not null
        constraint tab_group_main_state_pk
            primary key autoincrement,
    playlist_id integer,
    tab_spec    TEXT,
    constraint check_name
        check (which_tab IN ('scheduled', 'repertoire', 'catalog', 'analysis'))
);
CREATE TABLE IF NOT EXISTS "table_state"
(
    user_id      INTEGER not null
        references user,
    screen_size  TEXT    not null,
    purpose      TEXT    not null,
    settings     TEXT,
    current_tune integer default null,
    playlist_id  integer not null
        references playlist,
    constraint compound_primary_key
        primary key (user_id, screen_size, purpose, playlist_id) on conflict replace,
    check (purpose IN ('practice', 'repertoire', 'catalog', 'analysis')),
    check (screen_size IN ('small', 'full'))
);
CREATE TABLE instrument
(
    id   INTEGER
        primary key autoincrement,
    private_to_user      INTEGER
        references user(id),
    instrument    TEXT,
    description   TEXT,
    genre_default TEXT,
    deleted       BOOLEAN default FALSE,
    unique (private_to_user, instrument)
);
CREATE INDEX idx_instrument_instrument
    on instrument (instrument);
CREATE INDEX idx_instrument_private_to_user
    on instrument (private_to_user);
CREATE TABLE IF NOT EXISTS "playlist"
(
    playlist_id INTEGER
        primary key autoincrement,
    user_ref    INTEGER
        references user,
    instrument_ref  INTEGER,
    deleted BOOLEAN DEFAULT FALSE, sr_alg_type TEXT,
    unique (user_ref, instrument_ref)
);
CREATE TABLE IF NOT EXISTS "practice_record"
(
    playlist_ref     INTEGER
        constraint practice_record_playlist_playlist_id_fk
            references playlist,
    tune_ref         INTEGER
        constraint practice_record_tune_id_fk
            references tune,
    practiced        TEXT,
    quality          INTEGER,
    id               integer not null
        primary key autoincrement,
    easiness         REAL,
    interval         integer,
    repetitions      integer,
    review_date      TEXT,
    backup_practiced TEXT,
    stability        REAL,
    elapsed_days     integer,
    lapses           integer,
    state            integer,
    constraint practice_record_pk
        unique (tune_ref, playlist_ref)
);
CREATE TABLE IF NOT EXISTS "reference"
(
    id       integer not null
        constraint reference_pk
            primary key autoincrement,
    url      TEXT    not null,
    ref_type TEXT,
    tune_ref integer not null
        constraint external_ref_tune_ID_fk
            references tune,
    public   integer,
    favorite integer,
    user_ref integer null on conflict ignore,
    comment  TEXT,
    title    TEXT,
    deleted  BOOLEAN default FALSE,
    constraint check_favorite
        check (favorite IN (0, 1)),
    constraint check_public
        check (public IN (0, 1)),
    constraint check_ref_type
        check (ref_type in ('website', 'audio', 'video'))
);
CREATE INDEX idx_tune_public
    on reference (tune_ref, public);
CREATE INDEX idx_tune_user_ref
    on reference (tune_ref, user_ref);
CREATE INDEX idx_user_tune_public
    on reference (user_ref, tune_ref, public);
CREATE TABLE IF NOT EXISTS "note"
(
    id           integer not null
        constraint note_pk
            primary key autoincrement,
    user_ref     INTEGER null on conflict ignore
        constraint note_user_id_fk
            references user,
    tune_ref     INTEGER not null
        constraint note_tune_id_fk
            references tune,
    playlist_ref integer null on conflict ignore
        constraint note_playlist_playlist_id_fk
            references playlist,
    created_date TEXT,
    note_text    TEXT,
    public       INTEGER default FALSE,
    favorite     integer,
    deleted      BOOLEAN default FALSE,
    constraint chk_favorite_bool
        check (favorite in (0, 1)),
    constraint chk_public_bool
        check (public IN (0, 1))
);
CREATE INDEX idx_tune_playlist
    on note (tune_ref, playlist_ref);
CREATE INDEX idx_tune_playlist_user_public
    on note (tune_ref, playlist_ref, user_ref, public);
CREATE INDEX idx_tune_user
    on note (tune_ref, user_ref);
CREATE TABLE tune (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"type" TEXT,
	"structure" TEXT,
	title TEXT,
	mode TEXT,
	incipit TEXT,
	genre TEXT,
	deleted BOOLEAN DEFAULT (FALSE),
	private_for INTEGER,
	CONSTRAINT FK_tune_genre FOREIGN KEY (genre) REFERENCES genre(id),
	CONSTRAINT tune_user_FK FOREIGN KEY (private_for) REFERENCES "user"(id)
);
CREATE TABLE tune_override (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	tune_ref INTEGER NOT NULL,
	title TEXT,
	"type" TEXT,
	"structure" TEXT,
	genre TEXT,
	mode TEXT,
	incipit TEXT,
	deleted BOOLEAN DEFAULT (FALSE),
	user_ref INTEGER NOT NULL,
	CONSTRAINT FK_tune_override_genre FOREIGN KEY (genre) REFERENCES genre(id),
	CONSTRAINT tune_override_tune_FK FOREIGN KEY (tune_ref) REFERENCES tune(id),
	CONSTRAINT tune_override_user_FK FOREIGN KEY (user_ref) REFERENCES "user"(id)
);
CREATE TABLE IF NOT EXISTS "tune_type" (
	id TEXT NOT NULL,
	name TEXT,
	rhythm TEXT,
	description TEXT,
	CONSTRAINT NewTable_PK PRIMARY KEY (id)
);
CREATE TABLE genre_tune_type (
    genre_id TEXT,
    tune_type_id TEXT,
    PRIMARY KEY (genre_id, tune_type_id),
    FOREIGN KEY (genre_id) REFERENCES genre(id),
    FOREIGN KEY (tune_type_id) REFERENCES tune_type(id)
);
CREATE TABLE sqlite_stat1(tbl,idx,stat);
CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample);
CREATE VIEW view_playlist_joined AS
SELECT
	p.playlist_id,
	p.user_ref,
	p.deleted AS playlist_deleted,
	p.instrument_ref,
	i.private_to_user,
	i.instrument,
	i.description,
	i.genre_default,
	i.deleted AS instrument_deleted
FROM
	playlist p
	JOIN instrument i ON p.instrument_ref = i.id
/* view_playlist_joined(playlist_id,user_ref,playlist_deleted,instrument_ref,private_to_user,instrument,description,genre_default,instrument_deleted) */;
CREATE VIEW practice_list_joined AS
SELECT
	tune.id AS id,
	COALESCE(tune_override.title, tune.title) AS title,
	COALESCE(tune_override.type, tune.type) AS type,
	COALESCE(tune_override.structure, tune.structure) AS structure,
	COALESCE(tune_override.mode, tune.mode) AS mode,
	COALESCE(tune_override.incipit, tune.incipit) AS incipit,
	COALESCE(tune_override.genre, tune.genre) AS genre,
	tune.deleted,
	tune.private_for,
	playlist_tune.learned,
	practice_record.practiced,
	practice_record.quality,
	practice_record.easiness,
	practice_record.interval,
	practice_record.repetitions,
	practice_record.review_date,
	(
		SELECT
			group_concat (tag.tag_text, ' ')
		FROM
			tag
		WHERE
			tag.tune_ref = tune.id
			AND tag.user_ref = playlist.user_ref
	) AS tags,
	playlist_tune.playlist_ref,
	playlist.user_ref,
	playlist_tune.deleted as playlist_deleted,
	(
		SELECT
			group_concat (note.note_text, ' ')
		FROM
			note
		WHERE
			note.tune_ref = tune.id
			AND note.user_ref = playlist.user_ref
	) AS notes,
	(
		SELECT
			ref.url
		FROM
			reference ref
		WHERE
			ref.tune_ref = tune.id
			AND ref.user_ref = playlist.user_ref
			AND ref.favorite = 1
		LIMIT
			1
	) AS favorite_url,
	CASE
		WHEN tune_override.user_ref = playlist.user_ref THEN 1
		ELSE 0
	END AS has_override
FROM
	tune
	LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
	LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
	LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
	LEFT JOIN practice_record ON practice_record.tune_ref = tune.id
	AND practice_record.playlist_ref = playlist_tune.playlist_ref
	LEFT JOIN tag ON tag.tune_ref = COALESCE(tune_override.id, tune.id)
WHERE
	(
		tune_override.user_ref IS NULL
		OR tune_override.user_ref = playlist.user_ref
	)
/* practice_list_joined(id,title,type,structure,mode,incipit,genre,deleted,private_for,learned,practiced,quality,easiness,interval,repetitions,review_date,tags,playlist_ref,user_ref,playlist_deleted,notes,favorite_url,has_override) */;
CREATE VIEW practice_list_staged AS
SELECT
	tune.id AS id,
	COALESCE(tune_override.title, tune.title) AS title,
	COALESCE(tune_override.type, tune.type) AS type,
	COALESCE(tune_override.structure, tune.structure) AS structure,
	COALESCE(tune_override.mode, tune.mode) AS mode,
	COALESCE(tune_override.incipit, tune.incipit) AS incipit,
	COALESCE(tune_override.genre, tune.genre) AS genre,
	tune.private_for,
	tune.deleted,
	playlist_tune.learned,
	playlist.user_ref AS user_ref,
	playlist.playlist_id AS playlist_id,
	instrument.instrument AS instrument,
	playlist_tune.deleted as playlist_deleted,
	practice_record.practiced,
	practice_record.quality,
	practice_record.easiness,
	practice_record.interval,
	practice_record.repetitions,
	practice_record.review_date,
	practice_record.backup_practiced,
	(
		SELECT
			group_concat (tag.tag_text, ' ')
		FROM
			tag
		WHERE
			tag.tune_ref = tune.id
			AND tag.user_ref = playlist.user_ref
	) AS tags,
	td.purpose AS purpose,
	td.note_private AS note_private,
	td.note_public AS note_public,
	td.recall_eval AS recall_eval,
	(
		SELECT
			group_concat (note.note_text, ' ')
		FROM
			note
		WHERE
			note.tune_ref = tune.id
			AND note.user_ref = playlist.user_ref
	) AS notes,
	(
		SELECT
			ref.url
		FROM
			reference ref
		WHERE
			ref.tune_ref = tune.id
			AND ref.user_ref = playlist.user_ref
			AND ref.favorite = 1
		LIMIT
			1
	) AS favorite_url,
	CASE
		WHEN tune_override.user_ref = playlist.user_ref THEN 1
		ELSE 0
	END AS has_override
FROM
	tune
	LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
	LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
	LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
	LEFT JOIN instrument ON instrument.id = playlist.instrument_ref
	LEFT JOIN practice_record ON practice_record.tune_ref = tune.id
	AND practice_record.playlist_ref = playlist_tune.playlist_ref
	LEFT JOIN tag ON tag.tune_ref = tune.id
	LEFT JOIN table_transient_data td ON td.tune_id = tune.id
	AND td.playlist_id = playlist_tune.playlist_ref
WHERE
	(
		tune_override.user_ref IS NULL
		OR tune_override.user_ref = playlist.user_ref
	)
/* practice_list_staged(id,title,type,structure,mode,incipit,genre,private_for,deleted,learned,user_ref,playlist_id,instrument,playlist_deleted,practiced,quality,easiness,interval,repetitions,review_date,backup_practiced,tags,purpose,note_private,note_public,recall_eval,notes,favorite_url,has_override) */;
