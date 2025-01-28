CREATE VIEW practice_list_staged AS
SELECT
       tune.id,
       tune.title,
       tune.type,
       tune.structure,
       tune.mode,
       tune.incipit,
       tune.genre,
       tune.deleted,
       playlist_tune.learned,
       playlist.user_ref AS user_ref,
       playlist.playlist_id AS playlist_id,
       instrument.instrument AS instrument,
       playlist_tune.deleted as playlist_deleted,
       practice_record.practiced,
       practice_record.quality,
       practice_record.easiness,
       practice_record.interval,
       practice_record.repetitions,
       practice_record.review_date,
       practice_record.backup_practiced,
       (SELECT group_concat(tag.tag_text, ' ')
        FROM tag
        WHERE tag.tune_ref = tune.id
          AND tag.user_ref = playlist.user_ref) AS tags,
       td.purpose AS purpose,
       td.note_private AS note_private,
       td.note_public AS note_public,
       td.recall_eval AS recall_eval,
       (SELECT group_concat(note.note_text, ' ')
        FROM note
        WHERE note.tune_ref = tune.id
          AND note.user_ref = playlist.user_ref) AS notes,
       (SELECT ref.url
        FROM reference ref
        WHERE ref.tune_ref = tune.id
          AND ref.user_ref = playlist.user_ref
          AND ref.favorite = 1
        LIMIT 1) AS favorite_url
FROM
    tune
LEFT JOIN
    playlist_tune ON playlist_tune.tune_ref = tune.id
LEFT JOIN
    playlist ON playlist.playlist_id = playlist_tune.playlist_ref
LEFT JOIN
    instrument ON instrument.id = playlist.instrument_ref
LEFT JOIN
    practice_record ON practice_record.tune_ref = tune.id AND practice_record.playlist_ref = playlist_tune.playlist_ref
LEFT JOIN
    tag ON tag.tune_ref = tune.id
LEFT JOIN
    table_transient_data td ON td.tune_id = tune.id AND td.playlist_id = playlist_tune.playlist_ref;
