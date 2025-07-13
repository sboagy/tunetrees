-- auto-generated definition
create table practice_history
(
    playlist_ref     INTEGER
        constraint practice_history_playlist_playlist_id_fk
            references playlist(playlist_id),
    tune_ref         INTEGER
        constraint practice_history_tune_id_fk
            references tune(id),
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
    difficulty       REAL,
    step             integer,
    constraint practice_history_pk
        unique (tune_ref, playlist_ref, practiced)
);
