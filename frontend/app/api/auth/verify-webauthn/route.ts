import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { assertion } = await request.json();

    // Forward to backend WebAuthn verification endpoint
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const response = await fetch(
      `${backendUrl}/webauthn/authentication/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential: assertion }),
      },
    );

    if (response.ok) {
      const user = await response.json();
      return NextResponse.json(user);
    } else {
      return NextResponse.json(
        { error: "Invalid passkey authentication" },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error("WebAuthn verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
