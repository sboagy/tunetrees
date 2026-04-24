import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";

export interface MediaWorkerEnv {
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TUNETREES_VAULT?: R2Bucket;
}

const MEDIA_UPLOAD_PATH = "/api/media/upload";
const MEDIA_VIEW_PATH = "/api/media/view";
const USER_ROOT_PREFIX = "users";

type MediaAuthUser = {
  id: string;
};

type UploadFileLike = Blob & {
  name?: string;
  stream?: () => ReadableStream;
};

type MediaUploadResponse = {
  success: boolean;
  time: string;
  data: {
    files: string[];
    isImages: boolean[];
    path: string;
    baseurl: string;
    messages?: string[];
  };
  file: {
    key: string;
    size: number;
    contentType: string;
  };
};

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUrl: string | null = null;

function getJwks(supabaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
  const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  if (!cachedJwks || cachedJwksUrl !== jwksUrl) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
    cachedJwksUrl = jwksUrl;
  }
  return cachedJwks;
}

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info",
    Vary: "Origin",
    "Access-Control-Max-Age": "86400",
  };

  if (origin) {
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

  return corsHeaders;
}

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

function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>
) {
  return jsonResponse({ error: message }, status, corsHeaders);
}

function sanitizeFilename(filename: string) {
  const trimmedName = filename.trim();
  const sanitized = trimmedName
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized.length > 0 ? sanitized.slice(0, 120) : "upload";
}

