import { type NextRequest, NextResponse } from "next/server";

interface ISMSUserPhoneRequest {
  user_email: string;
  phone: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ISMSUserPhoneRequest = await request.json();

    if (!body.user_email || !body.phone) {
      return NextResponse.json(
        { error: "User email and phone number are required" },
        { status: 400 },
      );
    }

    const backendUrl = process.env.TT_API_BASE_URL || "http://localhost:8000";
    const response = await fetch(
      `${backendUrl}/sms/send-verification-user-phone`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

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
    console.error("Error sending user phone verification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
