// In the following, id may be ommited in the case of a new tune.
// I might be better to use a base class for a new tune, and then

import type { TableState } from "@tanstack/react-table";
import type { JSX } from "react";

export type ScreenSize = "small" | "full";

export type TablePurpose = "practice" | "repertoire" | "catalog";

// Practice Goals Enums (matching backend)
export enum PracticeGoalEnum {
  INITIAL_LEARN = "initial_learn",
  RECALL = "recall",
  FLUENCY = "fluency",
  SESSION_READY = "session_ready",
  PERFORMANCE_POLISH = "performance_polish",
}

export enum PracticeTechniqueEnum {
  FSRS = "fsrs",
  SM2 = "sm2",
  DAILY_PRACTICE = "daily_practice",
  MOTOR_SKILLS = "motor_skills",
  METRONOME = "metronome",
  CUSTOM = "custom",
}

// Practice Goal display labels for UI
export const practiceGoalLabels: Record<PracticeGoalEnum, string> = {
  [PracticeGoalEnum.INITIAL_LEARN]: "Initial Learn",
  [PracticeGoalEnum.RECALL]: "Recall",
  [PracticeGoalEnum.FLUENCY]: "Fluency",
  [PracticeGoalEnum.SESSION_READY]: "Session Ready",
  [PracticeGoalEnum.PERFORMANCE_POLISH]: "Performance Polish",
};

// Practice Technique display labels for UI
export const practiceTechniqueLabels: Record<PracticeTechniqueEnum, string> = {
  [PracticeTechniqueEnum.FSRS]: "FSRS Algorithm",
  [PracticeTechniqueEnum.SM2]: "SM2 Algorithm",
  [PracticeTechniqueEnum.DAILY_PRACTICE]: "Daily Practice",
  [PracticeTechniqueEnum.MOTOR_SKILLS]: "Motor Skills",
  [PracticeTechniqueEnum.METRONOME]: "Metronome Practice",
  [PracticeTechniqueEnum.CUSTOM]: "Custom Approach",
};

export interface ITableTransientData {
  user_id: number;
  tune_id: number;
  playlist_id: number;
  purpose: string;
  note_private: string | null;
  note_public: string | null;
  recall_eval: string | null;
}

export interface ITableTransientDataFields {
  note_private: string | null;
  note_public: string | null;
  recall_eval: string | null;
}

// Define the type for the function parameters
export interface IFilteredDataParams {
  data: ITuneOverview[];
  criteria: (item: ITuneOverview) => boolean;
}

// Define the return type of the function
export type FilteredDataReturnType = ITuneOverview[];

// Create the type definition for the filteredData function
export type FilteredDataType = (
  params: IFilteredDataParams,
) => FilteredDataReturnType;

export type TunesGridColumnGeneralType =
  | string
  | number
  | null
  | JSX.Element
  | undefined;

export enum UpdateActionType {
  CREATE = "create",
  DELETE = "delete",
  UPDATE = "update",
}

export interface IReferenceData {
  tune_ref?: number;
  user_ref?: number;
  public: number | null;
  id?: number;
  url: string;
  ref_type: string;
  favorite: number | null;
  comment: string | null;
  title?: string;
  deleted?: boolean | false;
  isNew?: boolean;
}

export interface INote {
  id?: number;
  user_ref: number;
  tune_ref: number;
  playlist_ref?: number | null;
  created_date?: string | null;
  note_text: string | null;
  public: boolean | false;
  favorite: boolean | false;
  deleted?: boolean | false;
  isNew?: boolean;
}

export interface ITableStateTable {
  user_id: number;
  screen_size: ScreenSize;
  purpose: TablePurpose;
  playlist_id: number;
  settings: string | TableState;
  current_tune?: number | null;
}

export interface ITune {
  id?: number;
  title?: string | null;
  type?: string | null;
  structure?: string | null;
  private_for: number | null;
  mode?: string | null;
  incipit?: string | null;
  genre?: string | null;
  deleted?: boolean | false;
  private_for_user?: number | null;
}

export interface ITuneOverride {
  id: number;
  tune_ref: number;
  user_ref: number;
  title?: string | null;
  type?: string | null;
  structure?: string | null;
  genre?: string | null;
  mode?: string | null;
  incipit?: string | null;
  deleted?: boolean | false;
}

export interface ITuneOverview extends ITune {
  user_ref?: number | null;
  playlist_ref?: number | null;
  learned: string | null;
  latest_practiced: string | null;
  latest_quality: number | null;
  latest_easiness: number | null;
  latest_difficulty: number | null;
  latest_interval: number | null;
  latest_step: number | null;
  latest_repetitions: number | null;
  latest_review_date: string | null; // Historical data - use scheduled for current scheduling
  latest_backup_practiced?: string | null;
  external_ref?: string | null;
  tags?: string | null;
  recall_eval?: string | null;
  notes?: string | null;
  favorite_url?: string | null;
  playlist_deleted?: boolean | null;
  // Practice Goals fields (Issue #205)
  goal?: string | null;
  // Scheduled review date for this tune in this playlist (from playlist_tune table)
  scheduled?: string | null;
  // Latest technique from practice record (read-only display)
  latest_technique?: string | null;
  // Latest goal from practice record (read-only display)
  latest_goal?: string | null;
}

export interface ITuneOverviewImported extends ITuneOverview {
  import_url: string | null;
}

