import { NextResponse } from "next/server";

// Simple in-memory epoch for testing: persists for the life of the Next.js server
let epoch = 0;

export function GET() {
  return NextResponse.json({ epoch });
}

export function POST() {
  epoch += 1;
  const res = NextResponse.json({ epoch });
  // Set a simple cookie the client can read to trigger cache clearing on next mount
  // Not HttpOnly so the browser code can clear it afterward.
  res.cookies.set("TT_CLEAR_TABLE_STATE", String(epoch), {
    path: "/",
    httpOnly: false,
  });
  return res;
}
