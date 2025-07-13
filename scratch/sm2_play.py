from supermemo2 import SMTwo

# The values are:
#
#     Quality: The quality of recalling the answer from a scale of 0 to 5.
#         5: perfect response.
#         4: correct response after a hesitation.
#         3: correct response recalled with serious difficulty.
#         2: incorrect response; where the correct one seemed easy to recall.
#         1: incorrect response; the correct one remembered.
#         0: complete blackout.
#     Easiness: The easiness factor, a multiplier that affects the size of the interval, determine by the quality of the recall.
#     Interval: The gap/space between your next review.
#     Repetitions: The count of correct response (quality >= 3) you have in a row.


# easiness: float
# interval: int
# repetitions: int
# review_date: str


def main():
    # first review
    # using quality=4 as an example, read below for what each value from 0 to 5 represents
    # review date would default to date.today() if not provided
    review = SMTwo.first_review(4, "2021-3-14")
    # review prints SMTwo(easiness=2.36, interval=1, repetitions=1, review_date=datetime.date(2021, 3, 15))
    print(review)

    # second review
    review = SMTwo(review.easiness, review.interval, review.repetitions).review(
        3, "2021-3-14"
    )
    # review prints similar to example above.

    print(review)

    review = SMTwo(review.easiness, review.interval, review.repetitions).review(
        4, "2021-3-20"
    )
    # review prints similar to example above.

    print(review)


if __name__ == "__main__":
    main()
