/** Shared queue-consumption policy: preserve manual schedules changed after queue creation.
 * Kept independent of recording/scheduler orchestration for both Submit paths. */
function normalizeComparableTimestamp(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(" ", "T").substring(0, 19);
}

export function shouldClearConsumedScheduledOverride(input: {
  queueScheduledSnapshot: string | null | undefined;
  currentScheduled: string | null | undefined;
  queueGeneratedAt: string | null | undefined;
  repertoireTuneLastModifiedAt: string | null | undefined;
}): boolean {
  const queueScheduledSnapshot = normalizeComparableTimestamp(
    input.queueScheduledSnapshot
  );
  if (!queueScheduledSnapshot) {
    return false;
  }

  const currentScheduled = normalizeComparableTimestamp(input.currentScheduled);
  if (currentScheduled !== queueScheduledSnapshot) {
    return false;
  }

  const queueGeneratedAt = normalizeComparableTimestamp(input.queueGeneratedAt);
  const repertoireTuneLastModifiedAt = normalizeComparableTimestamp(
    input.repertoireTuneLastModifiedAt
  );

  if (!queueGeneratedAt || !repertoireTuneLastModifiedAt) {
    return true;
  }

  return repertoireTuneLastModifiedAt <= queueGeneratedAt;
}
