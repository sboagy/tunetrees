/**
 * Cloudflare Pages Function - Generic CORS Proxy
 *
 * Endpoint: GET /api/proxy?url=<encoded-url>
 *
 * Security:
 * - HTTPS/HTTP only
 * - Timeout + max response size
 * - Hostname blocklist via env PROXY_BLOCKLIST (comma-separated)
 */

interface PagesContext {
  request: Request;
  env: Record<string, string>;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  next: () => Promise<Response>;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 2_000_000;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

function parseBlocklist(env: Record<string, string>): string[] {
  const raw = env.PROXY_BLOCKLIST ?? "";
  const defaults = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
  const configured = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return [...defaults, ...configured];
}

function isBlockedHost(hostname: string, blocklist: string[]): boolean {
  const host = hostname.toLowerCase();
  return blocklist.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`)
  );
}

async function readResponseWithLimit(
  response: Response,
  maxBytes: number
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new Error("Response exceeds size limit");
    }
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error("Response exceeds size limit");
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const target = url.searchParams.get("url");
  if (!target) {
    return errorResponse("Missing 'url' query parameter", 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return errorResponse("Invalid URL format", 400);
  }

  if (!/^https?:$/.test(targetUrl.protocol)) {
    return errorResponse("Only HTTP/HTTPS URLs are allowed", 400);
  }

  const blocklist = parseBlocklist(env);
  if (isBlockedHost(targetUrl.hostname, blocklist)) {
    return errorResponse("Blocked target host", 403);
  }

  const timeoutMs = Number(env.PROXY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const maxBytes = Number(env.PROXY_MAX_BYTES ?? DEFAULT_MAX_BYTES);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "TuneTrees-PWA/1.0",
      },
      signal: controller.signal,
    });

    const body = await readResponseWithLimit(response, maxBytes);
    const bodyBuffer = new Uint8Array(body).buffer;
    const headers = new Headers(CORS_HEADERS);
    const contentType = response.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);

    return new Response(bodyBuffer, {
      status: response.status,
      headers,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("Proxy request timed out", 504);
    }
    return errorResponse(
      `Proxy error: ${error instanceof Error ? error.message : String(error)}`,
      502
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { headers: CORS_HEADERS });
}
