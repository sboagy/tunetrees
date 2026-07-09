import { useNavigate } from "@solidjs/router";
import type { EmailOtpType } from "@supabase/supabase-js";
import { onMount } from "solid-js";
import {
  getPendingSignUpConfirmationEmail,
  hasPendingSignUpConfirmation,
  setPendingSignUpConfirmationEmail,
} from "@/lib/auth/signup-confirmation-pending";
import { supabase } from "@/lib/supabase/client";

const AUTH_CONFIRMATION_EVENT_KEY = "tunetrees:auth-confirmed";
const AUTH_CONFIRMATION_CHANNEL = "tunetrees-auth";

type AuthCallbackParams = {
  accessToken: string | null;
  code: string | null;
  error: string | null;
  errorDescription: string | null;
  queryError: string | null;
  queryErrorDescription: string | null;
  refreshToken: string | null;
  token: string | null;
  tokenHash: string | null;
  type: EmailOtpType | null;
};

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

function redirectWithConfirmedSession(path = "/") {
  globalThis.location.replace(path);
}

function normalizeEmailOtpType(type: string): EmailOtpType {
  if (type === "signup" || type === "magiclink") return "email";
  return type;
}

function isEmailConfirmationType(type: EmailOtpType | null): boolean {
  return (
    type === "signup" ||
    type === "email" ||
    type === "magiclink" ||
    hasPendingSignUpConfirmation()
  );
}

function maybePublishAuthConfirmed(type: EmailOtpType | null) {
  if (isEmailConfirmationType(type)) {
    publishAuthConfirmed();
  }
}

function readAuthCallbackParams(): AuthCallbackParams {
  const url = new URL(globalThis.location.href);
  const hashParams = new URLSearchParams(globalThis.location.hash.substring(1));

  return {
    accessToken: hashParams.get("access_token"),
    code: url.searchParams.get("code"),
    error: hashParams.get("error"),
    errorDescription: hashParams.get("error_description"),
    queryError: url.searchParams.get("error"),
    queryErrorDescription: url.searchParams.get("error_description"),
    refreshToken: hashParams.get("refresh_token"),
    token: url.searchParams.get("token"),
    tokenHash: url.searchParams.get("token_hash"),
    type: hashParams.get("type") ?? url.searchParams.get("type"),
  };
}

function navigateToAuthError(
  navigate: ReturnType<typeof useNavigate>,
  message: string
) {
  navigate(`/login?error=${encodeURIComponent(message)}`);
}

async function handleHashSession(
  params: AuthCallbackParams,
  navigate: ReturnType<typeof useNavigate>
): Promise<boolean> {
  if (!params.accessToken) return false;

  if (params.type === "recovery") {
    navigate("/reset-password");
    return true;
  }

  const { error } = await supabase.auth.setSession({
    access_token: params.accessToken,
    refresh_token: params.refreshToken || "",
  });

  if (error) {
    console.error("Session error:", error);
    navigate("/login?error=Could not establish session");
  } else {
    maybePublishAuthConfirmed(params.type);
    redirectWithConfirmedSession();
  }

  return true;
}

async function handleCodeSession(
  params: AuthCallbackParams,
  navigate: ReturnType<typeof useNavigate>
): Promise<boolean> {
  if (!params.code) return false;

  const { error } = await supabase.auth.exchangeCodeForSession(params.code);

  if (error) {
    console.error("Session exchange error:", error);
    navigate("/login?error=Could not establish session");
  } else {
    maybePublishAuthConfirmed(params.type);
    redirectWithConfirmedSession();
  }

  return true;
}

async function handleTokenHashVerification(
  params: AuthCallbackParams,
  navigate: ReturnType<typeof useNavigate>
): Promise<boolean> {
  if (!params.tokenHash || !params.type) return false;

  const { error } = await supabase.auth.verifyOtp({
    token_hash: params.tokenHash,
    type: params.type,
  });

  if (error) {
    console.error("Email verification error:", error);
    navigate("/login?error=Could not verify email confirmation");
  } else if (params.type === "recovery") {
    navigate("/reset-password");
  } else {
    maybePublishAuthConfirmed(params.type);
    redirectWithConfirmedSession();
  }

  return true;
}

async function handlePlainTokenVerification(
  params: AuthCallbackParams,
  navigate: ReturnType<typeof useNavigate>
): Promise<boolean> {
  if (!params.token || !params.type) return false;

  const pendingEmail = getPendingSignUpConfirmationEmail();
  if (!pendingEmail) {
    navigate(
      "/login?error=Could not verify email confirmation from this browser"
    );
    return true;
  }

  const { error } = await supabase.auth.verifyOtp({
    email: pendingEmail,
    token: params.token,
    type: normalizeEmailOtpType(params.type),
  });

  if (error) {
    console.error("Email token verification error:", error);
    navigate("/login?error=Could not verify email confirmation");
  } else if (params.type === "recovery") {
    navigate("/reset-password");
  } else {
    publishAuthConfirmed();
    redirectWithConfirmedSession();
  }

  return true;
}

async function handleExistingSession(
  params: AuthCallbackParams
): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;

  maybePublishAuthConfirmed(params.type);
  redirectWithConfirmedSession();
  return true;
}

async function handleAuthCallback(navigate: ReturnType<typeof useNavigate>) {
  const params = readAuthCallbackParams();
  const authError = params.error ?? params.queryError;
  if (authError) {
    const description =
      params.errorDescription ?? params.queryErrorDescription ?? authError;
    console.error("Auth error:", authError, description);
    navigateToAuthError(navigate, description);
    return;
  }

  if (await handleHashSession(params, navigate)) return;
  if (await handleCodeSession(params, navigate)) return;
  if (await handleTokenHashVerification(params, navigate)) return;
  if (await handlePlainTokenVerification(params, navigate)) return;
  if (await handleExistingSession(params)) return;

  navigate("/login?error=No authentication tokens received");
}

export default function AuthCallback() {
  const navigate = useNavigate();

  onMount(() => {
    void handleAuthCallback(navigate);
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
