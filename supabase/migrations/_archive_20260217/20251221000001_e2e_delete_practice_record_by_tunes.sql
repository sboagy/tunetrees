-- E2E helper: delete practice_record rows for a specific playlist + tune ids.
--
-- This bypasses the production safety trigger that blocks deletes on practice_record
-- unless the per-transaction flag `app.allow_practice_record_delete` is enabled.
-- Supabase JS calls are each their own transaction, so tests must use an RPC that
-- sets the flag and performs the delete within the same transaction.

create or replace function public.e2e_delete_practice_record_by_tunes(
  target_playlist uuid,
  tune_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Ensure caller owns the target playlist (RLS-safe authorization).
  if not exists (
    select 1
    from playlist p
    where p.playlist_id = target_playlist
      and p.user_ref = auth.uid()
  ) then
    raise exception 'Not authorized to clear practice_record for this playlist';
  end if;

  -- Enable delete bypass for this transaction only.
  perform set_config('app.allow_practice_record_delete', 'on', true);

  -- Delete only the matching rows.
  delete from practice_record pr
  where pr.playlist_ref = target_playlist
    and pr.tune_ref = any (tune_ids);
end;
$$;

revoke all on function public.e2e_delete_practice_record_by_tunes(uuid, uuid[]) from public;

grant execute on function public.e2e_delete_practice_record_by_tunes(uuid, uuid[]) to anon;
grant execute on function public.e2e_delete_practice_record_by_tunes(uuid, uuid[]) to authenticated;
