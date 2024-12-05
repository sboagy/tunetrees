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

create table table_state_temp
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

-- Copy data from the original table to the temporary table
INSERT INTO table_state_temp
SELECT user_id, screen_size, purpose, settings, current_tune, playlist_id FROM table_state;

-- Drop the original table
DROP TABLE table_state;

-- Rename the temporary table to the original table name
ALTER TABLE table_state_temp RENAME TO table_state;
