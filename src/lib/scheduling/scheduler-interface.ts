/**
 * Scheduling interface contract for FSRS and plugin-backed schedulers.
 */

import type {
  IUserSchedulingOptions,
  NextReviewSchedule,
  PracticeRecord,
  PrefsSpacedRepetition,
  RecordPracticeInput,
} from "../db/types";

export interface SchedulingService {
  processFirstReview(input: RecordPracticeInput): Promise<NextReviewSchedule>;
  processReview(
    input: RecordPracticeInput,
    latestRecord: PracticeRecord
  ): Promise<NextReviewSchedule>;
}

export interface SchedulingServiceOptions {
  playlistTuneCount?: number | null;
}

export interface SchedulingServiceConstructor {
  new (
    prefs: PrefsSpacedRepetition,
    scheduling: IUserSchedulingOptions,
    options?: SchedulingServiceOptions
  ): SchedulingService;
}
