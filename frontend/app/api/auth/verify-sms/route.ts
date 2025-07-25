import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json();

    // Forward to backend SMS verification endpoint
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/sms/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, code }),
    });

    if (response.ok) {
      const user = await response.json();
      return NextResponse.json(user);
    } else {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error("SMS verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
