-- Seed prefs_scheduling_options from existing user.acceptable_delinquency_window
INSERT
OR IGNORE INTO prefs_scheduling_options (user_id, acceptable_delinquency_window)
SELECT
    id AS user_id,
    COALESCE(acceptable_delinquency_window, 21)
FROM
    user;