function buildMediaObjectKey(userId: string, filename: string) {
  return `${USER_ROOT_PREFIX}/${userId}/notes/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

function buildMediaViewUrl(request: Request, key: string) {
  const url = new URL(MEDIA_VIEW_PATH, request.url);
  url.searchParams.set("key", key);
  return url.toString();
}

function isSupportedJwtAlgorithm(algorithm: string) {
  return (
    algorithm.startsWith("HS") ||
    algorithm.startsWith("RS") ||
    algorithm.startsWith("ES") ||
    algorithm.startsWith("PS") ||
    algorithm.startsWith("Ed")
  );
}

async function verifyJwtLocally(
  token: string,
  env: MediaWorkerEnv
): Promise<MediaAuthUser | null> {
  try {
    const header = decodeProtectedHeader(token) as {
      alg?: string;
    };
    const algorithm = header.alg;
    if (!algorithm) {
      return null;
    }
    if (!isSupportedJwtAlgorithm(algorithm)) {
      console.warn("[media.auth] Unsupported JWT algorithm", algorithm);
      return null;
    }

    let result: Awaited<ReturnType<typeof jwtVerify>> | null = null;

    if (algorithm.startsWith("HS")) {
      if (env.SUPABASE_JWT_SECRET) {
        result = await jwtVerify(
          token,
          new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
        );
      }
    } else {
      result = await jwtVerify(token, getJwks(env.SUPABASE_URL));
    }

    if (!result) {
      return null;
    }

    const userId = result.payload.sub;
    return typeof userId === "string" && userId.length > 0
      ? { id: userId }
      : null;
  } catch (error) {
    console.warn("[media.auth] Local JWT verification failed", error);
    return null;
  }
}

async function verifyJwtWithSupabase(
  token: string,
  env: MediaWorkerEnv
): Promise<MediaAuthUser | null> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { id?: string };
  return typeof data.id === "string" && data.id.length > 0
    ? { id: data.id }
    : null;
}

async function authenticateMediaRequest(
  request: Request,
  env: MediaWorkerEnv
) {
  const url = new URL(request.url);
  const authHeader = request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const token = bearerToken || url.searchParams.get("token");

  if (!token) {
    return null;
  }

  try {
    // Prefer local verification to avoid an external network call on the
    // common path. If local verification cannot validate the token, fall
    // back to Supabase as a compatibility path.
    const localUser = await verifyJwtLocally(token, env);
    if (localUser) {
      return localUser;
    }
  } catch {
    // Ignore local verification errors and try the remote fallback below.
  }

  try {
    return await verifyJwtWithSupabase(token, env);
  } catch {
    return null;
  }
}

function findUploadedFile(formData: FormData): UploadFileLike | null {
  for (const value of formData.values()) {
    if (value instanceof File) {
      return value as UploadFileLike;
    }

    if (
      typeof value !== "string" &&
      typeof (value as UploadFileLike).name === "string"
    ) {
      // Some test/runtime shims may provide Blob-like file objects that are not
      // actual File instances but still expose a filename. Accept those too.
      return value as UploadFileLike;
    }
  }

  return null;
}

async function handleMediaUpload(
  request: Request,
  env: MediaWorkerEnv,
  corsHeaders: Record<string, string>
) {
  if (!env.TUNETREES_VAULT) {
    return errorResponse("Media storage is not configured", 500, corsHeaders);
  }

  const user = await authenticateMediaRequest(request, env);
  if (!user) {
    return errorResponse("Unauthorized", 401, corsHeaders);
  }

  const formData = await request.formData();
  const file = findUploadedFile(formData);
  if (!file) {
    return errorResponse("No upload file was provided", 400, corsHeaders);
  }

  const originalFilename = file.name || "upload";
  const key = buildMediaObjectKey(user.id, originalFilename);
  const contentType = file.type || "application/octet-stream";

  await env.TUNETREES_VAULT.put(
    key,
    typeof file.stream === "function" ? file.stream() : file,
    {
      httpMetadata: {
        contentType,
        contentDisposition: `inline; filename="${sanitizeFilename(originalFilename)}"`,
      },
      customMetadata: {
        ownerUserId: user.id,
        originalFilename,
        sizeBytes: String(file.size),
        uploadedAt: new Date().toISOString(),
      },
    }
  );

  console.info(
    "[media.upload]",
    JSON.stringify({
      userId: user.id,
      key,
      sizeBytes: file.size,
      contentType,
    })
  );

  const response: MediaUploadResponse = {
    success: true,
    time: new Date().toISOString(),
    data: {
      files: [buildMediaViewUrl(request, key)],
      isImages: [contentType.startsWith("image/")],
      path: key,
      baseurl: "",
      messages: [],
    },
    file: {
      key,
      size: file.size,
      contentType,
    },
  };

  return jsonResponse(response, 200, corsHeaders);
}

async function handleMediaView(
  request: Request,
  env: MediaWorkerEnv,
  corsHeaders: Record<string, string>
) {
  if (!env.TUNETREES_VAULT) {
    return errorResponse("Media storage is not configured", 500, corsHeaders);
  }

  const user = await authenticateMediaRequest(request, env);
  if (!user) {
    return errorResponse("Unauthorized", 401, corsHeaders);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return errorResponse("Missing media key", 400, corsHeaders);
  }

  const userPrefix = `${USER_ROOT_PREFIX}/${user.id}/`;
  if (!key.startsWith(userPrefix)) {
    return errorResponse("Forbidden", 403, corsHeaders);
  }

  const object = await env.TUNETREES_VAULT.get(key);
  if (!object?.body) {
    return errorResponse("Media not found", 404, corsHeaders);
  }

  const headers = new Headers(corsHeaders);
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, no-store");
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }
  if (typeof object.size === "number") {
    headers.set("Content-Length", String(object.size));
  }
  if (object.etag) {
    headers.set("ETag", object.etag);
  }

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

export async function handleMediaRequest(
  request: Request,
  env: MediaWorkerEnv
): Promise<Response | null> {
  const corsHeaders = getCorsHeaders(request);
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === MEDIA_UPLOAD_PATH) {
    return handleMediaUpload(request, env, corsHeaders);
  }

  if (request.method === "GET" && url.pathname === MEDIA_VIEW_PATH) {
    return handleMediaView(request, env, corsHeaders);
  }

  return null;
}
