BEGIN;

-- ============================================================================
-- Migration: Seed swing_desc JSON specs for system rhythm patterns
-- Issue: #639 - Move rhythm shape selection into swing_desc
-- ============================================================================

UPDATE public.rhythm_patterns AS rp
SET swing_desc = '{"timeSignature":"6/8","macroBeatDivision":3,"defaultSwingFactor":1.15,"balanceRemainingNotes":true,"velocityPattern":[100,80,60],"humanizationDeltaMs":15}'
FROM public.tune_type AS tt
WHERE rp.tune_type_id = tt.id
  AND tt.name = 'Jig';

UPDATE public.rhythm_patterns AS rp
SET swing_desc = '{"timeSignature":"4/4","macroBeatDivision":2,"defaultSwingFactor":1.40,"balanceRemainingNotes":false,"velocityPattern":[110,75],"humanizationDeltaMs":10}'
FROM public.tune_type AS tt
WHERE rp.tune_type_id = tt.id
  AND tt.name = 'Hornpipe';

UPDATE public.rhythm_patterns AS rp
SET swing_desc = '{"timeSignature":"9/8","macroBeatDivision":3,"defaultSwingFactor":1.12,"balanceRemainingNotes":true,"velocityPattern":[110,75,60],"humanizationDeltaMs":15}'
FROM public.tune_type AS tt
WHERE rp.tune_type_id = tt.id
  AND tt.name = 'Slip Jig';

COMMIT;