import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getUserExtendedByEmail,
  type IExtendedAdapterUser,
  ttHttpAdapter,
} from "@/auth/auth-tt-adapter";
import { hashPassword } from "@/auth/password-hash";

const resetSchema = z.object({
  email: z.string().email(),
  token: z.string(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token, password } = resetSchema.parse(body);

    // Verify user exists
    const user = await getUserExtendedByEmail(email);
    if (!user) {
      return NextResponse.json(
        { message: "Invalid reset link" },
        { status: 400 },
      );
    }

    if (!ttHttpAdapter.useVerificationToken) {
      throw new Error("ttHttpAdapter.useVerificationToken is not defined.");
    }

    // Verify and consume the token
    const verificationToken = await ttHttpAdapter.useVerificationToken({
      identifier: `password-reset:${email}`,
      token,
    });

    if (!verificationToken) {
      return NextResponse.json(
        { message: "Invalid or expired reset link" },
        { status: 400 },
      );
    }

    // Check if token has expired
    const now = new Date();
    const expires = new Date(verificationToken.expires);
    if (now > expires) {
      return NextResponse.json(
        { message: "Reset link has expired" },
        { status: 400 },
      );
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password);

    if (!ttHttpAdapter.updateUser) {
      throw new Error("ttHttpAdapter.updateUser is not defined.");
    }

    // Update user password
    await ttHttpAdapter.updateUser({
      id: user.id,
      hash: hashedPassword,
    } as IExtendedAdapterUser);

    return NextResponse.json({
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Password reset error:", error);

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return NextResponse.json(
        { message: firstError.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "An error occurred. Please try again." },
      { status: 500 },
    );
  }
}
