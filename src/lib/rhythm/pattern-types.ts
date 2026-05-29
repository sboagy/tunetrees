export interface RhythmPatternRequest {
  genreId?: string | null;
  genreName?: string | null;
  tuneTypeName?: string | null;
  tuneId?: string | null;
  userId?: string | null;
  selectedPatternId?: string | null;
}

export type RhythmPatternType = "seed" | "full_track";

export interface SwingDescriptor {
  timeSignature: string;
  macroBeatDivision: number;
  defaultSwingFactor: number;
  balanceRemainingNotes: boolean;
  velocityPattern: number[];
  humanizationDeltaMs: number;
}

export type RhythmPatternCandidateScope =
  | "user_tune"
  | "tune_default"
  | "user_default"
  | "system_default"
  | "system_pattern";

export interface RhythmPatternCandidate {
  id: string;
  name: string;
  scope: RhythmPatternCandidateScope;
  patternType: RhythmPatternType;
  sampleKit: string;
  hasPremiumAudio: boolean;
}

export interface RhythmPatternMetadata {
  genreName: string | null;
  genreId?: string | null;
  tuneTypeName: string;
  tuneTypeId?: string | null;
  rhythmAbc: string;
  rhythmSignature: string | null;
  tuneStructure?: string | null;
  patternType: RhythmPatternType;
  tempoQpm: number;
  swingPercentage: number;
  swingDescriptor?: SwingDescriptor | null;
  sampleKit: string;
  premiumAudioUrl: string | null;
  premiumAudioTrimMs: number;
  premiumAudioSource: "database" | null;
  premiumAudioSourceTempoQpm: number | null;
  source: "rhythm_patterns" | "tune_type_fallback";
  selectedPatternId?: string | null;
  patternCandidates?: RhythmPatternCandidate[];
}
