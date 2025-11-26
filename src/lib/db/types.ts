/**
 * TypeScript Types for TuneTrees Data Models
 *
 * Type definitions inferred from Drizzle schema plus additional interfaces
 * for common data operations and view models.
 *
 * @module lib/db/types
 */

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type * as schema from "./schema";

// ============================================================================
// Inferred Types from Schema
// ============================================================================

// Select types (reading from database)
export type User = InferSelectModel<typeof schema.userProfile>;
export type Tune = InferSelectModel<typeof schema.tune>;
export type Playlist = InferSelectModel<typeof schema.playlist>;
export type PlaylistTune = InferSelectModel<typeof schema.playlistTune>;
export type Note = InferSelectModel<typeof schema.note>;
export type Reference = InferSelectModel<typeof schema.reference>;
export type Tag = InferSelectModel<typeof schema.tag>;
export type PracticeRecord = InferSelectModel<typeof schema.practiceRecord>;
export type PrefsSpacedRepetition = InferSelectModel<
  typeof schema.prefsSpacedRepetition
>;
export type PrefsSchedulingOptions = InferSelectModel<
  typeof schema.prefsSchedulingOptions
>;
export type DailyPracticeQueue = InferSelectModel<
  typeof schema.dailyPracticeQueue
>;
export type TuneOverride = InferSelectModel<typeof schema.tuneOverride>;
export type Genre = InferSelectModel<typeof schema.genre>;
export type Instrument = InferSelectModel<typeof schema.instrument>;
export type TuneType = InferSelectModel<typeof schema.tuneType>;
// export type UserAnnotationSet = InferSelectModel<
//   typeof schema.userAnnotationSet
// >;
export type SyncQueueItem = InferSelectModel<typeof schema.syncQueue>;

// Insert types (creating new records)
export type NewUser = InferInsertModel<typeof schema.userProfile>;
export type NewTune = InferInsertModel<typeof schema.tune>;
export type NewPlaylist = InferInsertModel<typeof schema.playlist>;
export type NewPlaylistTune = InferInsertModel<typeof schema.playlistTune>;
export type NewNote = InferInsertModel<typeof schema.note>;
export type NewReference = InferInsertModel<typeof schema.reference>;
export type NewTag = InferInsertModel<typeof schema.tag>;
export type NewPracticeRecord = InferInsertModel<typeof schema.practiceRecord>;
export type NewPrefsSpacedRepetition = InferInsertModel<
  typeof schema.prefsSpacedRepetition
>;
export type NewPrefsSchedulingOptions = InferInsertModel<
  typeof schema.prefsSchedulingOptions
>;
export type NewDailyPracticeQueue = InferInsertModel<
  typeof schema.dailyPracticeQueue
>;
export type NewTuneOverride = InferInsertModel<typeof schema.tuneOverride>;
export type NewGenre = InferInsertModel<typeof schema.genre>;
export type NewInstrument = InferInsertModel<typeof schema.instrument>;
export type NewTuneType = InferInsertModel<typeof schema.tuneType>;
// export type NewUserAnnotationSet = InferInsertModel<
//   typeof schema.userAnnotationSet
// >;
export type NewSyncQueueItem = InferInsertModel<typeof schema.syncQueue>;
// Normalized user scheduling options used across services
export interface IUserSchedulingOptions {
  userId: string;
  acceptableDelinquencyWindow: number;
  minReviewsPerDay: number;
  maxReviewsPerDay: number;
  daysPerWeek: number | null;
  weeklyRules: string | null;
  exceptions: string | null;
}

// ============================================================================
// View Models & Joined Data
// ============================================================================

/**
 * Tune with associated data for display in lists
 */
export interface TuneWithDetails extends Tune {
  // Metadata counts
  noteCount?: number;
  referenceCount?: number;
  tagCount?: number;
  playlistCount?: number;

  // Latest practice info
  lastPracticed?: string;
  practiceCount?: number;
  averageQuality?: number;

  // Genre name (instead of just ID)
  genreName?: string;
}

/**
 * Playlist with tune count and other summary data
 */
export interface PlaylistWithSummary extends Playlist {
  tuneCount: number;
  lastModified?: string;
  instrumentName?: string;
  genreName?: string;
}

/**
 * Tune in a playlist context (for practice queue)
 */
export interface PlaylistTuneWithDetails {
  // PlaylistTune fields
  playlist_ref: string; // UUID
  tune_ref: string; // UUID
  deleted: boolean | null;
  current: string | null;

  // Tune fields
  tune: Tune;

  // Practice scheduling data
  nextReview?: string;
  dueIn?: number; // days until due
  state?: number; // FSRS state
  difficulty?: number;
  stability?: number;

  // User notes and tags
  notes?: Note[];
  tags?: Tag[];
}

/**
 * Practice record with tune information
 */
export interface PracticeRecordWithTune extends PracticeRecord {
  tune: Tune;
  playlistName?: string;
}

// ============================================================================
// Form & Input Types
// ============================================================================

/**
 * Input for creating a new tune
 */
