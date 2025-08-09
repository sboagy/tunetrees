import { type NextRequest, NextResponse } from "next/server";

// Proxy to backend FastAPI for scheduling options preferences.
// Supports GET (with user_id), POST (create), PUT (update with user_id).
// This keeps browser code using a relative /api path and avoids exposing backend base URL directly.

const API_BASE = process.env.TT_API_BASE_URL;

function backendUrl(path: string) {
  if (!API_BASE)
    throw new Error("TT_API_BASE_URL not configured in environment");
  return `${API_BASE}${path}`;
}

async function forward(req: NextRequest, url: string, init?: RequestInit) {
  const resp = await fetch(url, {
    // Pass through method/body/headers as needed
    ...init,
    // Ensure headers are set properly
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    // Do not cache to keep preferences fresh
    cache: "no-store",
  });
  const text = await resp.text();
  // Attempt to return JSON if possible
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: resp.status });
  } catch {
    return new NextResponse(text, { status: resp.status });
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json(
      { message: "Missing user_id query parameter" },
      { status: 400 },
    );
  }
  const url = backendUrl(
    `/preferences/prefs_scheduling_options?user_id=${encodeURIComponent(
      userId,
    )}`,
  );
  return forward(req, url, { method: "GET" });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const url = backendUrl("/preferences/prefs_scheduling_options");
  return forward(req, url, { method: "POST", body });
}

export async function PUT(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json(
      { message: "Missing user_id query parameter" },
      { status: 400 },
    );
  }
  const body = await req.text();
  const url = backendUrl(
    `/preferences/prefs_scheduling_options?user_id=${encodeURIComponent(
      userId,
    )}`,
  );
  return forward(req, url, { method: "PUT", body });
}
