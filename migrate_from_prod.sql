-- If you get an error that the database is already in use...
-- DETACH DATABASE 'source_db';
-- Attach the source database
ATTACH DATABASE 'tunetrees_do.sqlite3' AS source_db;

PRAGMA foreign_keys = OFF;

-- Tune Table Migration
INSERT
OR REPLACE INTO main.tune (id, type, structure, title, mode, incipit, genre)
SELECT
    id,
    type,
    structure,
    title,
    mode,
    incipit,
    genre
FROM
    source_db.tune;

-- User Table Migration
INSERT
OR REPLACE INTO main.user (id, hash, name, email, email_verified, image)
SELECT
    id,
    hash,
    name,
    email,
    email_verified,
    image
FROM
    source_db.user;

-- Playlist Table Migration
INSERT
OR REPLACE INTO main.playlist (playlist_id, user_ref, instrument_ref)
SELECT
    playlist_id,
    user_ref,
    instrument_ref
FROM
    source_db.playlist;

-- Playlist_Tune Table Migration
INSERT
OR REPLACE INTO main.playlist_tune (playlist_ref, tune_ref, current, learned)
SELECT
    playlist_ref,
    tune_ref,
    current,
    learned
FROM
    source_db.playlist_tune;

-- Practice_Record Table Migration
INSERT
OR REPLACE INTO main.practice_record (
    playlist_ref,
    tune_ref,
    practiced,
    quality,
    id,
    easiness,
    interval,
    repetitions,
    review_date,
    backup_practiced,
    stability,
    elapsed_days,
    lapses,
    state
)
SELECT
    playlist_ref,
    tune_ref,
    practiced,
    quality,
    id,
    easiness,
    interval,
    repetitions,
    review_date,
    backup_practiced,
    stability,
    elapsed_days,
    lapses,
    state
FROM
    source_db.practice_record;

-- Note Table Migration
INSERT
OR REPLACE INTO main.note (
    id,
    user_ref,
    tune_ref,
    playlist_ref,
    created_date,
    note_text,
    public,
    favorite
)
SELECT
    id,
    user_ref,
    tune_ref,
    playlist_ref,
    created_date,
    note_text,
    public,
    favorite
FROM
    source_db.note;

-- Reference Table Migration
INSERT
OR REPLACE INTO main.reference (
    id,
    url,
    ref_type,
    tune_ref,
    public,
    favorite,
    user_ref,
    comment,
    title
)
SELECT
    id,
    url,
    ref_type,
    tune_ref,
    public,
    favorite,
    user_ref,
    comment,
    title
FROM
    source_db.reference;

-- Account Table Migration
INSERT
OR REPLACE INTO main.account (
    user_id,
    provider_account_id,
    provider,
    type,
    access_token,
    id_token,
    refresh_token,
    scope,
    expires_at,
    session_state,
    token_type
)
SELECT
    user_id,
    provider_account_id,
    provider,
    type,
    access_token,
    id_token,
    refresh_token,
    scope,
    expires_at,
    session_state,
    token_type
FROM
    source_db.account;

-- Genre Table Migration
INSERT
OR REPLACE INTO main.genre (id, name, region, description)
SELECT
    id,
    name,
    region,
    description
FROM
    source_db.genre;

-- Prefs Spaced Repetition Table Migration
INSERT
OR REPLACE INTO main.prefs_spaced_repetition (
    alg_type,
    user_id,
    fsrs_weights,
    request_retention,
    maximum_interval
)
SELECT
    alg_type,
    user_id,
    fsrs_weights,
    request_retention,
    maximum_interval
FROM
    source_db.prefs_spaced_repetition;

-- Session Table Migration
INSERT
OR REPLACE INTO main.session (session_token, user_id, expires)
SELECT
    session_token,
    user_id,
    expires
FROM
    source_db.session;

-- Tab Group Main State Table Migration
-- ommitted tab_spec column for migration
INSERT
OR REPLACE INTO main.tab_group_main_state (user_id, which_tab, id, playlist_id, tab_spec)
SELECT
    user_id,
    which_tab,
    id,
    playlist_id,
    tab_spec
FROM
    source_db.tab_group_main_state;

INSERT
OR REPLACE INTO main.table_state (
    user_id,
    screen_size,
    purpose,
    settings,
    current_tune,
    playlist_id
)
SELECT
    user_id,
    screen_size,
    purpose,
    settings,
    current_tune,
    playlist_id
FROM
    source_db.table_state;

-- Table Transient Data Table Migration
INSERT
OR REPLACE INTO main.table_transient_data (
    user_id,
    tune_id,
    playlist_id,
    purpose,
    note_private,
    note_public,
    recall_eval
)
SELECT
    user_id,
    tune_id,
    playlist_id,
    purpose,
    note_private,
    note_public,
    recall_eval
FROM
    source_db.table_transient_data;

-- Tag Table Migration
INSERT
OR REPLACE INTO main.tag (tag_id, user_ref, tune_ref, tag_text)
SELECT
    tag_id,
    user_ref,
    tune_ref,
    tag_text
FROM
    source_db.tag;

-- Verification Token Table Migration
INSERT
OR REPLACE INTO main.verification_token (identifier, token, expires)
SELECT
    identifier,
    token,
    expires
FROM
    source_db.verification_token;

-- Detach the source database after migration is done
DETACH DATABASE source_db;