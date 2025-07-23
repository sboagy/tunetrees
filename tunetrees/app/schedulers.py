from datetime import datetime
from typing import Optional, Tuple, Dict, Any
from fsrs import Card, Rating, State, Scheduler, ReviewLog
from supermemo2 import sm_two


from tunetrees.models.quality import NEW, RESCHEDULED
from tunetrees.models.tunetrees_pydantic import AlgorithmType
from datetime import timedelta


# For maximum compatibility with all type checkers, alias to Dict[str, Any]
ReviewResultDict = Dict[str, Any]


class SpacedRepetitionScheduler:
    """
    Abstract base class for spaced repetition schedulers.
    Provides a factory method for instantiation based on algorithm type and preferences.
    """

    def __init__(
        self,
        weights: Optional[Tuple[float, ...]] = None,
        desired_retention: Optional[float] = None,
        maximum_interval: Optional[int] = None,
        learning_steps: Optional[tuple[timedelta, ...]] = None,
        relearning_steps: Optional[tuple[timedelta, ...]] = None,
        enable_fuzzing: Optional[bool] = None,
    ):
        # Base class does not store, but subclasses may use these
        pass

    @staticmethod
    def factory(
        alg_type: AlgorithmType,
        weights: Tuple[float, ...],
        desired_retention: float,
        maximum_interval: int,
        learning_steps: tuple[timedelta, ...],
        relearning_steps: tuple[timedelta, ...],
        enable_fuzzing: bool,
    ) -> "SpacedRepetitionScheduler":
        if learning_steps is not None:  # type: ignore
            if not all(isinstance(step, timedelta) for step in learning_steps):  # type: ignore
                raise TypeError("All learning_steps must be of type timedelta")
        if relearning_steps is not None:  # type: ignore
            if not all(isinstance(step, timedelta) for step in relearning_steps):  # type: ignore
                raise TypeError("All relearning_steps must be of type timedelta")
        if alg_type == AlgorithmType.SM2:
            return SM2Scheduler()
        elif alg_type == AlgorithmType.FSRS:
            return FSRScheduler(
                fsrs_weights=weights,
                request_retention=desired_retention,
                maximum_interval=maximum_interval,
                learning_steps=learning_steps,
                relearning_steps=relearning_steps,
                enable_fuzzing=enable_fuzzing,
            )
        else:
            raise ValueError(f"Unknown algorithm type: {alg_type}")

    def first_review(
        self, quality: int, practiced: datetime, quality_text: Optional[str] = None
    ) -> ReviewResultDict:
        raise NotImplementedError

    def review(
        self,
        quality: int,
        easiness: float,
        interval: int,
        repetitions: int,
        practiced: datetime,
        stability: Optional[float] = None,
        difficulty: Optional[float] = None,
        step: Optional[int] = None,
        last_review: Optional[datetime] = None,
    ) -> ReviewResultDict:
        raise NotImplementedError


class SM2Scheduler(SpacedRepetitionScheduler):
    """
    Scheduler implementing the SM2 (SuperMemo 2) spaced repetition algorithm.
    """

    def __init__(self):
        super().__init__()

    def first_review(
        self, quality: int, practiced: datetime, quality_text: Optional[str] = None
    ) -> ReviewResultDict:
        _ = (quality_text,)
        result = sm_two.first_review(quality, practiced)
        return {
            "id": None,
            "quality": quality,
            "easiness": result["easiness"],
            "difficulty": None,
            "interval": result["interval"],
            "step": None,
            "repetitions": result["repetitions"],
            "review_datetime": (
                str(result["review_datetime"])
                if "review_datetime" in result
                else str(practiced)
            ),
            "review_duration": None,
        }

    def review(
        self,
        quality: int,
        easiness: float,
        interval: int,
        repetitions: int,
        practiced: datetime,
        stability: Optional[float] = None,
        difficulty: Optional[float] = None,
        step: Optional[int] = None,
        last_review: Optional[datetime] = None,
    ) -> ReviewResultDict:
        _ = (stability, difficulty, step, last_review)
        result = sm_two.review(quality, easiness, interval, repetitions, practiced)
        return {
            "id": None,
            "quality": quality,
            "easiness": result["easiness"],
            "difficulty": None,
            "interval": result["interval"],
            "step": None,
            "repetitions": result["repetitions"],
            "review_datetime": (
                str(result["review_datetime"])
                if "review_datetime" in result
                else str(practiced)
            ),
            "review_duration": None,
        }


