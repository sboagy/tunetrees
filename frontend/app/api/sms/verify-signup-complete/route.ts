import { NextRequest, NextResponse } from "next/server";

interface ISmsSignupVerificationRequest {
  email: string;
  phone: string;
  code: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ISmsSignupVerificationRequest = await request.json();

    const response = await fetch(
      `${process.env.TT_API_BASE_URL || "http://localhost:8000"}/sms/verify-signup-complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("SMS signup verification API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
