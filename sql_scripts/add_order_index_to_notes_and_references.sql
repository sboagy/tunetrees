-- Migration script to add order_index column to note and reference tables
-- This enables drag-and-drop ordering of notes and references in the sidebar

-- Add order_index column to note table
ALTER TABLE note ADD COLUMN order_index INTEGER DEFAULT 0;

-- Add order_index column to reference table
ALTER TABLE reference ADD COLUMN order_index INTEGER DEFAULT 0;

-- Initialize existing notes with order_index based on id (older notes first)
UPDATE note SET order_index = (
    SELECT COUNT(*) FROM note AS n2 
    WHERE n2.tune_ref = note.tune_ref 
    AND n2.user_ref = note.user_ref 
    AND n2.id < note.id
);

-- Initialize existing references with order_index based on id (older references first)
UPDATE reference SET order_index = (
    SELECT COUNT(*) FROM reference AS r2 
    WHERE r2.tune_ref = reference.tune_ref 
    AND r2.user_ref = reference.user_ref 
    AND r2.id < reference.id
);
