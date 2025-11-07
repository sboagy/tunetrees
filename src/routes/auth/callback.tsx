import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();

  onMount(async () => {
    // Handle the auth callback from Supabase
    // Supabase redirects here with auth tokens in the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    const type = hashParams.get("type");
    const error = hashParams.get("error");
    const error_description = hashParams.get("error_description");

    if (error) {
      console.error("Auth error:", error, error_description);
      navigate(
        `/login?error=${encodeURIComponent(error_description || error)}`
      );
      return;
    }

    if (access_token && type === "recovery") {
      // Password recovery flow - redirect to password reset page
      // Session is already set by Supabase, just need to redirect
      navigate("/reset-password");
    } else if (access_token) {
      // Normal login flow - set the session and redirect to home
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token || "",
      });

      if (sessionError) {
        console.error("Session error:", sessionError);
        navigate("/login?error=Could not establish session");
      } else {
        navigate("/");
      }
    } else {
      // No tokens - something went wrong
      navigate("/login?error=No authentication tokens received");
    }
  });

  return (
    <div class="min-h-screen flex items-center justify-center bg-slate-900">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p class="text-slate-300">Processing authentication...</p>
      </div>
    </div>
  );
}
