/** Keep related tune tasks anchored to their invoking view, rather than making
 * History and Edit each other's Close/Cancel destination. */
function isTuneTask(path: string): boolean {
  return /^\/tunes\/[^/]+\/(?:edit|practice-history)(?:[/?#]|$)/.test(path);
}

function readOrigin(state: unknown): string | undefined {
  if (!state || typeof state !== "object" || !("from" in state)) return;
  const from = state.from;
  if (
    typeof from === "string" &&
    from.startsWith("/") &&
    !from.startsWith("//") &&
    !isTuneTask(from)
  )
    return from;
}

export function tuneTaskOrigin(
  path: string,
  state: unknown,
  tuneId: string
): string {
  if (!isTuneTask(path)) return path;
  return readOrigin(state) ?? `/tunes/${tuneId}`;
}

export function tuneTaskReturn(
  state: unknown,
  tuneId: string | undefined
): string {
  return readOrigin(state) ?? (tuneId ? `/tunes/${tuneId}` : "/");
}

export type TuneTaskTrigger =
  | "sidebar-practice-history-link"
  | "sidebar-edit-tune-button"
  | "sidebar-edit-tune-button-collapsed";

function readTrigger(state: unknown): TuneTaskTrigger | undefined {
  if (!state || typeof state !== "object" || !("fromFocus" in state)) return;
  const value = state.fromFocus;
  if (
    value === "sidebar-practice-history-link" ||
    value === "sidebar-edit-tune-button" ||
    value === "sidebar-edit-tune-button-collapsed"
  )
    return value;
}

export function tuneTaskEntryState(
  path: string,
  state: unknown,
  tuneId: string,
  trigger: TuneTaskTrigger
) {
  return {
    from: tuneTaskOrigin(path, state, tuneId),
    fromFocus: isTuneTask(path) ? readTrigger(state) : trigger,
  };
}

export function tuneTaskReturnState(state: unknown) {
  return { restoreTuneTaskFocus: readTrigger(state) };
}
