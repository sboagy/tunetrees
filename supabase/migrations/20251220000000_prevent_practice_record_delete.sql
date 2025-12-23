-- Prevent deletion of historical practice records.
--
-- Rationale: practice_record is append-only audit/history data.
-- Deleting these rows is treated as a bug/data-loss event.

create or replace function public.prevent_practice_record_delete()
returns trigger
language plpgsql
as $$
begin
  -- Break-glass bypass (per-session / per-transaction).
  -- Example:
  --   begin;
  --   set local app.allow_practice_record_delete = 'on';
  --   delete from public.practice_record where id = 123;
  --   commit;
  if current_setting('app.allow_practice_record_delete', true) = 'on' then
    return old;
  end if;

  raise exception 'Deleting from practice_record is not allowed';
end;
$$;

drop trigger if exists trg_prevent_practice_record_delete on public.practice_record;
create trigger trg_prevent_practice_record_delete
before delete on public.practice_record
for each row
execute function public.prevent_practice_record_delete();
