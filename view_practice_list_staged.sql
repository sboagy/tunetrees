CREATE VIEW practice_list_staged AS
SELECT
       t.id,
       t.title,
       t.type,
       t.structure,
       t.mode,
       t.incipit,
       pt.learned,
       pl.user_ref AS user_ref,
       pl.playlist_id AS playlist_id,
       pl.instrument AS instrument,
       pr.practiced,
       pr.quality,
       pr.easiness,
       pr.interval,
       pr.repetitions,
       pr.review_date,
       pr.backup_practiced,
       uas.note_private,
       uas.note_public,
       uas.tags,
       td.purpose AS purpose,
       td.note_private AS staged_notes_private,
       td.note_public AS staged_notes_public,
       td.recall_eval AS staged_recall_eval
FROM playlist_tune pt
JOIN playlist pl ON pl.playlist_id = pt.playlist_ref
JOIN tune t ON pt.tune_ref = t.id
JOIN practice_record pr ON pr.tune_ref = t.id and pr.playlist_ref = pl.playlist_id
JOIN user_annotation_set uas ON uas.tune_ref = t.id
LEFT JOIN table_transient_data td ON td.tune_id = t.id
    AND td.playlist_id = pt.playlist_ref;

