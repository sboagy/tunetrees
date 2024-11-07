CREATE VIEW practice_list_staged AS
SELECT
       tune.id,
       tune.title,
       tune.type,
       tune.structure,
       tune.mode,
       tune.incipit,
       playlist_tune.learned,
       playlist.user_ref AS user_ref,
       playlist.playlist_id AS playlist_id,
       playlist.instrument AS instrument,
       practice_record.practiced,
       practice_record.quality,
       practice_record.easiness,
       practice_record.interval,
       practice_record.repetitions,
       practice_record.review_date,
       practice_record.backup_practiced,
       user_annotation_set.tags,
       td.purpose AS purpose,
       td.note_private AS staged_notes_private,
       td.note_public AS staged_notes_public,
       td.recall_eval AS staged_recall_eval,
       (SELECT group_concat(note.note_text, ' ')
        FROM note
        WHERE note.tune_ref = tune.id
          AND note.user_ref = playlist.user_ref) AS notes
FROM
    tune
LEFT JOIN
    playlist_tune ON playlist_tune.tune_ref = tune.id
LEFT JOIN
    playlist ON playlist.playlist_id = playlist_tune.playlist_ref
LEFT JOIN
    practice_record ON practice_record.tune_ref = tune.id AND practice_record.playlist_ref = playlist_tune.playlist_ref
LEFT JOIN
    user_annotation_set ON user_annotation_set.tune_ref = tune.id
LEFT JOIN table_transient_data td ON td.tune_id = tune.id AND td.playlist_id = playlist_tune.playlist_ref;