export interface CreateTuneInput {
  title: string;
  type?: string;
  mode?: string;
  structure?: string;
  incipit?: string;
  genre?: string; // UUID
  privateFor?: string; // User UUID (was integer)
}

/**
 * Input for updating an existing tune
 */
export interface UpdateTuneInput extends Partial<CreateTuneInput> {
  id: string; // UUID (was integer)
}

/**
 * Input for creating a new playlist
 */
export interface CreatePlaylistInput {
  user_ref: string; // User UUID
  instrument?: string; // UUID
  genre?: string; // UUID
  annotation_set_ref?: string; // UUID (was integer)
}

/**
 * Input for updating a playlist
 */
export interface UpdatePlaylistInput extends Partial<CreatePlaylistInput> {
  id: string; // UUID (renamed from playlist_id)
}

/**
 * Input for adding a tune to a playlist
 */
export interface AddTuneToPlaylistInput {
  playlist_ref: string; // UUID (was integer)
  tune_ref: string; // UUID (was integer)
}

// ============================================================================
// Search & Filter Types
// ============================================================================

/**
 * Filters for tune search
 */
export interface TuneSearchFilters {
  query?: string; // Search in title, incipit
  type?: string;
  mode?: string;
  genre?: string;
  tags?: string[];
  onlyFavorites?: boolean;
  onlyPrivate?: boolean;
  userId?: string; // User UUID
}

/**
 * Sort options for tune lists
 */
export type TuneSortField =
  | "title"
  | "type"
  | "mode"
  | "genre"
  | "lastPracticed"
  | "practiceCount"
  | "created";

export type SortDirection = "asc" | "desc";

export interface TuneSortOptions {
  field: TuneSortField;
  direction: SortDirection;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * Sync status for a record
 */
export type SyncStatus = "synced" | "pending" | "conflict" | "error";

/**
 * Sync metadata
 */
export interface SyncMetadata {
  sync_version: number;
  last_modified_at: string;
  device_id: string;
  sync_status?: SyncStatus;
}

/**
 * Record with sync metadata
 */
export interface SyncableRecord {
  sync_version: number;
  last_modified_at: string | null;
  device_id: string | null;
}

/**
 * Sync conflict
 */
export interface SyncConflict<T extends SyncableRecord> {
  local: T;
  remote: T;
  resolvedValue?: T;
}

// ============================================================================
// FSRS Scheduling Types
// ============================================================================

export type { Card as FSRSCard, RecordLog } from "ts-fsrs";
/**
 * FSRS card state (matches ts-fsrs library)
 * Re-exported from ts-fsrs for convenience
 */
export { Rating as FSRSRating, State as FSRSState } from "ts-fsrs";

/**
 * Practice record with tune information
 */
export interface PracticeRecordWithTune extends PracticeRecord {
  tune: Tune;
  playlistName?: string;
}

/**
 * Input for recording a practice session
 */
export interface RecordPracticeInput {
  playlistRef: string; // UUID (was integer)
  tuneRef: string; // UUID (was integer)
  quality: number; // Rating quality (1-4 for FSRS: Again, Hard, Good, Easy)
  practiced: Date; // Practice session date/time
  goal?: string; // Practice goal (recall, initial_learn, fluency, etc.)
  technique?: string; // Practice technique (daily_practice, motor_skills, metronome, etc.)
}

/**
 * FSRS scheduling parameters for a tune
 */
export interface TuneSchedulingInfo {
  stability: number | null;
  difficulty: number | null;
  elapsed_days: number | null;
  state: number | null; // 0=New, 1=Learning, 2=Review, 3=Relearning
  due: string | null; // ISO date string
  repetitions: number | null;
  lapses: number | null;
}

/**
 * Next review schedule calculation result from FSRS
 */
export interface NextReviewSchedule {
  nextDue: Date; // Next scheduled review date
  state: number; // FSRS state (0=New, 1=Learning, 2=Review, 3=Relearning)
  stability: number; // Memory stability
  difficulty: number; // Item difficulty
  elapsed_days: number; // Days since last review
  scheduled_days: number; // Days until next review
  reps: number; // Total repetitions
  lapses: number; // Number of lapses
  last_review: Date; // Last review date
  interval: number; // Interval in days (calculated)
}

/**
 * Practice queue entry with tune details
 */
export interface PracticeQueueEntry extends DailyPracticeQueue {
  tune: Tune;
  schedulingInfo?: TuneSchedulingInfo;
}

/**
 * Practice session summary
 */
export interface PracticeSessionSummary {
  totalTunes: number;
  completedTunes: number;
  averageQuality: number;
  sessionDuration: number; // minutes
  newTunes: number;
  reviewedTunes: number;
  relearnedTunes: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Omit sync and audit fields for cleaner types
 */
export type WithoutSyncFields<T> = Omit<
  T,
  "sync_version" | "last_modified_at" | "device_id"
>;

/**
 * Omit deleted flag for active records
 */
export type WithoutDeleted<T> = Omit<T, "deleted">;

/**
 * Make all fields optional except ID
 */
export type PartialExceptId<T extends { id: string }> = Partial<T> &
  Pick<T, "id">;
