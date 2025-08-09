-- Create prefs_scheduling_options table to store scheduling preferences per user
-- This table centralizes scheduling controls and mirrors acceptable_delinquency_window for back-compat
CREATE TABLE
    IF NOT EXISTS prefs_scheduling_options (
        user_id INTEGER PRIMARY KEY REFERENCES user (id),
        acceptable_delinquency_window INTEGER NOT NULL DEFAULT 21,
        min_reviews_per_day INTEGER,
        max_reviews_per_day INTEGER,
        days_per_week INTEGER,
        weekly_rules TEXT, -- JSON string describing weekly rules (e.g., which weekdays are practice days)
        exceptions TEXT -- JSON string of specific date exceptions/overrides
    );