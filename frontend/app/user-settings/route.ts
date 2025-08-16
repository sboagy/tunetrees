import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL("/user-settings/scheduling-options", request.url);
  return NextResponse.redirect(url);
}

export function HEAD(request: Request) {
  return GET(request);
}
