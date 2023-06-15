#! /usr/bin/env python

# Attribution: https://github.com/clockzhong/OpenSuperMemo/blob/master/SM2/Src/SM2.py

from typing import Dict, Any
from datetime import datetime

vote_types = [
    "failed",
    "barely",
    "struggled",
    "easy",
    "trivial",
    "perfect"]


# noinspection PyPep8,PyPep8Naming,PyPep8Naming,PyRedundantParentheses
class Card(object):
    minimum_practice_interval_hours = 6
    barely_know_interval_minutes = 10

    def __init__(self, card_data: Dict[str, Any]):
        self.card_data = card_data
        if card_data.get("ef") is None:
            self.EF = 2.0  # init the EF(Easiness Factor) value to 2.0

            # The first interval is 1 day(24*3600secs), and the second interval is 6 days, I(1)=1
            self.interval = 1 * 24 * 3600

            # I use needRelearn to indicate whether the user need re-study this entry after answer() it
            # The following is copied from sm2.html,
            # "After each repetition session of a given day repeat again all items that scored below four
            # in the quality assessment. Continue the repetitions until all of these items score at least four."
            self.needRelearn = False
        else:
            self.EF = card_data.get("ef")
            self.interval = card_data.get("interval")
            self.needRelearn = card_data.get("relearn")

    def updateEF(self, easiness):
        newEF = self.EF + (0.1 - (5 - easiness) * (0.08 + (5 - easiness) * 0.02))
        if (newEF < 1.3):
            newEF = 1.3
        self.EF = newEF
        return self.EF

    def updateInterval(self) -> int:
        if self.interval == 1 * 24 * 3600:
            self.interval = 6 * 24 * 3600  # I(2)=6
        else:
            self.interval = int(self.interval * self.EF)
        return self.interval

    @staticmethod
    def get_easiness(vote: str) -> int:
        global vote_types
        vote_id = vote_types.index(vote)
        return vote_id

    def answer(self, easiness):
        if (easiness < 3):
            self.interval = 1 * 24 * 3600  # when the user response as 0,1 or 2, we need restart the SR process
            self.EF = 2.0  # I don't think the EF need to be reset, but SM2 request it clearly
            self.needRelearn = True
        else:
            # should we use the newer EF to calculate the next interval? if yes, we need switch the following lines,
            # if not, just keep it as following. According to my understanding
            # on the https://www.supermemo.com/english/ol/sm2.htm
            # It's very possible that we need use the old EF value to calculate the next interval, and the new EF value
            # need be used in the NEXT NEXT interval's calculation
            self.updateInterval()
            self.updateEF(easiness)

            # check whether we need relearn this card today
            if (easiness < 4):
                self.needRelearn = True
            else:
                self.needRelearn = False

        self.card_data["ef"] = self.EF
        self.card_data["interval"] = self.interval
        self.card_data["relearn"] = self.needRelearn
        self.card_data["timestamp"] = datetime.now().timestamp()

    @staticmethod
    def floor_to_hours_interval(timestamp: float, hours_interval=24.00) -> float:
        seconds_in_interval = hours_interval * (60 * 60)
        partial_day_in_seconds = timestamp % seconds_in_interval
        rounded_time_to_day = timestamp - partial_day_in_seconds
        return rounded_time_to_day

    def should_practice_now(self) -> bool:
        """Tell if this card should be practiced now"""
        interval_in_seconds = self.card_data.get("interval")
        if interval_in_seconds is None:
            # If no interval, then we know it hasn't been practiced or accessed
            should_learn_now = True
        else:
            last_practice_time = self.card_data["timestamp"]
            next_practice_time = last_practice_time + interval_in_seconds
            now_in_seconds = datetime.now().timestamp()
            # Round down to nth hour increments, to avoid having to wait full 24 hours, to
            # account for somewhat arbitrary practice times.  I'm making this up as I go, so,
            # we'll see if it works. -sb
            next_practice_time_adjusted = Card.floor_to_hours_interval(next_practice_time,
                                                                       Card.minimum_practice_interval_hours)
            should_learn_now = now_in_seconds >= next_practice_time_adjusted

            if not should_learn_now:
                if (self.needRelearn):
                    if now_in_seconds >= (last_practice_time + (60 * self.barely_know_interval_minutes)):
                        should_learn_now = True
        return should_learn_now


if __name__ == '__main__':
    seconds_in_day = 24 * (60 * 60)
    # last_review_date = datetime.now().timestamp()
    last_review_date = 1563851571.450981
    print(datetime.utcfromtimestamp(last_review_date))
    interval = 86400
    # interval = seconds_in_day / 4
    next_practice_date = last_review_date + interval
    print(datetime.utcfromtimestamp(next_practice_date))
    next_practice_date_rounded = Card.floor_to_hours_interval(next_practice_date,
                                                              Card.minimum_practice_interval_hours)
    print(datetime.utcfromtimestamp(next_practice_date_rounded))
