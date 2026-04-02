/**
 * Module augmentation for @rhizome/core
 *
 * Extends AuthProviderProps with TuneTrees-specific hook props that exist in
 * the rhizome source but have not yet been published to the installed package
 * version. Remove this file once @rhizome/core is updated and republished.
 *
 * IMPORTANT: The `export {}` below is required. Without it, this file is
 * treated as an ambient script and `declare module` REPLACES @rhizome/core
 * instead of augmenting it, causing all its exports to disappear.
 */
export {};

declare module "@rhizome/core" {
  interface AuthProviderProps {
    /**
     * Optional override for the anonymous sign-in flow. When provided,
     * AuthProvider calls this instead of supabase.auth.signInAnonymously().
     */
    overrideSignInAnonymously?: () => Promise<void>;
  }
}
