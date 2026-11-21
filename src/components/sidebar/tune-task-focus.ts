import { useLocation } from "@solidjs/router";
import { createEffect, onCleanup } from "solid-js";

// A route's return request is consumed once, even if loading remounts its button.
const restored = new WeakSet<object>();

/** Register on the invoking button's ref. Wait for Solid's render to finish,
 * rather than guessing when route data and the sidebar will be available. */
export function registerTuneTaskFocus(element: HTMLButtonElement) {
  const location = useLocation();
  createEffect(() => {
    const state = location.state;
    if (
      !state ||
      typeof state !== "object" ||
      !("restoreTuneTaskFocus" in state) ||
      restored.has(state)
    )
      return;
    const target = state.restoreTuneTaskFocus;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    queueMicrotask(() => {
      if (
        cancelled ||
        location.state !== state ||
        restored.has(state) ||
        target !== element.dataset.testid ||
        !element.isConnected ||
        !element.getClientRects().length
      )
        return;
      element.focus({ preventScroll: true });
      if (document.activeElement === element) restored.add(state);
    });
  });
}
