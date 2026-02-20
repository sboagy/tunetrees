-- Add auto_schedule_new column to prefs_scheduling_options table
-- Controls whether never-practiced tunes are automatically included in Q3 bucket
-- of daily practice queue generation
ALTER TABLE public.prefs_scheduling_options
ADD COLUMN IF NOT EXISTS auto_schedule_new BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.prefs_scheduling_options.auto_schedule_new IS 'Include never-practiced tunes in daily practice queue (Q3 bucket). Default: true';