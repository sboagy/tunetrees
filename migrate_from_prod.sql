-- Attach the source database
ATTACH DATABASE '/Users/sboag/gittt2/tunetrees/tunetrees.sqlite3' AS source_db;

-- Tune Table Migration
INSERT OR REPLACE INTO main.tune (ID, Type, Structure, Title, Mode, Incipit)
SELECT ID, Type, Structure, Title, Mode, Incipit
FROM source_db.tune;

-- User Table Migration
INSERT OR REPLACE INTO main.user (id, hash, name, email)
SELECT ID, hash, first_name || ' ' || (CASE WHEN middle_name IS NOT NULL THEN middle_name || ' ' ELSE '' END) || last_name, email
FROM source_db.user;

-- Playlist Table Migration
INSERT OR REPLACE INTO main.playlist (PLAYLIST_ID, USER_REF, instrument)
SELECT PLAYLIST_ID, USER_REF, instrument
FROM source_db.playlist;

-- Playlist_Tune Table Migration
INSERT OR REPLACE INTO main.playlist_tune (PLAYLIST_REF, TUNE_REF, Current, Learned)
SELECT PLAYLIST_REF, TUNE_REF, Current, Learned
FROM source_db.playlist_tune;

-- Practice_Record Table Migration
INSERT OR REPLACE INTO main.practice_record (PLAYLIST_REF, TUNE_REF, Practiced, Quality, ID, Easiness, Interval, Repetitions, ReviewDate, BackupPracticed)
SELECT PLAYLIST_REF, TUNE_REF, Practiced, Quality, ID, Easiness, Interval, Repetitions, ReviewDate, BackupPracticed
FROM source_db.practice_record;

-- User_Annotation_Set Table Migration
INSERT OR REPLACE INTO main.user_annotation_set (TUNE_REF, NotePrivate, NotePublic, Tags, USER_REF)
SELECT TUNE_REF, NotePrivate, NotePublic, Tags, USER_REF
FROM source_db.user_annotation_set;

-- Detach the source database after migration is done
DETACH DATABASE source_db;