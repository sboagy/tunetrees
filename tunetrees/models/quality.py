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

quality_lookup = {
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
