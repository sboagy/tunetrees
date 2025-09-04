CREATE VIEW
	practice_list_staged AS
SELECT
	tune.id AS id,
	COALESCE(tune_override.title, tune.title) AS title,
	COALESCE(tune_override.type, tune.type) AS type,
	COALESCE(tune_override.structure, tune.structure) AS structure,
	COALESCE(tune_override.mode, tune.mode) AS mode,
	COALESCE(tune_override.incipit, tune.incipit) AS incipit,
	COALESCE(tune_override.genre, tune.genre) AS genre,
	tune.private_for,
	tune.deleted,
	playlist_tune.learned,
	COALESCE(td.goal, COALESCE(pr.goal, 'recall')) AS goal,
	playlist_tune.scheduled AS scheduled,
	playlist.user_ref AS user_ref,
	playlist.playlist_id AS playlist_id,
	instrument.instrument AS instrument,
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
			group_concat (tag.tag_text, ' ')
		FROM
			tag
		WHERE
			tag.tune_ref = tune.id
			AND tag.user_ref = playlist.user_ref
	) AS tags,
	td.purpose AS purpose,
	td.note_private AS note_private,
	td.note_public AS note_public,
	td.recall_eval AS recall_eval,
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
	LEFT JOIN (
		SELECT
			pr.*
		FROM
			practice_record pr
			INNER JOIN (
				SELECT
					tune_ref,
					playlist_ref,
					MAX(id) AS max_id
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
	(
		tune_override.user_ref IS NULL
		OR tune_override.user_ref = playlist.user_ref
	);