class FSRScheduler(SpacedRepetitionScheduler):
    """
    Scheduler implementing the FSRS (Free Spaced Repetition Scheduler) algorithm.
    """

    def __init__(
        self,
        fsrs_weights: Tuple[float, ...],
        request_retention: float,
        maximum_interval: int,
        learning_steps: tuple[timedelta, ...],
        relearning_steps: tuple[timedelta, ...],
        enable_fuzzing: bool,
    ):
        super().__init__(
            weights=fsrs_weights,
            desired_retention=request_retention,
            maximum_interval=maximum_interval,
            learning_steps=learning_steps,
            relearning_steps=relearning_steps,
            enable_fuzzing=enable_fuzzing,
        )
        self.scheduler = Scheduler(
            parameters=fsrs_weights,
            desired_retention=request_retention,
            learning_steps=learning_steps,
            relearning_steps=relearning_steps,
            maximum_interval=maximum_interval,
            enable_fuzzing=enable_fuzzing,
        )

    def first_review(
        self,
        quality: int,
        practiced: datetime,
        quality_text: Optional[str] = None,
    ) -> ReviewResultDict:
        if quality_text == NEW:
            state = State.Learning
        elif quality_text == RESCHEDULED:
            state = State.Relearning
        else:
            state = State.Review
        # Set initial difficulty to 1.0 to avoid ZeroDivisionError in FSRS calculations
        #     Attributes:
        # card_id: The id of the card. Defaults to the epoch milliseconds of when the card was created.
        # state: The card's current learning state.
        # step: The card's current learning or relearning step or None if the card is in the Review state.
        # stability: Core mathematical parameter used for future scheduling.
        # difficulty: Core mathematical parameter used for future scheduling.
        # due: The date and time when the card is due next.
        # last_review: The date and time of the card's last review.
        card = Card(state=state, difficulty=1.0, stability=1.0, due=practiced, step=0)
        rating = self._quality_to_fsrs_rating(quality)
        card_reviewed, review_log = self.scheduler.review_card(
            card, rating, review_datetime=practiced
        )
        card_reviewed.due = practiced  # Ensure the due date is set to the sitdown date
        return self._review_result(card_reviewed, review_log)

    @staticmethod
    def _e_factor_to_difficulty(e_factor: float) -> float:
        normalized_e = (e_factor - 1.3) / (2.5 - 1.3)
        inverted_e = 1 - normalized_e
        d = 1 + inverted_e * 9
        return float(round(d))

    def review(
        self,
        quality: int,
        easiness: float,
        interval: int,
        repetitions: int,
        practiced: datetime,
        stability: Optional[float] = None,
        difficulty: Optional[float] = None,
        step: Optional[int] = None,
        last_review: Optional[datetime] = None,
    ) -> ReviewResultDict:
        # Use all arguments to avoid linter/type checker warnings
        _ = (easiness, interval, repetitions, stability, difficulty, step, last_review)
        if difficulty is None or difficulty == 0.0:
            if easiness > 0:
                difficulty = FSRScheduler._e_factor_to_difficulty(easiness)
            else:
                difficulty = 1.0
        assert difficulty is not None, "Difficulty must be set for FSRS review"
        assert difficulty > 0, "Difficulty must be greater than zero for FSRS review"
        card = Card(
            state=State.Review,
            step=step,
            stability=stability if stability is not None else 1.0,
            difficulty=difficulty,
            due=practiced,
            last_review=last_review,
        )
        rating = self._quality_to_fsrs_rating(quality)
        card_reviewed, review_log = self.scheduler.review_card(card, rating)
        return self._review_result(card_reviewed, review_log)

    @staticmethod
    def _quality_to_fsrs_rating(quality_int: int) -> Rating:
        """Convert quality value to FSRS Rating.

        This expects normalized 6-value quality input (0-5 scale):
        - 0,1 -> Again
        - 2 -> Hard
        - 3 -> Good
        - 4,5 -> Easy
        """
        if quality_int in (0, 1):
            return Rating.Again
        elif quality_int == 2:
            return Rating.Hard
        elif quality_int == 3:
            return Rating.Good
        elif quality_int in (4, 5):
            return Rating.Easy
        else:
            raise ValueError(f"Unexpected quality value: {quality_int}")

    @staticmethod
    def _difficulty_to_e_factor(d: float) -> float:
        normalized_d = (d - 1) / 9
        inverted_d = 1 - normalized_d
        e_factor = 1.3 + inverted_d * (2.5 - 1.3)
        return e_factor

    @staticmethod
    def _review_result(card_reviewed: Card, review_log: ReviewLog) -> ReviewResultDict:
        return {
            "id": getattr(card_reviewed, "card_id", None),
            "quality": review_log.rating,
            "easiness": (
                FSRScheduler._difficulty_to_e_factor(card_reviewed.difficulty)
                if card_reviewed.difficulty is not None
                else 0
            ),
            "difficulty": (
                card_reviewed.difficulty if card_reviewed.difficulty is not None else 0
            ),
            "interval": getattr(card_reviewed, "interval", 0),
            "step": getattr(card_reviewed, "step", 0),
            "repetitions": getattr(card_reviewed, "repetitions", 0),
            "review_datetime": str(card_reviewed.due),
            "review_duration": review_log.review_duration if review_log else None,
        }
