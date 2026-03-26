/**
 * Supabase Client Configuration
 *
 * This module initializes and exports the Supabase client for authentication
 * and database operations.
 *
 * @module supabase/client
 */

import { createSupabaseClient } from "@rhizome/core";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local.template"
  );
}

/**
 * Supabase client instance for TuneTrees.
 *
 * Created via @rhizome/core's createSupabaseClient to keep the auth
 * storage key and options consistent across shared components.
 */
export const supabase = createSupabaseClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  storageKey: "tunetrees-auth",
});

/**
 * Type exports for Supabase client
 */
export type SupabaseClient = typeof supabase;
