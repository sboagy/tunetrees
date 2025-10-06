/**
 * Supabase Client Configuration
 *
 * This module initializes and exports the Supabase client for authentication
 * and database operations.
 *
 * @module supabase/client
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Supabase project URL
 * Get from: https://app.supabase.com/project/_/settings/api
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

/**
 * Supabase anonymous key (safe for client-side use)
 * Get from: https://app.supabase.com/project/_/settings/api
 */
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local",
  );
}

/**
 * Supabase client instance
 *
 * Features:
 * - Authentication (email/password, OAuth providers)
 * - Real-time subscriptions
 * - Database queries (with RLS policies)
 * - Storage access
 *
 * @example
 * ```typescript
 * import { supabase } from '@/lib/supabase/client';
 *
 * // Sign in
 * const { data, error } = await supabase.auth.signInWithPassword({
 *   email: 'user@example.com',
 *   password: 'password123'
 * });
 *
 * // Query database (respects RLS policies)
 * const { data: playlists } = await supabase
 *   .from('playlist')
 *   .select('*')
 *   .eq('user_ref', userId);
 * ```
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Auto-refresh tokens
    autoRefreshToken: true,

    // Persist session in localStorage
    persistSession: true,

    // Detect session from URL (for OAuth callbacks)
    detectSessionInUrl: true,

    // Storage key for session
    storageKey: "tunetrees-auth",
  },

  // Global fetch options
  global: {
    headers: {
      "X-Client-Info": "tunetrees-pwa",
    },
  },
});

/**
 * Type exports for Supabase client
 */
export type SupabaseClient = typeof supabase;
