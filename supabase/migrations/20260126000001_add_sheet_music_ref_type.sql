-- Migration: Add 'sheet-music' to allowed reference types
-- Date: 2026-01-26
-- Description: Allow sheet-music as a valid ref_type value for the reference table

-- Drop existing constraint
ALTER TABLE public.reference 
DROP CONSTRAINT IF EXISTS check_ref_type;

-- Add updated constraint with 'sheet-music' included
ALTER TABLE public.reference 
ADD CONSTRAINT check_ref_type 
CHECK (
  ref_type = ANY (ARRAY['website', 'audio', 'video', 'sheet-music']) 
  OR ref_type IS NULL
);
