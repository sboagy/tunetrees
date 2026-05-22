export const TUNE_TYPE_NAME_ALIASES: Record<string, string> = {
  air: "air",
  bdnce: "barn dance",
  "barn dance": "barn dance",
  hland: "highland",
  highland: "highland",
  hpipe: "hornpipe",
  hornpipe: "hornpipe",
  jigd: "jig",
  jig: "jig",
  "double jig": "jig",
  jigsl: "slip jig",
  "slip jig": "slip jig",
  sgjig: "jig (single)",
  "single jig": "jig (single)",
  "jig (single)": "jig (single)",
  mzrka: "mazurka",
  mazurka: "mazurka",
  piece: "piece",
  polka: "polka",
  reel: "reel",
  sgreel: "reel",
  schot: "schottische",
  schottische: "schottische",
  setd: "set dance",
  "set dance": "set dance",
  slide: "slide",
  song: "song",
  strath: "strathspey",
  strathspey: "strathspey",
  "three-two": "3/2 hornpipe",
  waltz: "waltz",
};

export const TUNE_TYPE_LOOKUP_VARIANTS: Record<string, readonly string[]> = {
  hpipe: ["Hpipe", "Hornpipe"],
  hornpipe: ["Hornpipe", "Hpipe"],
  jigd: ["JigD", "Jig", "Double Jig"],
  jig: ["Jig", "JigD", "Double Jig"],
  jigsl: ["JigSl", "Slip Jig"],
  "slip jig": ["Slip Jig", "JigSl"],
  sgjig: ["SgJig", "Jig (Single)", "Single Jig"],
  "single jig": ["Single Jig", "Jig (Single)", "SgJig"],
  "jig (single)": ["Jig (Single)", "Single Jig", "SgJig"],
  sgreel: ["SgReel", "Single Reel", "Reel"],
  reel: ["Reel", "SgReel", "Single Reel"],
  setd: ["SetD", "Set Dance"],
  "set dance": ["Set Dance", "SetD"],
  strath: ["Strath", "Strathspey"],
  strathspey: ["Strathspey", "Strath"],
};

export function normalizeTuneTypeName(value: string): string {
  const normalized = value.trim().toLowerCase();
  return TUNE_TYPE_NAME_ALIASES[normalized] ?? normalized;
}

export function getTuneTypeLookupCandidates(value: string): string[] {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  const variants = TUNE_TYPE_LOOKUP_VARIANTS[normalized] ?? [trimmed];

  return Array.from(
    new Set([trimmed, ...variants].filter((candidate) => candidate.trim()))
  );
}
