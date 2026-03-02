/**
 * User Settings Queries
 *
 * Database queries for user preferences:
 * - Scheduling Options (prefs_scheduling_options table)
 * - Spaced Repetition (prefs_spaced_repetition table)
 * - Account/Profile (user_profile table)
 *
 * @module lib/db/queries/user-settings
 */

import { and, eq, isNull, or } from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";
import {
  goal,
  prefsSchedulingOptions,
  prefsSpacedRepetition,
  userProfile,
} from "../schema";

// ============================================================================
// Types
// ============================================================================

export interface SchedulingOptions {
  userId: string;
  acceptableDelinquencyWindow: number | null;
  minReviewsPerDay: number | null;
  maxReviewsPerDay: number | null;
  daysPerWeek: number | null;
  weeklyRules: string | null;
  exceptions: string | null;
  autoScheduleNew: boolean | null;
}

export interface SpacedRepetitionPrefs {
  userId: string;
  algType: string;
  fsrsWeights: string | null;
  requestRetention: number | null;
  maximumInterval: number | null;
}

export interface UserProfileData {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  phone: string | null;
  phoneVerified: string | null;
}

// ============================================================================
// Scheduling Options Queries
// ============================================================================

/**
 * Get scheduling options for a user
 */
export async function getSchedulingOptions(
  db: SqliteDatabase,
  userId: string
): Promise<SchedulingOptions | null> {
  const result = await db
    .select()
    .from(prefsSchedulingOptions)
    .where(eq(prefsSchedulingOptions.userId, userId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return {
    userId: result[0].userId,
    acceptableDelinquencyWindow: result[0].acceptableDelinquencyWindow,
    minReviewsPerDay: result[0].minReviewsPerDay,
    maxReviewsPerDay: result[0].maxReviewsPerDay,
    daysPerWeek: result[0].daysPerWeek,
    weeklyRules: result[0].weeklyRules,
    exceptions: result[0].exceptions,
    autoScheduleNew: !!result[0].autoScheduleNew,
  };
}

/**
 * Update scheduling options for a user
 */
export async function updateSchedulingOptions(
  db: SqliteDatabase,
  data: Partial<SchedulingOptions> & { userId: string }
): Promise<SchedulingOptions> {
  const now = new Date().toISOString();

  // Check if record exists
  const existing = await getSchedulingOptions(db, data.userId);

  if (existing) {
    // Update existing record
    await db
      .update(prefsSchedulingOptions)
      .set({
        acceptableDelinquencyWindow:
          data.acceptableDelinquencyWindow === null
            ? undefined
            : (data.acceptableDelinquencyWindow ??
              (existing.acceptableDelinquencyWindow === null
                ? undefined
                : existing.acceptableDelinquencyWindow)),
        minReviewsPerDay:
          data.minReviewsPerDay === null
            ? undefined
            : (data.minReviewsPerDay ??
              (existing.minReviewsPerDay === null
                ? undefined
                : existing.minReviewsPerDay)),
        maxReviewsPerDay:
          data.maxReviewsPerDay === null
            ? undefined
            : (data.maxReviewsPerDay ??
              (existing.maxReviewsPerDay === null
                ? undefined
                : existing.maxReviewsPerDay)),
        daysPerWeek:
          data.daysPerWeek === null
            ? undefined
            : (data.daysPerWeek ??
              (existing.daysPerWeek === null
                ? undefined
                : existing.daysPerWeek)),
        weeklyRules:
          data.weeklyRules === null
            ? undefined
            : (data.weeklyRules ??
              (existing.weeklyRules === null
                ? undefined
                : existing.weeklyRules)),
        exceptions:
          data.exceptions === null
            ? undefined
            : (data.exceptions ??
              (existing.exceptions === null ? undefined : existing.exceptions)),
        autoScheduleNew:
          data.autoScheduleNew !== undefined
            ? data.autoScheduleNew
              ? 1
              : 0
            : undefined,
        lastModifiedAt: now,
      })
      .where(eq(prefsSchedulingOptions.userId, data.userId));
  } else {
    // Insert new record
    await db.insert(prefsSchedulingOptions).values({
      userId: data.userId,
      acceptableDelinquencyWindow:
        data.acceptableDelinquencyWindow === null
          ? undefined
          : (data.acceptableDelinquencyWindow ?? 21),
      minReviewsPerDay:
        data.minReviewsPerDay === null ? undefined : data.minReviewsPerDay,
      maxReviewsPerDay:
        data.maxReviewsPerDay === null ? undefined : data.maxReviewsPerDay,
      daysPerWeek: data.daysPerWeek === null ? undefined : data.daysPerWeek,
      weeklyRules: data.weeklyRules === null ? undefined : data.weeklyRules,
      exceptions: data.exceptions === null ? undefined : data.exceptions,
      autoScheduleNew:
        data.autoScheduleNew !== undefined ? (data.autoScheduleNew ? 1 : 0) : 1,
      lastModifiedAt: now,
    });
  }

  // Return updated data
  const updated = await getSchedulingOptions(db, data.userId);
  if (!updated) {
    throw new Error("Failed to retrieve updated scheduling options");
  }
  return updated;
}

// ============================================================================
// Spaced Repetition Queries
// ============================================================================

/**
 * Get spaced repetition preferences for a user
 */
export async function getSpacedRepetitionPrefs(
  db: SqliteDatabase,
  userId: string,
  algType: string = "FSRS"
): Promise<SpacedRepetitionPrefs | null> {
  const result = await db
    .select()
    .from(prefsSpacedRepetition)
    .where(
      and(
        eq(prefsSpacedRepetition.userId, userId),
        eq(prefsSpacedRepetition.algType, algType)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return {
    userId: result[0].userId,
    algType: result[0].algType,
    fsrsWeights: result[0].fsrsWeights,
    requestRetention: result[0].requestRetention,
    maximumInterval: result[0].maximumInterval,
  };
}

/**
 * Update spaced repetition preferences for a user
 */
export async function updateSpacedRepetitionPrefs(
  db: SqliteDatabase,
  data: Partial<SpacedRepetitionPrefs> & { userId: string; algType: string }
): Promise<SpacedRepetitionPrefs> {
  const now = new Date().toISOString();

  // Check if record exists
  const existing = await getSpacedRepetitionPrefs(
    db,
    data.userId,
    data.algType
  );

  if (existing) {
    // Update existing record
    await db
      .update(prefsSpacedRepetition)
      .set({
        fsrsWeights:
          data.fsrsWeights === null
            ? undefined
            : (data.fsrsWeights ??
              (existing.fsrsWeights === null
                ? undefined
                : existing.fsrsWeights)),
        requestRetention:
          data.requestRetention === null
            ? undefined
            : (data.requestRetention ??
              (existing.requestRetention === null
                ? undefined
                : existing.requestRetention)),
        maximumInterval:
          data.maximumInterval === null
            ? undefined
            : (data.maximumInterval ??
              (existing.maximumInterval === null
                ? undefined
                : existing.maximumInterval)),
        lastModifiedAt: now,
      })
      .where(
        and(
          eq(prefsSpacedRepetition.userId, data.userId),
          eq(prefsSpacedRepetition.algType, data.algType)
        )
      );
  } else {
    // Insert new record
    await db.insert(prefsSpacedRepetition).values({
      userId: data.userId,
      algType: data.algType,
      fsrsWeights: data.fsrsWeights === null ? undefined : data.fsrsWeights,
      requestRetention:
        data.requestRetention === null
          ? undefined
          : (data.requestRetention ?? 0.9),
      maximumInterval:
        data.maximumInterval === null
          ? undefined
          : (data.maximumInterval ?? 365),
      lastModifiedAt: now,
    });
  }

  // Return updated data
  const updated = await getSpacedRepetitionPrefs(db, data.userId, data.algType);
  if (!updated) {
    throw new Error("Failed to retrieve updated spaced repetition preferences");
  }
  return updated;
}

// ============================================================================
// User Profile Queries
// ============================================================================

/**
 * Get user profile data
 */
export async function getUserProfile(
  db: SqliteDatabase,
  userId: string
): Promise<UserProfileData | null> {
  const result = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.id, userId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return {
    id: result[0].id,
    name: result[0].name,
    email: result[0].email,
    avatarUrl: result[0].avatarUrl,
    phone: result[0].phone,
    phoneVerified: result[0].phoneVerified,
  };
}

/**
 * Update user profile data
 */
export async function updateUserProfile(
  db: SqliteDatabase,
  data: Partial<UserProfileData> & { id: string }
): Promise<UserProfileData> {
  const now = new Date().toISOString();

  // Check if record exists
  const existing = await getUserProfile(db, data.id);

  if (existing) {
    // Update existing record
    await db
      .update(userProfile)
      .set({
        name:
          data.name === null
            ? undefined
            : (data.name ??
              (existing.name === null ? undefined : existing.name)),
        email:
          data.email === null
            ? undefined
            : (data.email ??
              (existing.email === null ? undefined : existing.email)),
        avatarUrl:
          data.avatarUrl === null
            ? undefined
            : (data.avatarUrl ??
              (existing.avatarUrl === null ? undefined : existing.avatarUrl)),
        phone:
          data.phone === null
            ? undefined
            : (data.phone ??
              (existing.phone === null ? undefined : existing.phone)),
        phoneVerified:
          data.phoneVerified === null
            ? undefined
            : (data.phoneVerified ??
              (existing.phoneVerified === null
                ? undefined
                : existing.phoneVerified)),
        lastModifiedAt: now,
      })
      .where(eq(userProfile.id, data.id));
  } else {
    // Insert new record (should rarely happen with proper auth flow)
    await db.insert(userProfile).values({
      id: data.id,
      name: data.name === null ? undefined : data.name,
      email: data.email === null ? undefined : data.email,
      avatarUrl: data.avatarUrl === null ? undefined : data.avatarUrl,
      phone: data.phone === null ? undefined : data.phone,
      phoneVerified:
        data.phoneVerified === null ? undefined : data.phoneVerified,
      lastModifiedAt: now,
    });
  }

  // Return updated data
  const updated = await getUserProfile(db, data.id);
  if (!updated) {
    throw new Error("Failed to retrieve updated user profile");
  }
  return updated;
}

// ============================================================================
// Goal Queries
// ============================================================================

/**
 * Shape returned by goal queries.
 * Mirrors the goal table columns used by the UI.
 */
export interface GoalRow {
  id: string;
  name: string;
  privateFor: string | null;
  defaultTechnique: string;
  baseIntervals: string | null;
  deleted: number;
}

/**
 * Returns all non-deleted goals visible to the given user:
 * - System goals (privateFor IS NULL) sorted first
 * - User's own private goals sorted by name
 *
 * Excludes soft-deleted rows (deleted = 1).
 */
export async function getGoals(
  db: SqliteDatabase,
  userId: string
): Promise<GoalRow[]> {
  const rows = await db
    .select()
    .from(goal)
    .where(
      and(
        or(isNull(goal.privateFor), eq(goal.privateFor, userId)),
        eq(goal.deleted, 0)
      )
    );

  // Sort: system goals (privateFor IS NULL) first, then user goals by name
  return rows.sort((a, b) => {
    if (a.privateFor === null && b.privateFor !== null) return -1;
    if (a.privateFor !== null && b.privateFor === null) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Insert a new user-owned goal, or update an existing one if the (name, privateFor)
 * pair already exists for this user.
 *
 * Enforces ownership: privateFor is always set to userId, ignoring any
 * caller-supplied value.
 *
 * @throws if name is empty
 */
export async function upsertGoal(
  db: SqliteDatabase,
  userId: string,
  data: {
    id?: string;
    name: string;
    defaultTechnique?: string;
    baseIntervals?: string | null;
  }
): Promise<GoalRow> {
  if (!data.name.trim()) {
    throw new Error("Goal name must not be empty");
  }

  const now = new Date().toISOString();
  const id = data.id ?? crypto.randomUUID();

  await db
    .insert(goal)
    .values({
      id,
      name: data.name.trim(),
      privateFor: userId,
      defaultTechnique: data.defaultTechnique ?? "fsrs",
      baseIntervals: data.baseIntervals ?? null,
      deleted: 0,
      lastModifiedAt: now,
    })
    .onConflictDoUpdate({
      target: [goal.id],
      set: {
        name: data.name.trim(),
        defaultTechnique: data.defaultTechnique ?? "fsrs",
        baseIntervals: data.baseIntervals ?? null,
        deleted: 0,
        lastModifiedAt: now,
      },
    });

  const rows = await db.select().from(goal).where(eq(goal.id, id)).limit(1);

  if (rows.length === 0) {
    throw new Error(`Failed to retrieve goal after upsert (id=${id})`);
  }
  return rows[0];
}

/**
 * Soft-delete a user-owned goal (sets deleted = 1).
 * Silently no-ops if the goal doesn't exist or isn't owned by the user
 * (protects system goals from accidental deletion).
 */
export async function softDeleteGoal(
  db: SqliteDatabase,
  userId: string,
  goalId: string
): Promise<void> {
  await db
    .update(goal)
    .set({ deleted: 1, lastModifiedAt: new Date().toISOString() })
    .where(and(eq(goal.id, goalId), eq(goal.privateFor, userId)));
}
