import {
  authenticateMediaRequest,
  getCorsHeaders,
  type MediaWorkerEnv,
} from "./media";

export interface GoogleOAuthWorkerEnv extends MediaWorkerEnv {
  GOOGLE_CLIENT_SECRET?: string;
}

const GOOGLE_TOKEN_EXCHANGE_PATH = "/api/byos/google/token";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

type TokenExchangeRequest = {
  grantType?: unknown;
  clientId?: unknown;
  code?: unknown;
  codeVerifier?: unknown;
  redirectUri?: unknown;
  refreshToken?: unknown;
};

type GoogleTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
  token_type?: unknown;
};

function jsonResponse(
  data: unknown,
  status: number,
  corsHeaders: Record<string, string>
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readTokenResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const response = payload as GoogleTokenResponse;
  if (!isNonEmptyString(response.access_token)) {
    return null;
  }

  const token: {
    accessToken: string;
    expiresIn?: number;
    refreshToken?: string;
    scope?: string;
    tokenType?: string;
  } = {
    accessToken: response.access_token,
  };

  if (typeof response.expires_in === "number") {
    token.expiresIn = response.expires_in;
  }
  if (isNonEmptyString(response.refresh_token)) {
    token.refreshToken = response.refresh_token;
  }
  if (isNonEmptyString(response.scope)) {
    token.scope = response.scope;
  }
  if (isNonEmptyString(response.token_type)) {
    token.tokenType = response.token_type;
  }

  return token;
}

async function parseRequestBody(request: Request) {
  try {
    const payload: unknown = await request.json();
    return payload && typeof payload === "object"
      ? (payload as TokenExchangeRequest)
      : null;
  } catch {
    return null;
  }
}

/**
 * Exchanges a Google authorization code or browser-local refresh token without
 * persisting either token in the Worker, Supabase, or logs. The browser owns
 * the returned token lifecycle and local storage.
 */
export async function handleGoogleOAuthRequest(
  request: Request,
  env: GoogleOAuthWorkerEnv
) {
  const url = new URL(request.url);
  if (
    request.method !== "POST" ||
    url.pathname !== GOOGLE_TOKEN_EXCHANGE_PATH
  ) {
    return null;
  }

  const corsHeaders = getCorsHeaders(request);
  if (!env.GOOGLE_CLIENT_SECRET) {
    return jsonResponse(
      { error: "Google OAuth is not configured" },
      503,
      corsHeaders
    );
  }

  const user = await authenticateMediaRequest(request, env);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  }

  const payload = await parseRequestBody(request);
  if (!payload) {
    return jsonResponse({ error: "Invalid JSON payload" }, 400, corsHeaders);
  }

  const form = new URLSearchParams({
    client_secret: env.GOOGLE_CLIENT_SECRET,
  });

  if (!isNonEmptyString(payload.clientId)) {
    return jsonResponse(
      { error: "Google token exchanges require clientId" },
      400,
      corsHeaders
    );
  }
  form.set("client_id", payload.clientId);

  if (payload.grantType === "authorization_code") {
    if (
      !isNonEmptyString(payload.code) ||
      !isNonEmptyString(payload.codeVerifier) ||
      !isNonEmptyString(payload.redirectUri)
    ) {
      return jsonResponse(
        {
          error:
            "Authorization-code exchanges require code, codeVerifier, and redirectUri",
        },
        400,
        corsHeaders
      );
    }

    form.set("grant_type", "authorization_code");
    form.set("code", payload.code);
    form.set("code_verifier", payload.codeVerifier);
    form.set("redirect_uri", payload.redirectUri);
  } else if (payload.grantType === "refresh_token") {
    if (!isNonEmptyString(payload.refreshToken)) {
      return jsonResponse(
        { error: "Refresh-token exchanges require refreshToken" },
        400,
        corsHeaders
      );
    }

    form.set("grant_type", "refresh_token");
    form.set("refresh_token", payload.refreshToken);
  } else {
    return jsonResponse({ error: "Unsupported grant type" }, 400, corsHeaders);
  }

  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
  } catch {
    return jsonResponse(
      { error: "Google token exchange is unavailable" },
      502,
      corsHeaders
    );
  }

  if (!response.ok) {
    return jsonResponse(
      { error: "Google token exchange was rejected" },
      401,
      corsHeaders
    );
  }

  let googlePayload: unknown;
  try {
    googlePayload = await response.json();
  } catch {
    return jsonResponse(
      { error: "Google token exchange returned an invalid response" },
      502,
      corsHeaders
    );
  }

  const token = readTokenResponse(googlePayload);
  if (!token) {
    return jsonResponse(
      { error: "Google token exchange returned an invalid response" },
      502,
      corsHeaders
    );
  }

  return jsonResponse({ token }, 200, corsHeaders);
}
