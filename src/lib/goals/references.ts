/** Storage-independent identity rules shared by runtime and controlled backfills. */
export interface GoalIdentity {
  id: string;
  name: string;
  privateFor: string | null;
  deleted: boolean | number;
}

export class AmbiguousGoalReferenceError extends Error {
  constructor() {
    super("Ambiguous legacy goal identity");
  }
}

export interface GoalReference {
  goalId: string | null;
  goal: string | null;
}

/** IDs on history are final attribution; active legacy edits can supersede a stale ID. */
export function resolveGoalReference<T extends GoalIdentity>(
  goals: readonly T[],
  userId: string,
  reference: GoalReference,
  historical = false
): T | null {
  const visible = goals.filter(
    (row) => row.privateFor === null || row.privateFor === userId
  );
  const byId = visible.find((row) => row.id === reference.goalId);
  if (historical && reference.goalId !== null) return byId ?? null;
  if (reference.goalId !== null && !byId) return null;
  const key = reference.goal?.trim() || "recall";
  if (byId && (!reference.goal?.trim() || byId.name === key))
    return byId.deleted ? null : byId;
  const candidates = visible.filter(
    (row) => row.name === key && (historical || !row.deleted)
  );
  const owned = candidates.filter((row) => row.privateFor === userId);
  const preferred = owned.length ? owned : candidates;
  if (preferred.length > 1) throw new AmbiguousGoalReferenceError();
  return preferred[0] ?? null;
}
