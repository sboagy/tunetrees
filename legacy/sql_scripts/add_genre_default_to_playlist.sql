ALTER TABLE playlist
ADD COLUMN genre_default TEXT;

-- Step 2: Set the genre_default column as a foreign key referencing genre(id)
-- ALTER TABLE playlist
-- ADD CONSTRAINT fk_genre_default
-- FOREIGN KEY (genre_default)
-- REFERENCES genre(id);

create table new_playlist
(
    playlist_id   INTEGER
        primary key autoincrement,
    user_ref      INTEGER
        references user,
    instrument    TEXT,
    description   TEXT,
    genre_default TEXT,
    unique (user_ref, instrument)
);

-- create index idx_playlist_instrument
--     on new_playlist (instrument);
--
-- create index idx_playlist_user_ref
--     on new_playlist (user_ref);

ALTER TABLE new_playlist
ADD CONSTRAINT fk_genre_default
FOREIGN KEY (genre_default)
REFERENCES genre(id);


-- Step 2: Copy data from the old table to the new table
INSERT INTO new_playlist (playlist_id, user_ref, instrument, description)
SELECT playlist_id, user_ref, instrument, description
FROM playlist;

-- Step 3: Drop the old table
DROP TABLE playlist;

-- Step 4: Rename the new table to the original table’s name
ALTER TABLE new_playlist RENAME TO playlist;

ALTER TABLE main.playlist
ADD COLUMN genre_default TEXT REFERENCES main.genre(id);

ALTER TABLE playlist
ADD COLUMN genre_default TEXT
REFERENCES genre(id)
DEFERRABLE INITIALLY DEFERRED;

