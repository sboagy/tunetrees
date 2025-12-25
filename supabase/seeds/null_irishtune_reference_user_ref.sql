-- Null out incorrectly-owned IrishTune.info references
--
-- Semantics (current): `reference.public` is ignored. Any row with non-NULL
-- `reference.user_ref` is treated as private/user-owned.
--
-- Some legacy/system references were imported with a non-NULL `user_ref`.
-- For rows pointing at irishtune.info tune pages, we treat these as system
-- references and clear the owner.
--
-- Target form: https://www.irishtune.info/tune/<number>/

begin;

update public.reference
set
  user_ref = null,
  last_modified_at = now(),
  sync_version = coalesce(sync_version, 0) + 1
where
  user_ref is not null
  and url ~ E'^https://www\\.irishtune\\.info/tune/[0-9]+/?$';

commit;
