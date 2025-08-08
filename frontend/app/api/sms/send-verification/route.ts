// API route to send SMS verification codes
// This proxies requests to the backend SMS service

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { phone, isSignup } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    // Use different endpoint based on whether it's for signup or existing user
    const endpoint = isSignup
      ? "/sms/send-verification-signup"
      : "/sms/send-verification";

    const response = await fetch(`${process.env.TT_API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Failed to send verification code" },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("SMS verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
