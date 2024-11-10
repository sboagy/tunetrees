-- Attach the source database
ATTACH DATABASE 'tunetrees_do.sqlite3' AS source_db;
PRAGMA foreign_keys = ON;
-- ATTACH DATABASE :source_db AS source_db;

-- Tune Table Migration
INSERT OR REPLACE INTO main.tune (id, type, structure, title, mode, incipit)
SELECT id, type, structure, title, mode, incipit
FROM source_db.tune;

-- User Table Migration
-- INSERT OR REPLACE INTO main.user (id, hash, name, email)
-- SELECT ID, hash, name, email
-- FROM source_db.user;

-- Playlist Table Migration
INSERT OR REPLACE INTO main.playlist (playlist_id, user_ref, instrument)
SELECT playlist_id, user_ref, instrument
FROM source_db.playlist;

-- Playlist_Tune Table Migration
INSERT OR REPLACE INTO main.playlist_tune (playlist_ref, tune_ref, current, learned)
SELECT playlist_ref, tune_ref, current, learned
FROM source_db.playlist_tune;

-- Practice_Record Table Migration
INSERT OR REPLACE INTO main.practice_record (playlist_ref, tune_ref, practiced, quality, id, easiness, interval, repetitions, review_date, backup_practiced)
SELECT playlist_ref, tune_ref, practiced, quality, id, easiness, interval, repetitions, review_date, backup_practiced
FROM source_db.practice_record;

-- User_Annotation_Set Table Migration
INSERT OR REPLACE INTO main.user_annotation_set (tune_ref, note_private, note_public, tags, user_ref)
SELECT tune_ref, note_private, note_public, tags, user_ref
FROM source_db.user_annotation_set;

-- Note Table Migration
INSERT OR REPLACE INTO main.note (id, user_ref, tune_ref, playlist_ref, created_date, note_text, public, favorite)
SELECT id, user_ref, tune_ref, playlist_ref, created_date, note_text, public, favorite
FROM source_db.note;

-- Reference Table Migration
INSERT OR REPLACE INTO main.reference (id, url, ref_type, tune_ref, public, favorite, user_ref, comment, title)
SELECT id, url, ref_type, tune_ref, public, favorite, user_ref, comment, title
FROM source_db.reference;

-- Detach the source database after migration is done
DETACH DATABASE source_db;
