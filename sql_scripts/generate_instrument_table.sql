create table instrument
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

-- Add comments to the fields (for documentation purposes)
-- COMMENT ON COLUMN instrument.id IS 'Primary key for the instrument table';
-- COMMENT ON COLUMN instrument.private_to_user IS 'Reference to the user table. ID 0 (zero) indicates a public record';
-- COMMENT ON COLUMN instrument.instrument IS 'Short name of the instrument';
-- COMMENT ON COLUMN instrument.description IS 'Description of the instrument';
-- COMMENT ON COLUMN instrument.genre_default IS 'Default genre for the instrument';
-- COMMENT ON COLUMN instrument.deleted IS 'Flag to indicate if the instrument is deleted';

-- Create indexes
create index idx_instrument_instrument
    on instrument (instrument);

create index idx_instrument_private_to_user
    on instrument (private_to_user);

-- Migrate data from the playlist table to the instrument table
insert into instrument (private_to_user, instrument, description, genre_default, deleted)
select user_ref, instrument, description, genre_default, deleted
from playlist;

CREATE TABLE "playlist_new"
(
    playlist_id INTEGER
        primary key autoincrement,
    user_ref    INTEGER
        references user,
    instrument_ref  INTEGER,
    deleted BOOLEAN DEFAULT FALSE,
    unique (user_ref, instrument_ref)
);

insert into playlist_new (playlist_id, user_ref, deleted)
select  playlist_id, user_ref, deleted
from playlist;

-- Step 3: Drop the old table
DROP TABLE playlist;

-- Step 4: Rename the new table to the original table’s name
ALTER TABLE playlist_new RENAME TO playlist;
