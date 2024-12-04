-- create table table_state
-- (
--     user_id      INTEGER not null
--         references user,
--     screen_size  TEXT    not null,
--     purpose      TEXT    not null,
--     settings     TEXT,
--     current_tune integer default null,
--     playlist_id      INTEGER not null
--         references user,
--     primary key (user_id, screen_size, purpose) on conflict replace,
--     check (purpose IN ('practice', 'repertoire', 'catalog', 'analysis')),
--     check (screen_size IN ('small', 'full'))
-- );

CREATE TABLE table_state_temp (
    user_id INTEGER NOT NULL REFERENCES user,
    screen_size TEXT NOT NULL,
    purpose TEXT NOT NULL,
    settings TEXT,
    current_tune INTEGER DEFAULT NULL,
    playlist_id INTEGER NOT NULL REFERENCES playlist,
    PRIMARY KEY (user_id, screen_size, purpose) ON CONFLICT REPLACE,
    CHECK (purpose IN ('practice', 'repertoire', 'catalog', 'analysis')),
    CHECK (screen_size IN ('small', 'full'))
);

-- Copy data from the original table to the temporary table
INSERT INTO table_state_temp
SELECT user_id, screen_size, purpose, settings, current_tune, 1 FROM table_state;

-- Drop the original table
DROP TABLE table_state;

-- Rename the temporary table to the original table name
ALTER TABLE table_state_temp RENAME TO table_state;
