-- public.view_playlist_joined source

CREATE OR REPLACE VIEW public.view_playlist_joined
WITH (security_invoker = on)
AS SELECT repertoire.repertoire_id AS playlist_id,
    repertoire.user_ref,
    repertoire.deleted AS playlist_deleted,
    repertoire.instrument_ref,
    instrument.private_to_user,
    instrument.instrument,
    instrument.description,
    instrument.genre_default,
    instrument.deleted AS instrument_deleted
   FROM repertoire
     JOIN instrument ON repertoire.instrument_ref = instrument.id;