export interface IPracticeRecord {
  id: number;
  playlist_ref?: number;
  tune_ref?: number;
  practiced?: string;
  quality?: number;
  easiness?: number;
  difficulty: number;
  interval?: number;
  step: number;
  repetitions?: number;
  review_date?: string;
  backup_practiced?: string;
  stability?: number;
  elapsed_days?: number;
  lapses?: number;
  state?: number;
}

export interface ITuneOverviewScheduled extends ITuneOverview {
  recall_eval?: string | null;
  // Practice bucket classification supplied directly by backend (Aug 2025 refactor):
  // 1 = Due Today, 2 = Recently Lapsed, 3 = Backfill (older). Future/null = not in current snapshot.
  // Former client-side PracticeBucketContext + snapshot merge removed; UI now relies solely on this field.
  bucket?: number | null;
}

export interface IPlaylistTune {
  playlist_ref: number;
  tune_ref: number;
  current: string;
  learned: string;
  deleted?: boolean | null;
  goal?: string | null; // playlist-level goal (practice target)
}

export interface IPlaylist {
  playlist_id: number;
  user_ref: number;
  instrument_ref: number;
  deleted?: boolean | null;
  sr_alg_type?: string;
}

export interface IInstrument {
  id: number;
  private_to_user: number;
  instrument: string;
  description?: string;
  genre_default?: string;
  deleted?: boolean | null;
}

export interface ITTResponseInfo {
  success?: string;
  detail?: string;
}

export interface IGenre {
  id: string;
  name: string;
  description?: string;
  region?: string;
}

export interface IViewPlaylistJoined {
  playlist_id: number;
  user_ref: number;
  playlist_deleted: boolean;
  instrument_ref: number;
  private_to_user?: number;
  instrument: string;
  description?: string;
  genre_default?: string;
  instrument_deleted?: boolean;
}

// Daily Practice Queue (Phase 1) -------------------------------------------------
// Mirrors backend DailyPracticeQueueModel (fields kept optional where nullable)
export interface IPracticeQueueEntry {
  id: number;
  user_ref: number;
  playlist_ref: number;
  mode?: string | null;
  queue_date?: string | null;
  window_start_utc: string;
  window_end_utc: string;
  tune_ref: number;
  bucket: number; // 1=due today, 2=recently lapsed, 3=backfill
  order_index: number;
  snapshot_coalesced_ts: string;
  scheduled_snapshot?: string | null;
  latest_review_date_snapshot?: string | null;
  acceptable_delinquency_window_snapshot?: number | null;
  tz_offset_minutes_snapshot?: number | null;
  generated_at: string;
  completed_at?: string | null;
  exposures_required?: number | null;
  exposures_completed?: number | null;
  outcome?: string | null;
  active?: boolean | null;
  tune_title?: string | null; // added client-enriched field for display
  // Enriched tune metadata (optional)
  type?: string | null;
  structure?: string | null;
  learned?: string | null;
  scheduled?: string | null;
  latest_practiced?: string | null;
  latest_review_date?: string | null;
  latest_quality?: number | null;
  latest_easiness?: number | null;
  latest_interval?: number | null;
  latest_repetitions?: number | null;
  latest_difficulty?: number | null;
  latest_step?: number | null;
  latest_goal?: string | null;
  latest_technique?: string | null;
  tags?: string | null;
  notes?: string | null;
}

export interface IPracticeQueueWithMeta {
  entries: IPracticeQueueEntry[];
  // Count of tunes currently due (bucket 1) that are not present in snapshot (new since snapshot)
  new_tunes_due_count: number;
}

export interface IAccount {
  user_id: string;
  provider_account_id: string;
  provider: string;
  type: string; // Assuming AccountType is a string, adjust if necessary
  access_token?: string | null;
  token_type?: string | null;
  id_token?: string | null;
  scope?: string | null;
  expires_at?: number | null;
  session_state?: string | null;
  refresh_token?: string | null;
}

export interface ISession {
  expires?: string;
  session_token: string;
  user_id?: number;
}

export interface IUser {
  id?: number;
  name?: string;
  email?: string;
  email_verified?: string | null; // Assuming datetime is converted to string
  image?: string;
  hash?: string;
  sr_alg_type?: string;
  phone?: string;
  phone_verified?: string | null; // Assuming datetime is converted to string
  acceptable_delinquency_window?: number;
}

export interface IVerificationTokenParams {
  identifier: string;
  token: string;
}

export interface IVerificationToken {
  identifier: string;
  token: string;
  expires: string;
}

export interface IGenreTuneType {
  id: number;
  genre_id: number;
  tune_type_id: number;
}

export interface ITuneType {
  id: string;
  name: string;
  rhythm: string;
  description: string;
}

export interface IExtractedTuneInfo {
  incipit: string;
  structure: string;
}

export interface ITheSessionTuneSummary {
  name: string;
  url: string;
  type: string;
}

// Moved types from preferences.ts

/**
 * Enum for algorithm types
 */
export enum AlgorithmType {
  SM2 = "SM2",
  FSRS = "FSRS",
}

/**
 * Interface for spaced repetition preferences
 */
export interface IPrefsSpacedRepetitionBase {
  user_id: number;
  algorithm: AlgorithmType;
  fsrs_weights?: string;
  request_retention?: number;
  maximum_interval?: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IPrefsSpacedRepetitionCreate
  extends IPrefsSpacedRepetitionBase {
  // Inherits all fields from IPrefsSpacedRepetitionBase
}

export interface IPrefsSpacedRepetitionUpdate {
  algorithm?: AlgorithmType;
}

export type IPrefsSpacedRepetitionResponse = IPrefsSpacedRepetitionBase;
