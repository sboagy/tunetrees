-- Attach the source database
ATTACH DATABASE 'tunetrees_do.sqlite3' AS source_db;
PRAGMA foreign_keys = ON;
-- ATTACH DATABASE :source_db AS source_db;

-- Tune Table Migration
INSERT OR REPLACE INTO main.tune (id, type, structure, title, mode, incipit)
SELECT ID, Type, Structure, Title, Mode, Incipit
FROM source_db.tune;

-- User Table Migration
-- INSERT OR REPLACE INTO main.user (id, hash, name, email)
-- SELECT ID, hash, name, email
-- FROM source_db.user;

-- Playlist Table Migration
INSERT OR REPLACE INTO main.playlist (playlist_id, user_ref, instrument)
SELECT PLAYLIST_ID, USER_REF, instrument
FROM source_db.playlist;

-- Playlist_Tune Table Migration
INSERT OR REPLACE INTO main.playlist_tune (playlist_ref, tune_ref, current, learned)
SELECT PLAYLIST_REF, CAST(TUNE_REF AS INTEGER), Current, Learned
FROM source_db.playlist_tune;

-- Practice_Record Table Migration
INSERT OR REPLACE INTO main.practice_record (playlist_ref, tune_ref, practiced, quality, id, easiness, interval, repetitions, review_date, backup_practiced)
SELECT PLAYLIST_REF, CAST(TUNE_REF AS INTEGER), Practiced, Quality, ID, Easiness, Interval, Repetitions, ReviewDate, BackupPracticed
FROM source_db.practice_record;

-- User_Annotation_Set Table Migration
INSERT OR REPLACE INTO main.user_annotation_set (tune_ref, note_private, note_public, tags, user_ref)
SELECT CAST(TUNE_REF AS INTEGER), NotePrivate, NotePublic, Tags, USER_REF
FROM source_db.user_annotation_set;

-- Detach the source database after migration is done
DETACH DATABASE source_db;
