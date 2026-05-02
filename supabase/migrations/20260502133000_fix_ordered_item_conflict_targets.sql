BEGIN;

ALTER TABLE public.tune_set_item
  DROP CONSTRAINT IF EXISTS tune_set_item_set_position_unique;

CREATE INDEX IF NOT EXISTS idx_tune_set_item_set_position
  ON public.tune_set_item USING btree (tune_set_ref, position);

ALTER TABLE public.program_item
  DROP CONSTRAINT IF EXISTS program_item_program_position_unique;

CREATE INDEX IF NOT EXISTS idx_program_item_program_position
  ON public.program_item USING btree (program_ref, position);

COMMIT;