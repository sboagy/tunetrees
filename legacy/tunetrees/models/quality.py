#     Quality: The quality of recalling the answer from a scale of 0 to 5.
#         5: perfect response.
#         4: correct response after a hesitation.
#         3: correct response recalled with serious difficulty.
#         2: incorrect response; where the correct one seemed easy to recall.
#         1: incorrect response; the correct one remembered.
#         0: complete blackout.

RESCHEDULED = "rescheduled"
NEW = "new"
NOT_SET = "not_set"

# Legacy SM2 6-value quality mapping (0-5 scale)
quality_lookup_sm2 = {
    RESCHEDULED: 0,
    NEW: 0,
    NOT_SET: -1,
    "blackout": 0,  # 0: complete blackout.
    "failed": 1,  # 1: incorrect response; the correct one remembered.
    "barely": 2,  # 2: incorrect response; where the correct one seemed easy to recall.
    "struggled": 3,  # 3: correct response recalled with serious difficulty.
    "trivial": 4,  # 4: correct response after a hesitation.
    "perfect": 5,  # 5: perfect response.
}

# FSRS 4-value quality mapping (0-3 scale)
quality_lookup_fsrs = {
    RESCHEDULED: 0,
    NEW: 0,
    NOT_SET: -1,
    "again": 0,  # Again: need to practice again soon
    "hard": 1,  # Hard: difficult recall with effort
    "good": 2,  # Good: satisfactory recall performance
    "easy": 3,  # Easy: effortless and confident recall
}

# Goal-specific 4-value quality mappings (all use FSRS-style 0-3 scale)
quality_lookup_initial_learn = quality_lookup_fsrs.copy()
quality_lookup_fluency = quality_lookup_fsrs.copy()
quality_lookup_session_ready = quality_lookup_fsrs.copy()
quality_lookup_performance_polish = quality_lookup_fsrs.copy()

# Combined lookup that includes both systems
quality_lookup = {
    **quality_lookup_sm2,  # Legacy SM2 values
    **quality_lookup_fsrs,  # New FSRS values
}
