CREATE VIEW practice_list_joined AS
SELECT
    tune.id,
    tune.title,
    tune.type,
    tune.structure,
    tune.mode,
    tune.incipit,
    tune.genre,
    playlist_tune.learned,
    practice_record.practiced,
    practice_record.quality,
    practice_record.easiness,
    practice_record.interval,
    practice_record.repetitions,
    practice_record.review_date,
    user_annotation_set.tags,
    playlist_tune.playlist_ref,
    playlist.user_ref,
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
    practice_record ON practice_record.tune_ref = tune.id AND practice_record.playlist_ref = playlist_tune.playlist_ref
LEFT JOIN
    user_annotation_set ON user_annotation_set.tune_ref = tune.id;