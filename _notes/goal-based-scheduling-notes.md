User: For the TuneTrees app each tune in the users repertoire can be associated with a specific goal, and then those goals can be matched with a scheduling algorithm. Goals are initial_learn, fluency, session_ready, performance_polish, and recall (per #file:fsrs-service.ts:50-61 ). FSRS is for recall. and perhaps it should be used for initial learning.  Note the base intervals, which gives some progression for the goals when not using FSRS.  However, those are referenced by #sym:calculateGoalSpecificDue , which is not currently used.  Also note that per #file:Index.tsx:741-750 it seems the goal and technique are hard-coded for the moment.

Are there other science based goal-specific scheduling algorithms you can suggest, that can be applied to those goals, that are more targeted for the goals?

GitHub Copilot: # Goal-Specific Scheduling Algorithms for TuneTrees

Great question. The current `calculateGoalSpecificDue` uses a simple step-ladder heuristic. Here are science-based alternatives better matched to each goal:

---

## `initial_learn` — Spaced Practice / Blocked vs. Interleaved

**Algorithm: Expanding Retrieval Practice (Landauer & Bjork, 1978)**

The first exposures should use *expanding intervals* (not uniform), as retrieval difficulty that is *slightly* too hard maximizes encoding. FSRS is actually appropriate here too, but with a **much lower target retention** (e.g., 0.70 vs. 0.95) to force more frequent revisits.

> Suggested: Run FSRS with `request_retention = 0.70` and short learning steps (e.g., `["1m", "5m", "1d"]`). This is scientifically sounder than the fixed `[0.1, 0.5, 1, 2, 4]` ladder.

---

## `fluency` — Distributed Practice Law

**Algorithm: Power Law of Practice (Newell & Rosenbloom, 1981)**

Fluency improves as a power function of practice repetitions. Intervals should grow sub-linearly based on accumulated practice time, not just repetition count.

**Formula:**
```
interval(n) = a * n^b
```
Where `n` = practice session count, `a` ≈ 1.5 days, `b` ≈ 0.6 (slightly sub-linear growth).

This produces: `1.5, 2.2, 2.8, 3.3, 3.8...` days — denser early, then spreading, which matches how fluency actually develops.

---

## `session_ready` — Contextual Interference / Pre-performance Spacing

**Algorithm: Pre-performance Consolidation Window**

Motor learning research (Shadmehr & Brashers-Krug, 1997; Brashers-Krug et al., 1996) shows a **4–6 hour consolidation window** after motor practice where interference disrupts encoding. For "session ready" material (tunes that need to be performance-ready *soon*), the optimal strategy is:

- **Short-term:** Block practice within a session (same tune multiple times), then don't touch until the next day.
- **Spacing:** Fixed 1-day intervals until 3 days before the target date, then daily.

> Suggested: A **deadline-aware scheduler** — the due date counts *backward* from the performance date rather than forward from last practice.

---

## `performance_polish` — Deliberate Practice Spacing

**Algorithm: Contextual Interference Effect (Shea & Morgan, 1979) + Quality Threshold**

For high-quality refinement, spacing should be **quality-gated**: intervals only expand when the *quality* of a session exceeds a threshold. Below threshold, interval resets to a short value. This mirrors how performance coaches structure refinement.

**Formula:**
```
if quality >= threshold:
    interval = previous_interval * growth_factor  // e.g., 1.5x
else:
    interval = penalty_interval  // e.g., 2 days flat
```

This prevents performance-polish sessions from advancing on mediocre run-throughs, unlike FSRS which will still reduce difficulty.

---

## `recall` — Already FSRS ✓

FSRS with `request_retention = 0.95` is well-suited here. No change needed.

---

## Summary Table

| Goal | Algorithm | Key Insight |
|---|---|---|
| `initial_learn` | FSRS @ 70% retention | Desirable difficulty for encoding |
| `fluency` | Power Law of Practice | Sub-linear interval growth matching skill curve |
| `session_ready` | Deadline-aware / consolidation window | Backward from event date, 1-day fixed spacing near deadline |
| `performance_polish` | Quality-gated interval scaling | No advancement on mediocre sessions |
| `recall` | FSRS @ 95% retention | Already implemented ✓ |

---

## Practical Recommendation for TuneTrees

The **most impactful near-term change** would be:

1. **`initial_learn`**: Re-use the existing FSRS scheduler instance but parameterized with lower retention. Since `FSRSService` is already instantiated per-user-session, you could accept a `goalOverrides` map in the constructor that overrides `request_retention` per goal.

2. **`fluency`**: Replace the fixed `[1,3,7,14,21]` ladder in `GOAL_BASE_INTERVALS` with the power-law formula in `calculateGoalSpecificDue`.

3. **`session_ready` / `performance_polish`**: These benefit from a `targetDate` field on the repertoire-tune association (a "performance date"), which would need a schema addition — but runtime-wise the scheduling math is simple once that date is available.

Would you like me to implement any of these algorithms in fsrs-service.ts, or sketch the schema change needed for deadline-aware scheduling?
