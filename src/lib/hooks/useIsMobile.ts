/**
 * useIsMobile
 *
 * Reactive hook that tracks whether the viewport is below the Tailwind `md`
 * breakpoint (768 px).  Updates automatically on viewport resize via
 * `window.matchMedia`.
 */

import { createSignal, onCleanup } from "solid-js";

const MOBILE_BREAKPOINT_PX = 768; // Tailwind `md`

/**
 * Returns a reactive boolean signal that is `true` when the viewport width
 * is strictly less than the `md` breakpoint (< 768 px).
 */
export function createIsMobile(): () => boolean {
  const query =
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`)
      : null;

  const [isMobile, setIsMobile] = createSignal(query ? query.matches : false);

  if (query) {
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    query.addEventListener("change", onChange);
    onCleanup(() => query.removeEventListener("change", onChange));
  }

  return isMobile;
}
