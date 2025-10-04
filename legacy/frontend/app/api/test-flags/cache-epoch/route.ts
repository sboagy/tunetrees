import { NextResponse } from "next/server";

// Simple in-memory epoch for testing: persists for the life of the Next.js server
let epoch = 0;

export function GET() {
  return NextResponse.json({ epoch });
}

export function POST() {
  epoch += 1;
  const res = NextResponse.json({ epoch });
  // Set a cookie holding the current epoch. Client will clear caches exactly once
  // per epoch by comparing to its last-cleared value; no time-based expiry needed.
  res.cookies.set("TT_CLEAR_TABLE_STATE", String(epoch), {
    path: "/",
    httpOnly: false,
  });
  return res;
}
