import { type NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.TT_API_BASE_URL;

function backendUrl(path: string) {
  if (!API_BASE)
    throw new Error("TT_API_BASE_URL not configured in environment");
  return `${API_BASE}${path}`;
}

async function forward(req: NextRequest, url: string, init?: RequestInit) {
  const resp = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await resp.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: resp.status });
  } catch {
    return new NextResponse(text, { status: resp.status });
  }
}

export async function POST(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const userId = search.get("user_id");
  const algType = search.get("alg_type") || "FSRS";
  const force = search.get("force_optimization") || "false";
  if (!userId) {
    return NextResponse.json(
      { message: "Missing user_id query parameter" },
      { status: 400 },
    );
  }
  const url = backendUrl(
    `/preferences/optimize_fsrs?user_id=${encodeURIComponent(
      userId,
    )}&alg_type=${encodeURIComponent(algType)}&force_optimization=${encodeURIComponent(
      force,
    )}`,
  );
  return forward(req, url, { method: "POST" });
}
