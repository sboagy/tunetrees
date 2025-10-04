"use server";

// Server action wrappers around scheduling-options/queries.ts
// Aligns with practice/actions -> practice/queries pattern.

import {
  getSchedulingOptions,
  updateSchedulingOptions,
  type IPrefsSchedulingOptionsBase,
  type IPrefsSchedulingOptionsCreate,
  type IPrefsSchedulingOptionsUpdate,
  type IPrefsSchedulingOptionsResponse,
} from "../queries-scheduling-options";

export async function getSchedulingOptionsAction(userId: number) {
  return getSchedulingOptions(userId);
}
// Creation handled implicitly by backend PUT/GET auto-create; explicit POST action not required.
export async function updateSchedulingOptionsAction(
  userId: number,
  prefs: IPrefsSchedulingOptionsUpdate,
) {
  return updateSchedulingOptions(userId, prefs);
}

export type {
  IPrefsSchedulingOptionsBase,
  IPrefsSchedulingOptionsCreate,
  IPrefsSchedulingOptionsUpdate,
  IPrefsSchedulingOptionsResponse,
};
