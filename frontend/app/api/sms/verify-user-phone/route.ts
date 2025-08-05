import { NextRequest, NextResponse } from "next/server";

interface ISMSUserPhoneVerificationRequest {
  user_email: string;
  phone: string;
  code: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ISMSUserPhoneVerificationRequest = await request.json();

    if (!body.user_email || !body.phone || !body.code) {
      return NextResponse.json(
        {
          error: "User email, phone number, and verification code are required",
        },
        { status: 400 },
      );
    }

    const backendUrl = process.env.TT_API_BASE_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/sms/verify-user-phone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        {
          error: errorData?.detail || "SMS verification failed",
          details: errorData,
        },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error verifying user phone:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
