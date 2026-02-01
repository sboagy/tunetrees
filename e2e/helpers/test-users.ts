/**
 * Test User Management
 * Provides test user credentials and Supabase client creation
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const TEST_PASSWORD = "TestPassword123!";

import {
  TEST_PLAYLIST_ALICE_ID,
  TEST_PLAYLIST_BOB_ID,
  TEST_PLAYLIST_DAVE_ID,
  TEST_PLAYLIST_EVE_ID,
  TEST_PLAYLIST_FRANK_ID,
  TEST_PLAYLIST_GRACE_ID,
  TEST_PLAYLIST_HENRY_ID,
  TEST_PLAYLIST_IRIS_ID,
  TEST_USER_ALICE_EMAIL,
  TEST_USER_ALICE_ID,
  TEST_USER_BOB_EMAIL,
  TEST_USER_BOB_ID,
  TEST_USER_DAVE_EMAIL,
  TEST_USER_DAVE_ID,
  TEST_USER_EVE_EMAIL,
  TEST_USER_EVE_ID,
  TEST_USER_FRANK_EMAIL,
  TEST_USER_FRANK_ID,
  TEST_USER_GRACE_EMAIL,
  TEST_USER_GRACE_ID,
  TEST_USER_HENRY_EMAIL,
  TEST_USER_HENRY_ID,
  TEST_USER_IRIS_EMAIL,
  TEST_USER_IRIS_ID,
} from "../../tests/fixtures/test-data";

export type TestUser = {
  email: string;
  name: string;
  userId: string;
  playlistId: string;
};

export const TEST_USERS: Record<string, TestUser> = {
  bob: {
    email: TEST_USER_BOB_EMAIL,
    name: "Bob",
    userId: TEST_USER_BOB_ID,
    playlistId: TEST_PLAYLIST_BOB_ID,
  },
  alice: {
    email: TEST_USER_ALICE_EMAIL,
    name: "Alice",
    userId: TEST_USER_ALICE_ID,
    playlistId: TEST_PLAYLIST_ALICE_ID,
  },
  dave: {
    email: TEST_USER_DAVE_EMAIL,
    name: "Dave",
    userId: TEST_USER_DAVE_ID,
    playlistId: TEST_PLAYLIST_DAVE_ID,
  },
  eve: {
    email: TEST_USER_EVE_EMAIL,
    name: "Eve",
    userId: TEST_USER_EVE_ID,
    playlistId: TEST_PLAYLIST_EVE_ID,
  },
  frank: {
    email: TEST_USER_FRANK_EMAIL,
    name: "Frank",
    userId: TEST_USER_FRANK_ID,
    playlistId: TEST_PLAYLIST_FRANK_ID,
  },
  grace: {
    email: TEST_USER_GRACE_EMAIL,
    name: "Grace",
    userId: TEST_USER_GRACE_ID,
    playlistId: TEST_PLAYLIST_GRACE_ID,
  },
  henry: {
    email: TEST_USER_HENRY_EMAIL,
    name: "Henry",
    userId: TEST_USER_HENRY_ID,
    playlistId: TEST_PLAYLIST_HENRY_ID,
  },
  iris: {
    email: TEST_USER_IRIS_EMAIL,
    name: "Iris",
    userId: TEST_USER_IRIS_ID,
    playlistId: TEST_PLAYLIST_IRIS_ID,
  },
};

// Cache clients per user
const clientCache: Map<string, { supabase: SupabaseClient; userId: string }> =
  new Map();

/**
 * Get authenticated Supabase client for a test user
 */
export async function getTestUserClient(userKey: string) {
  if (clientCache.has(userKey)) {
    return clientCache.get(userKey)!;
  }

  const user = TEST_USERS[userKey];
  if (!user) {
    throw new Error(`Unknown test user: ${userKey}`);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: TEST_PASSWORD,
  });

  if (error) {
    throw new Error(`Failed to authenticate ${user.email}: ${error.message}`);
  }

  const client = { supabase, userId: data.user.id };
  clientCache.set(userKey, client);
  return client;
}

/**
 * Clear client cache for a user (or all users)
 */
export function resetTestUserClient(userKey?: string) {
  if (userKey) {
    clientCache.delete(userKey);
  } else {
    clientCache.clear();
  }
}

/**
 * Get test user by worker ID (for parallel test assignment)
 * Workers 0-7 map to alice, bob, dave, eve, frank, grace, henry, iris
 */
export function getTestUserByWorkerIndex(workerIndex: number): TestUser {
  const userKeys = Object.keys(TEST_USERS);
  const userKey = userKeys[workerIndex % userKeys.length];
  return TEST_USERS[userKey];
}
