/** Identity of the local runtime that a sync completion is allowed to affect. */
export interface SyncCompletionOwner {
  userId: string | null;
  database: object | null;
  service: object | null;
}

export function ownsActiveSync(
  owner: SyncCompletionOwner,
  active: SyncCompletionOwner
): boolean {
  return (
    owner.userId !== null &&
    owner.database !== null &&
    owner.service !== null &&
    owner.userId === active.userId &&
    owner.database === active.database &&
    owner.service === active.service
  );
}
