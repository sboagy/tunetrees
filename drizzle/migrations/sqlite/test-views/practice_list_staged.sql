-- Practice List Staged View (Test Simplification)
--
-- Simplified version of practice_list_staged for practice queue unit tests.
-- Only includes fields actually used by the practice queue algorithm.
--
-- Full production view includes 40+ fields with COALESCE operations,
-- tune_override joins, transient data, tags, notes, references, etc.
-- See: scripts/create-views-direct.ts for production implementation.
--
-- Fields included (used by practice-queue.ts):
--   - id, title (tune identification)
--   - scheduled, latest_due (scheduling timestamps)
--   - deleted, repertoire_deleted (soft delete flags)
--   - user_ref, repertoire_id (ownership)
--
-- Fields omitted (not used by practice queue algorithm):
--   - type, mode, structure, incipit, genre (tune metadata)
--   - latest_* fields (practice history - 13 fields)
--   - tags, notes, favorite_url (aggregated data)
--   - purpose, note_private, note_public, recall_eval (transient staging)
--   - has_override, has_staged (flags)
--
-- This simplification prevents schema drift for practice queue tests
-- while keeping the test database lightweight and focused.
CREATE VIEW
    practice_list_staged AS
SELECT
    t.id,
    t.title,
    rt.repertoire_ref AS repertoire_id,
    r.user_ref AS user_ref,
    rt.current AS scheduled,
    (
        SELECT
            MAX(practiced)
        FROM
            practice_record pr
        WHERE
            pr.tune_ref = t.id
            AND pr.repertoire_ref = rt.repertoire_ref
    ) AS latest_due,
    t.deleted,
    r.deleted AS repertoire_deleted
FROM
    tune t
    INNER JOIN repertoire_tune rt ON rt.tune_ref = t.id
    INNER JOIN repertoire r ON r.repertoire_id = rt.repertoire_ref
WHERE
    t.deleted = 0
    AND r.deleted = 0
    AND rt.deleted = 0;