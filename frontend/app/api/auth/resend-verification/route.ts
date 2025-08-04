import { NextRequest, NextResponse } from "next/server";
import { createVerificationTokenInDatabase } from "@/auth/auth-fetch";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    console.log("Resending verification email for:", email);

    // Generate a new verification token (6-digit code)
    const newToken = crypto.randomInt(100000, 999999).toString();

    // Create expiration date (24 hours from now)
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create/update the verification token in the database
    // Since identifier is the primary key, this will replace any existing token
    await createVerificationTokenInDatabase({
      identifier: email,
      token: newToken,
      expires: expires,
    });

    // Get SendGrid configuration
    const apiKey = process.env.TT_AUTH_SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error("SendGrid API key not configured");
    }

    // Create verification URL with token
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_BASE_URL ||
      "https://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/callback/sendgrid?token=${newToken}&email=${encodeURIComponent(email)}`;

    // Send email directly via SendGrid API
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: email }] }],
        from: { email: "admin@tunetrees.com" },
        subject: `Verify your email for TuneTrees`,
        content: [
          {
            type: "text/plain",
            value: `Verify your email for TuneTrees

Use this link: ${verifyUrl}

Or enter this code: ${newToken}

This code expires in 24 hours.`,
          },
          {
            type: "text/html",
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Verify your email for TuneTrees</h2>
                <p>Click the link below to verify your email address:</p>
                <p><a href="${verifyUrl}" style="background: #346df1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
                <p>Or enter this verification code: <strong>${newToken}</strong></p>
                <p>This code expires in 24 hours.</p>
                <p>If you didn't request this email, you can safely ignore it.</p>
              </div>
            `,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid error: ${errorText}`);
    }

    console.log(`Verification email sent to ${email} with token: ${newToken}`);

    return NextResponse.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Failed to resend verification email" },
      { status: 500 },
    );
  }
}
