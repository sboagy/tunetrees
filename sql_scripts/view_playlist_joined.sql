CREATE VIEW view_playlist_joined AS
SELECT 
    p.playlist_id,
    p.user_ref,
    p.deleted AS playlist_deleted,
    p.instrument_ref,
    i.private_to_user,
    i.instrument,
    i.description,
    i.genre_default,
    i.deleted AS instrument_deleted
FROM 
    playlist p
JOIN 
    main.instrument i ON p.instrument_ref = i.id;
