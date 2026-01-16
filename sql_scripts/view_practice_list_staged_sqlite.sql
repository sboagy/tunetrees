-- SQLite version of practice_list_staged VIEW
-- Ported from PostgreSQL (sql_scripts/view_practice_list_staged.sql)
-- Key changes:
-- 1. DISTINCT ON → subquery with MAX(id) GROUP BY
-- 2. string_agg() → group_concat()
-- 3. Remove PostgreSQL-specific type casts (::text)
CREATE VIEW
    IF NOT EXISTS practice_list_staged AS
SELECT
    tune.id,
    COALESCE(tune_override.title, tune.title) AS title,
    COALESCE(tune_override.type, tune.type) AS type,
    COALESCE(tune_override.structure, tune.structure) AS structure,
    COALESCE(tune_override.mode, tune.mode) AS mode,
    COALESCE(tune_override.incipit, tune.incipit) AS incipit,
    COALESCE(tune_override.genre, tune.genre) AS genre,
    COALESCE(tune_override.composer, tune.composer) AS composer,
    COALESCE(tune_override.artist, tune.artist) AS artist,
    COALESCE(tune_override.id_foreign, tune.id_foreign) AS id_foreign,
    tune.primary_origin AS primary_origin,
    COALESCE(tune_override.release_year, tune.release_year) AS release_year,
    tune.private_for,
    tune.deleted,
    playlist_tune.learned,
    COALESCE(td.goal, COALESCE(pr.goal, 'recall')) AS goal,
    playlist_tune.scheduled,
    playlist.user_ref,
    playlist.playlist_id,
    instrument.instrument,
    playlist_tune.deleted AS playlist_deleted,
    COALESCE(td.state, pr.state) AS latest_state,
    COALESCE(td.practiced, pr.practiced) AS latest_practiced,
    COALESCE(td.quality, pr.quality) AS latest_quality,
    COALESCE(td.easiness, pr.easiness) AS latest_easiness,
    COALESCE(td.difficulty, pr.difficulty) AS latest_difficulty,
    COALESCE(td.stability, pr.stability) AS latest_stability,
    COALESCE(td.interval, pr.interval) AS latest_interval,
    COALESCE(td.step, pr.step) AS latest_step,
    COALESCE(td.repetitions, pr.repetitions) AS latest_repetitions,
    COALESCE(td.due, pr.due) AS latest_due,
    COALESCE(td.backup_practiced, pr.backup_practiced) AS latest_backup_practiced,
    COALESCE(td.goal, pr.goal) AS latest_goal,
    COALESCE(td.technique, pr.technique) AS latest_technique,
    (
        SELECT
            group_concat (tag_1.tag_text, ' ')
        FROM
            tag tag_1
        WHERE
            tag_1.tune_ref = tune.id
            AND tag_1.user_ref = playlist.user_ref
    ) AS tags,
    td.purpose,
    td.note_private,
    td.note_public,
    COALESCE(td.recall_eval, CASE WHEN pr.quality=1 THEN 'again' WHEN pr.quality=2 THEN 'hard' WHEN pr.quality=3 THEN 'good' WHEN pr.quality=4 THEN 'easy' END) AS recall_eval,
    (
        SELECT
            group_concat (note.note_text, ' ')
        FROM
            note
        WHERE
            note.tune_ref = tune.id
            AND note.user_ref = playlist.user_ref
    ) AS notes,
    (
        SELECT
            ref.url
        FROM
            reference ref
        WHERE
            ref.tune_ref = tune.id
            AND ref.user_ref = playlist.user_ref
            AND ref.favorite = 1
        LIMIT
            1
    ) AS favorite_url,
    CASE
        WHEN tune_override.user_ref = playlist.user_ref THEN 1
        ELSE 0
    END AS has_override,
    CASE
        WHEN td.practiced IS NOT NULL
        OR td.quality IS NOT NULL
        OR td.easiness IS NOT NULL
        OR td.difficulty IS NOT NULL
        OR td.interval IS NOT NULL
        OR td.step IS NOT NULL
        OR td.repetitions IS NOT NULL
        OR td.due IS NOT NULL
        OR td.backup_practiced IS NOT NULL
        OR td.goal IS NOT NULL
        OR td.technique IS NOT NULL
        OR td.stability IS NOT NULL THEN 1
        ELSE 0
    END AS has_staged
FROM
    tune
    LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
    LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
    LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    LEFT JOIN instrument ON instrument.id = playlist.instrument_ref
    -- Latest practice_record per (tune_ref, playlist_ref)
    -- SQLite doesn't support DISTINCT ON, so we use a subquery
    LEFT JOIN (
        SELECT
            pr.*
        FROM
            practice_record pr
            INNER JOIN (
                SELECT
                    tune_ref,
                    playlist_ref,
                    MAX(id) as max_id
                FROM
                    practice_record
                GROUP BY
                    tune_ref,
                    playlist_ref
            ) latest ON pr.tune_ref = latest.tune_ref
            AND pr.playlist_ref = latest.playlist_ref
            AND pr.id = latest.max_id
    ) pr ON pr.tune_ref = tune.id
    AND pr.playlist_ref = playlist_tune.playlist_ref
    LEFT JOIN tag ON tag.tune_ref = tune.id
    LEFT JOIN table_transient_data td ON td.tune_id = tune.id
    AND td.playlist_id = playlist_tune.playlist_ref
WHERE
    tune_override.user_ref IS NULL
    OR tune_override.user_ref = playlist.user_ref;
