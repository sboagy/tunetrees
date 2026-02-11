-- Migration: Add all UI-supported reference types
-- Date: 2026-02-11
-- Description: Add 'article', 'social', 'lesson', and 'other' as valid ref_type values for the reference table
--              to match the types available in the UI (ReferenceForm.tsx)

-- Drop existing constraint
ALTER TABLE public.reference 
DROP CONSTRAINT IF EXISTS check_ref_type;

-- Add updated constraint with all UI-supported types
ALTER TABLE public.reference 
ADD CONSTRAINT check_ref_type 
CHECK (
  ref_type = ANY (ARRAY['website', 'audio', 'video', 'sheet-music', 'article', 'social', 'lesson', 'other']) 
  OR ref_type IS NULL
);
