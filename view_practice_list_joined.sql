CREATE VIEW practice_list_joined as
select tune.id,
       tune.title,
       tune.type,
       tune.structure,
       tune.mode,
       tune.incipit,
       playlist_tune.learned,
       practice_record.practiced,
       practice_record.quality,
       practice_record.easiness,
       practice_record.interval,
       practice_record.repetitions,
       practice_record.review_date,
       user_annotation_set.note_private,
       user_annotation_set.note_public,
       user_annotation_set.tags,
       user_ref,
       playlist_tune.playlist_ref
from playlist_tune,
     tune,
     practice_record,
     user_annotation_set
where playlist_tune.tune_ref = tune.id
  and practice_record.tune_ref = tune.id and practice_record.playlist_ref = playlist_tune.playlist_ref
  and user_annotation_set.tune_ref = tune.id;

