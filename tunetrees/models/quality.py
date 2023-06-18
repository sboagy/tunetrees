#     Quality: The quality of recalling the answer from a scale of 0 to 5.
#         5: perfect response.
#         4: correct response after a hesitation.
#         3: correct response recalled with serious difficulty.
#         2: incorrect response; where the correct one seemed easy to recall.
#         1: incorrect response; the correct one remembered.
#         0: complete blackout.
quality_lookup = {
    "not_set": -1,
    "failed": 0,  # 0: complete blackout.
    "barely": 1,  # 1: incorrect response; the correct one remembered.
    "struggled": 2,  # 2: incorrect response; where the correct one seemed easy to recall.
    "recalled": 3,  # 3: correct response recalled with serious difficulty.
    "trivial": 4,  # 4: correct response after a hesitation.
    "perfect": 5,  # 5: perfect response.
}
