import { NextResponse } from "next/server";

// Simple in-memory epoch for testing: persists for the life of the Next.js server
let epoch = 0;

export function GET() {
  return NextResponse.json({ epoch });
}

export function POST() {
  epoch += 1;
  return NextResponse.json({ epoch });
}
