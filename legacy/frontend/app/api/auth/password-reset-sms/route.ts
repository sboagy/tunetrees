import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  phone: z.string().min(10), // E.164 format phone number
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = requestSchema.parse(body);

    // Always return success to prevent phone enumeration
    const successResponse = NextResponse.json({
      message:
        "If an account with that phone number exists, we've sent a password reset code.",
    });

    // Use the backend SMS endpoint to send password reset code
    // The backend will handle user lookup and SMS sending via Twilio
    const backendResponse = await fetch(
      `${process.env.TT_API_BASE_URL}/sms/send-password-reset`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone, // Backend expects 'phone' field
        }),
      },
    );

    // Log response for debugging but always return success to prevent enumeration
    if (!backendResponse.ok) {
      console.error(
        "Backend SMS password reset failed:",
        await backendResponse.text(),
      );
    }

    // Always return success regardless of backend response to prevent enumeration
    return successResponse;
  } catch (error) {
    console.error("SMS password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
