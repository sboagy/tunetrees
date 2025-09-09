// Helper to build the inline sitdown date bootstrap script injected by practice/page.tsx
// Keeps logic testable & linted instead of embedding a long template literal inline.
// NOTE: Intentionally uses compact output to minimize payload size.
export function buildSitdownBootstrap(rawParam: string): string {
  // Inner function is fully parsed & typechecked; serialized for inline execution.
  function __ttSitdownBootstrap(p: string) {
    try {
      if (typeof window === "undefined") return;
      const w = window as typeof window & {
        __TT_REVIEW_SITDOWN_DATE__?: string;
      };
      if (p === "reset") {
        localStorage.removeItem("TT_REVIEW_SITDOWN_DATE");
        localStorage.removeItem("TT_REVIEW_SITDOWN_MANUAL");
        w.__TT_REVIEW_SITDOWN_DATE__ = undefined;
        return;
      }
      const [iso, mode] = p.split(",");
      if (!iso) return;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return;
      w.__TT_REVIEW_SITDOWN_DATE__ = iso;
      localStorage.setItem("TT_REVIEW_SITDOWN_DATE", iso);
      if (mode === "auto") {
        localStorage.removeItem("TT_REVIEW_SITDOWN_MANUAL");
      } else {
        localStorage.setItem("TT_REVIEW_SITDOWN_MANUAL", "true");
      }
    } catch (error) {
      console.warn("[SSR sitdown bootstrap failed]", error);
    }
  }
  return `(${__ttSitdownBootstrap.toString()})(${JSON.stringify(rawParam)});`;
}
