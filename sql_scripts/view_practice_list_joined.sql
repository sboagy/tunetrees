-- public.practice_list_joined source

CREATE OR REPLACE VIEW public.practice_list_joined
WITH (security_invoker = on)
AS SELECT tune.id,
    COALESCE(tune_override.title, tune.title) AS title,
    COALESCE(tune_override.type, tune.type) AS type,
    COALESCE(tune_override.structure, tune.structure) AS structure,
    COALESCE(tune_override.mode, tune.mode) AS mode,
    COALESCE(tune_override.incipit, tune.incipit) AS incipit,
    COALESCE(tune_override.genre, tune.genre) AS genre,
    tune.deleted,
    tune.private_for,
    repertoire_tune.learned,
    repertoire_tune.goal,
    repertoire_tune.scheduled,
    practice_record.state AS latest_state,
    practice_record.practiced AS latest_practiced,
    practice_record.quality AS latest_quality,
    practice_record.easiness AS latest_easiness,
    practice_record.difficulty AS latest_difficulty,
    practice_record.interval AS latest_interval,
    practice_record.stability AS latest_stability,
    practice_record.step AS latest_step,
    practice_record.repetitions AS latest_repetitions,
    practice_record.due AS latest_due,
    practice_record.goal AS latest_goal,
    practice_record.technique AS latest_technique,
    ( SELECT string_agg(tag_1.tag_text, ' '::text) AS string_agg
           FROM tag tag_1
          WHERE tag_1.tune_ref = tune.id AND tag_1.user_ref = repertoire.user_ref) AS tags,
    repertoire_tune.repertoire_ref AS playlist_ref,
    repertoire.user_ref,
    repertoire_tune.deleted AS playlist_deleted,
    ( SELECT string_agg(note.note_text, ' '::text) AS string_agg
           FROM note
          WHERE note.tune_ref = tune.id AND note.user_ref = repertoire.user_ref) AS notes,
    ( SELECT ref.url
           FROM reference ref
          WHERE ref.tune_ref = tune.id AND ref.user_ref = repertoire.user_ref AND ref.favorite = true
         LIMIT 1) AS favorite_url,
        CASE
            WHEN tune_override.user_ref = repertoire.user_ref THEN 1
            ELSE 0
        END AS has_override
   FROM tune
     LEFT JOIN repertoire_tune ON repertoire_tune.tune_ref = tune.id
     LEFT JOIN repertoire ON repertoire.repertoire_id = repertoire_tune.repertoire_ref
     LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
     LEFT JOIN ( SELECT DISTINCT ON (pr.tune_ref, pr.repertoire_ref) pr.id,
            pr.repertoire_ref AS playlist_ref,
            pr.tune_ref,
            pr.practiced,
            pr.quality,
            pr.easiness,
            pr.difficulty,
            pr.stability,
            pr.interval,
            pr.step,
            pr.repetitions,
            pr.lapses,
            pr.elapsed_days,
            pr.state,
            pr.due,
            pr.backup_practiced,
            pr.goal,
            pr.technique,
            pr.sync_version,
            pr.last_modified_at,
            pr.device_id
           FROM practice_record pr
          ORDER BY pr.tune_ref, pr.repertoire_ref, pr.practiced DESC NULLS LAST, pr.last_modified_at DESC NULLS LAST, pr.id DESC) practice_record
        ON practice_record.tune_ref = tune.id
       AND practice_record.playlist_ref = repertoire_tune.repertoire_ref
     LEFT JOIN tag ON tag.tune_ref = COALESCE(tune_override.id, tune.id)
  WHERE tune_override.user_ref IS NULL OR tune_override.user_ref = repertoire.user_ref;