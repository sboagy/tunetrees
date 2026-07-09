import { useNavigate } from "@solidjs/router";
import type { EmailOtpType } from "@supabase/supabase-js";
import { onMount } from "solid-js";
import {
  hasPendingSignUpConfirmation,
  setPendingSignUpConfirmationEmail,
} from "@/lib/auth/signup-confirmation-pending";
import { supabase } from "@/lib/supabase/client";

const AUTH_CONFIRMATION_EVENT_KEY = "tunetrees:auth-confirmed";
const AUTH_CONFIRMATION_CHANNEL = "tunetrees-auth";

function publishAuthConfirmed() {
  setPendingSignUpConfirmationEmail(null);
  const payload = JSON.stringify({ confirmedAt: new Date().toISOString() });
  localStorage.setItem(AUTH_CONFIRMATION_EVENT_KEY, payload);

  if ("BroadcastChannel" in globalThis) {
    const channel = new BroadcastChannel(AUTH_CONFIRMATION_CHANNEL);
    channel.postMessage({ type: "email-confirmed" });
    channel.close();
  }
}

export default function AuthCallback() {
  const navigate = useNavigate();

  onMount(async () => {
    // Handle the auth callback from Supabase
    // Supabase can redirect here with hash tokens, a PKCE code, or an email
    // template token_hash depending on the auth flow/project configuration.
    const url = new URL(globalThis.location.href);
    const queryError = url.searchParams.get("error");
    const queryErrorDescription = url.searchParams.get("error_description");
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const queryType = url.searchParams.get("type");
    const hashParams = new URLSearchParams(
      globalThis.location.hash.substring(1)
    );
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    const type = hashParams.get("type") ?? queryType;
    const error = hashParams.get("error");
    const error_description = hashParams.get("error_description");

    if (error || queryError) {
      const authError = error ?? queryError ?? "Authentication failed";
      const authErrorDescription = error_description ?? queryErrorDescription;
      console.error("Auth error:", authError, authErrorDescription);
      navigate(
        `/login?error=${encodeURIComponent(authErrorDescription || authError)}`
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
        if (type === "signup" || type === "email") {
          publishAuthConfirmed();
        }
        navigate("/");
      }
    } else if (code) {
      const { error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        console.error("Session exchange error:", sessionError);
        navigate("/login?error=Could not establish session");
      } else {
        if (
          type === "signup" ||
          type === "email" ||
          hasPendingSignUpConfirmation()
        ) {
          publishAuthConfirmed();
        }
        navigate("/");
      }
    } else if (tokenHash && type) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });

      if (verifyError) {
        console.error("Email verification error:", verifyError);
        navigate("/login?error=Could not verify email confirmation");
      } else if (type === "recovery") {
        navigate("/reset-password");
      } else {
        if (
          type === "signup" ||
          type === "email" ||
          hasPendingSignUpConfirmation()
        ) {
          publishAuthConfirmed();
        }
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
