/**
 * Cloudflare Pages Function - TheSession.org CORS Proxy
 *
 * This function provides a CORS proxy for TheSession.org API to bypass
 * browser CORS restrictions when importing tunes.
 *
 * Endpoint: GET /api/proxy/thesession?url=<encoded-url>
 *
 * Security:
 * - Validates hostname === "thesession.org"
 * - Enforces HTTPS protocol only
 * - 10-second timeout
 * - JSON response validation
 *
 * @module functions/api/proxy/thesession
 */

interface Env {
  // No environment variables needed for this proxy
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Cloudflare Pages Function handler
 * Note: Pages Functions use a different API than Workers
 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);

  // Handle CORS preflight (though GET shouldn't need it, be safe)
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Get the target URL from query parameter
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      return errorResponse("Missing 'url' query parameter", 400);
    }

    // Validate that the URL is from thesession.org (exact hostname and protocol match)
    let targetUrlObj: URL;
    try {
      targetUrlObj = new URL(targetUrl);
    } catch (urlError) {
      return errorResponse("Invalid URL format", 400);
    }

    // Security checks: exact hostname and HTTPS protocol
    if (targetUrlObj.hostname !== "thesession.org") {
      return errorResponse(
        "Invalid URL - only thesession.org is allowed",
        400
      );
    }
    if (targetUrlObj.protocol !== "https:") {
      return errorResponse("Invalid URL - only HTTPS protocol is allowed", 400);
    }

    // Fetch from TheSession.org with timeout
    console.log(`[Proxy] Fetching: ${targetUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(targetUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "TuneTrees-PWA/1.0",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(
          `[Proxy] TheSession.org returned error: ${response.status}`
        );
        return errorResponse(
          `TheSession.org API error: ${response.statusText}`,
          response.status
        );
      }

      // Parse JSON response with error handling
      let data: unknown;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("[Proxy] Invalid JSON response from TheSession.org");
        return errorResponse("Invalid JSON response from TheSession.org", 502);
      }

      return jsonResponse(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return errorResponse("Request to TheSession.org timed out", 504);
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("[Proxy] Error:", error);
    return errorResponse(
      `Proxy error: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
}

// Also export onRequestOptions for CORS preflight
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { headers: CORS_HEADERS });
}
