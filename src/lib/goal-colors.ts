/** Shared categorical goal-identity palette (design-system V2 exception).
 * Keep identities stable across views; these colors never encode scheduling success. */
// ── Stable pastel color from name hash ──────────────────────────────────────

const NAMED_COLORS: Record<string, string> = {
  recall: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  notes:
    "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
  technique:
    "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
  backup:
    "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  initial_learn:
    "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  fluency: "bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200",
  session_ready: "bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200",
  performance_polish:
    "bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200",
};

// Simple deterministic hash → one of a discrete set of pastel palettes
const PASTEL_PALETTES = [
  "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200",
  "bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200",
  "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
  "bg-lime-100 dark:bg-lime-900 text-lime-800 dark:text-lime-200",
  "bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200",
  "bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200",
];

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = Math.trunc(Math.imul(31, h) + (name.codePointAt(i) ?? 0));
  }
  return Math.abs(h);
}

export function goalIdentityColors(name: string): string {
  if (Object.hasOwn(NAMED_COLORS, name)) return NAMED_COLORS[name];
  return PASTEL_PALETTES[nameHash(name) % PASTEL_PALETTES.length];
}
