CREATE VIEW practice_list_joined as
SELECT
	tune.id AS id,
	COALESCE(tune_override.title, tune.title) AS title,
	COALESCE(tune_override.type, tune.type) AS type,
	COALESCE(tune_override.structure, tune.structure) AS structure,
	COALESCE(tune_override.mode, tune.mode) AS mode,
	COALESCE(tune_override.incipit, tune.incipit) AS incipit,
	COALESCE(tune_override.genre, tune.genre) AS genre,
	tune.deleted,
	tune.private_for,
	playlist_tune.learned,
	practice_record.practiced,
	practice_record.quality,
	practice_record.easiness,
	practice_record.difficulty,
	practice_record.interval,
	practice_record.step,
	practice_record.repetitions,
	practice_record.review_date,
	(
		SELECT
			group_concat (tag.tag_text, ' ')
		FROM
			tag
		WHERE
			tag.tune_ref = tune.id
			AND tag.user_ref = playlist.user_ref
	) AS tags,
	playlist_tune.playlist_ref,
	playlist.user_ref,
	playlist_tune.deleted as playlist_deleted,
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
	END AS has_override
FROM
	tune
	LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
	LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
	LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
	LEFT JOIN practice_record ON practice_record.tune_ref = tune.id
	AND practice_record.playlist_ref = playlist_tune.playlist_ref
	LEFT JOIN tag ON tag.tune_ref = COALESCE(tune_override.id, tune.id)
WHERE
	(
		tune_override.user_ref IS NULL
		OR tune_override.user_ref = playlist.user_ref
	);

