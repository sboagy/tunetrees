from typing import cast
from fsrs import FSRS, Card, Rating
from supermemo2 import sm_two

from tunetrees.app.schedule import TT_DATE_FORMAT, ReviewResult
from datetime import datetime, timezone

from tunetrees.models.quality import NEW, quality_lookup


"""
Rating.Again # forget; incorrect response
Rating.Hard # recall; correct response recalled with serious difficulty
Rating.Good # recall; correct response after a hesitation
Rating.Easy # recall; perfect response
"""


def init_deck() -> Card:
    quality_int = quality_lookup[NEW]
    # practiced_str = datetime.strftime(datetime.now(timezone.utc), TT_DATE_FORMAT)
    # practiced = datetime.strptime(practiced_str, TT_DATE_FORMAT)
    review_sm2 = cast(ReviewResult, sm_two.first_review(quality_int))

    f = FSRS()
    card = Card()
    print(f"Card: {card}")
    # rating = Rating.Good
    card_again, review_log = f.review_card(card, Rating.Again)
    card_hard, review_log = f.review_card(card, Rating.Hard)
    card_good, review_log = f.review_card(card, Rating.Good)
    card_easy, review_log = f.review_card(card, Rating.Easy)
    print(f"Card Again: {card_again}")
    print(f"Card Hard: {card_hard}")
    print(f"Card Good: {card_good}")
    print(f"Card Easy: {card_easy}")
    print(f"Review Log: {review_log}")

    which_card = card_again

    due_str = datetime.strftime(which_card.due, TT_DATE_FORMAT)

    review_fsrs = ReviewResult(
        easiness=which_card.difficulty,
        interval=which_card.scheduled_days,
        repetitions=which_card.reps,
        review_datetime=due_str,
    )

    review_datetime = datetime.strptime(
        review_fsrs["review_datetime"], TT_DATE_FORMAT
    ).replace(tzinfo=timezone.utc)

    re_card = Card(
        difficulty=review_fsrs["easiness"],
        scheduled_days=review_fsrs["interval"],
        reps=review_fsrs["repetitions"],
        due=review_datetime,
    )

    assert which_card.due.replace(microsecond=0) == re_card.due
    assert which_card.difficulty == re_card.difficulty
    assert which_card.reps == re_card.reps
    assert which_card.scheduled_days == re_card.scheduled_days

    assert which_card.stability == re_card.stability
    assert which_card.elapsed_days == re_card.elapsed_days
    assert which_card.lapses == re_card.lapses
    assert which_card.state == re_card.state
    # assert card.last_review == re_card.last_review

    assert review_sm2["easiness"] == review_fsrs["easiness"]
    assert review_sm2["interval"] == review_fsrs["interval"]
    assert review_sm2["repetitions"] == review_fsrs["repetitions"]
    assert review_sm2["review_datetime"] == review_fsrs["review_datetime"]

    # due (datetime): The date and time when the card is due next.
    # stability (float): Core FSRS parameter used for scheduling.
    # difficulty (float): Core FSRS parameter used for scheduling.
    # elapsed_days (int): The number of days since the card was last reviewed.
    # scheduled_days (int): The number of days until the card is due next.
    # reps (int): The number of times the card has been reviewed in its history.
    # lapses (int): The number of times the card has been lapsed in its history.
    # state (State): The card's current learning state.
    # last_review (datetime): The date and time of the card's last review.

    return card


def review_card(card: Card) -> None:
    from datetime import datetime, timezone

    due = card.due

    # how much time between when the card is due and now
    time_delta = due - datetime.now(timezone.utc)

    print(f"Card due: at {repr(due)}")
    print(f"Card due in {time_delta.seconds} seconds")


def main():
    card = init_deck()
    review_card(card)


if __name__ == "__main__":
    main()
