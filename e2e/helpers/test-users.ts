/**
 * Test User Management
 * Provides test user credentials and Supabase client creation
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const TEST_PASSWORD = "TestPassword123!";

export interface TestUser {
  email: string;
  name: string;
  userId: number;
  playlistId: number;
}

export const TEST_USERS: Record<string, TestUser> = {
  bob: {
    email: "bob.test@tunetrees.test",
    name: "Bob Test",
    userId: 9002,
    playlistId: 9002,
  },
  alice: {
    email: "alice.test@tunetrees.test",
    name: "Alice Test",
    userId: 9001,
    playlistId: 9001,
  },
  dave: {
    email: "dave.test@tunetrees.test",
    name: "Dave Test",
    userId: 9004,
    playlistId: 9004,
  },
  eve: {
    email: "eve.test@tunetrees.test",
    name: "Eve Test",
    userId: 9005,
    playlistId: 9005,
  },
  frank: {
    email: "frank.test@tunetrees.test",
    name: "Frank Test",
    userId: 9006,
    playlistId: 9006,
  },
  grace: {
    email: "grace.test@tunetrees.test",
    name: "Grace Test",
    userId: 9007,
    playlistId: 9007,
  },
  henry: {
    email: "henry.test@tunetrees.test",
    name: "Henry Test",
    userId: 9008,
    playlistId: 9008,
  },
  iris: {
    email: "iris.test@tunetrees.test",
    name: "Iris Test",
    userId: 9009,
    playlistId: 9009,
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
