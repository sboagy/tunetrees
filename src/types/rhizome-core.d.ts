/**
 * Module augmentation for @rhizome/core
 *
 * Extends AuthProviderProps with TuneTrees-specific hook props that exist in
 * the rhizome source but have not yet been published to the installed package
 * version. Remove this file once @rhizome/core is updated and republished.
 */
declare module "@rhizome/core" {
  interface AuthProviderProps {
    /**
     * Optional override for the anonymous sign-in flow. When provided,
     * AuthProvider calls this instead of supabase.auth.signInAnonymously().
     */
    overrideSignInAnonymously?: () => Promise<void>;
  }
}
