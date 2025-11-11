import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  console.log("protected.ts: GET(): request: %s", JSON.stringify(request));
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    message: "This is a protected route",
    user: session.user,
  });
}
