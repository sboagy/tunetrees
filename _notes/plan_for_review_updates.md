# Plan for consuming feedback, and scheduling next review, updating db, and refreshing review list

1. [x] Existing columns for scheduling:
       \# learned: str
       \# practiced: str # (last_due)
       \# feedback: int # (quality)
2. [x] Add new columns:
       \# easiness: float
       \# interval: int
       \# repetitions: int
       \# scheduled_due: str
3. [x] Define view of tune+playlist_tune+practice_record
       Issue: multiple practice_records per tune (pick most recent)
4. [ ] Figure out top 10 (or n) tunes on schedule:
   1. schedule all tunes:
      if scheduled_due is empty
      if last_due is not empty:
      scheduled_due = SMTwo.first_review(0, last_due)
      else:
      scheduled_due = today
   2. sort tunes by scheduled_due, oldest first
   3. slice oldest n tunes
5. [ ] Figure out most recently played:
       Sort by last_due, newest first
6. [ ] Text entry box, number tunes to practice (defaults to 10)
       Will require cookie storage or remembering in some form on browser?
       Or, just get the value from the input box?
