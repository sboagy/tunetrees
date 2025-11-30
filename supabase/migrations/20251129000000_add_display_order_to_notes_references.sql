-- Add display_order column to note table for drag ordering support
ALTER TABLE public.note
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Add display_order column to reference table for drag ordering support
ALTER TABLE public.reference
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.note.display_order IS 'User-defined display order for drag-and-drop reordering in the UI';
COMMENT ON COLUMN public.reference.display_order IS 'User-defined display order for drag-and-drop reordering in the UI';
