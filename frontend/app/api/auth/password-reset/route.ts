import { getUserExtendedByEmail, ttHttpAdapter } from "@/auth/auth-tt-adapter";
import { sendGrid } from "@/auth/helpers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = requestSchema.parse(body);

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      message:
        "If an account with that email exists, we've sent a password reset link.",
    });

    // Check if user exists
    const user = await getUserExtendedByEmail(email);
    if (!user) {
      return successResponse;
    }

    // Generate reset token (6-digit code for simplicity)
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    if (!ttHttpAdapter.createVerificationToken) {
      throw new Error("ttHttpAdapter.createVerificationToken is not defined.");
    }

    // Create verification token for password reset
    await ttHttpAdapter.createVerificationToken({
      identifier: `password-reset:${email}`,
      expires,
      token,
    });

    // Send password reset email
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_BASE_URL ||
      "https://localhost:3000";
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    await sendGrid({
      to: email,
      from: "admin@tunetrees.com",
      subject: "Reset your TuneTrees password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>You requested a password reset for your TuneTrees account.</p>
          <p>Click the link below to set a new password:</p>
          <a href="${resetUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `
        Reset your password
        
        You requested a password reset for your TuneTrees account.
        
        Visit this link to set a new password:
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request this, you can safely ignore this email.
      `,
    });

    return successResponse;
  } catch (error) {
    console.error("Password reset request error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "An error occurred. Please try again." },
      { status: 500 },
    );
  }
}
