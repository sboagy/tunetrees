BEGIN;

ALTER TABLE public.tune_set
  DROP CONSTRAINT IF EXISTS tune_set_kind_check;

UPDATE public.tune_set
SET set_kind = 'group_program'
WHERE set_kind = 'group_setlist';

ALTER TABLE public.tune_set
  ADD CONSTRAINT tune_set_kind_check
  CHECK (set_kind = ANY (ARRAY['practice_set'::text, 'group_program'::text]));

COMMENT ON COLUMN public.tune_set.set_kind IS 'practice_set for personal grouping, group_program for collaborative program ordering.';
COMMENT ON TABLE public.tune_set_item IS 'Ordered membership rows for tune sets and group programs.';
COMMENT ON TABLE public.user_group IS 'Collaborative groups for shared tune sets and programs.';

COMMIT;