-- E2E helper: allow clearing practice_record safely under delete-protection
--
-- Why: practice_record deletes are blocked by trigger unless the per-transaction
-- flag `app.allow_practice_record_delete` is enabled.
--
-- This function is intended for Playwright E2E test setup only.

create or replace function public.e2e_clear_practice_record(target_playlist uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Ensure the caller owns the playlist.
  if not exists (
    select 1
    from playlist p
    where p.playlist_id = target_playlist
      and p.user_ref = auth.uid()
  ) then
    raise exception 'not authorized to clear practice_record for this playlist';
  end if;

  -- Enable break-glass delete for this transaction.
  perform set_config('app.allow_practice_record_delete', 'on', true);

  delete from practice_record pr
  where pr.playlist_ref = target_playlist;
end;
$$;

revoke all on function public.e2e_clear_practice_record(uuid) from public;
grant execute on function public.e2e_clear_practice_record(uuid) to anon, authenticated;
