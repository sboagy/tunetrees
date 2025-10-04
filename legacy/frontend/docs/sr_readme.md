# Spaced Repetition Terminology

This document defines the spaced repetition terminology used throughout the TuneTrees application. For general application terms, see `terminology_guide.md`.

## Core Spaced Repetition Concepts

### Spaced Repetition
A learning technique that involves increasing intervals of time between subsequent reviews of previously learned material to exploit the psychological spacing effect.

### Interval
The number of days between practice sessions for a specific tune. This value increases as the user demonstrates better retention.

### Repetitions
The number of times a tune has been successfully reviewed. This count increases with each successful practice session.

### Review Date
The calculated date when a tune should next be practiced, based on the spaced repetition algorithm.

### Easiness Factor
A multiplier that determines how much the interval increases after successful reviews. Higher values mean longer intervals between reviews.

### Forgetting Curve
The exponential decline of memory retention over time, which spaced repetition aims to counteract.

### Retention
The ability to recall and perform a tune after a given interval without practice.

## Practice Assessment Terms

### Recall Evaluation
The user's self-assessment of how well they remembered a tune during practice, used to adjust future review scheduling.

### Quality Rating
A numerical score (typically 1-5) indicating the user's performance:
- 1-2: Poor recall, needs frequent review
- 3: Adequate recall with some difficulty
- 4: Good recall with minor issues
- 5: Perfect recall and performance

### Feedback
User input about their practice performance, used by the algorithm to schedule future reviews.

## Scheduling Terms

### Scheduling Algorithm
The mathematical formula used to determine when tunes should be reviewed next, based on SuperMemo-style algorithms.

### Review Session
A structured practice period where users work through tunes that are due for review.

### Due Date
The date when a tune becomes available for review according to the spaced repetition schedule.

### Overdue
Tunes that have passed their scheduled review date and should be prioritized for practice.

## Algorithm Parameters

### Initial Interval
The first interval assigned to a new tune, typically 1-3 days.

### Minimum Interval
The shortest possible interval between reviews, usually 1 day.

### Easiness Adjustment
How much the easiness factor changes based on user performance during practice.

### Interval Multiplier
The factor by which the interval increases after successful reviews.

## Implementation Details

### SuperMemo Algorithm
The family of spaced repetition algorithms that TuneTrees is based on, originally developed by Piotr Wozniak.

### Review Scheduler
The backend service responsible for calculating when tunes should be reviewed next.

### Practice Record
The database record storing the history of practice sessions for each tune.

### Backup Practiced Date
A fallback date used when the main practice date is unavailable or corrupted.

---

*This terminology guide follows established conventions in spaced repetition research and software development. For implementation details, see the codebase documentation.*
