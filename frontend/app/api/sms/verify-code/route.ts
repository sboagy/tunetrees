// API route to verify SMS codes
// This proxies requests to the backend SMS service

import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { success: false, message: "Phone number and code are required" },
        { status: 400 },
      );
    }

    // Forward request to backend SMS service
    const apiUrl = process.env.TT_API_BASE_URL || "http://localhost:8000";
    const response = await fetch(`${apiUrl}/sms/verify-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, code }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.detail || "Failed to verify SMS code" },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("SMS verify API error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
