-- Add a deleted flag to the tunes table
ALTER TABLE main.tune ADD COLUMN deleted BOOLEAN DEFAULT FALSE;

-- Add a deleted flag to the playlist_tunes table
ALTER TABLE main.playlist_tune ADD COLUMN deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE main.note ADD COLUMN deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE main.reference ADD COLUMN deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE main.playlist ADD COLUMN deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE main.user ADD COLUMN deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE main.user_annotation_set ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
