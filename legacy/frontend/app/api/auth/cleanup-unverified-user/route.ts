import { type NextRequest, NextResponse } from "next/server";
import { getUserExtendedByEmail, ttHttpAdapter } from "@/auth/auth-tt-adapter";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    console.log(`Cleanup request for unverified user: ${email}`);

    // Check if user exists and is unverified
    const existingUser = await getUserExtendedByEmail(email);

    if (!existingUser) {
      console.log(`No user found for ${email}, nothing to clean up`);
      return NextResponse.json({ message: "No user found" }, { status: 200 });
    }

    // Only delete if the user is NOT verified
    if (existingUser.emailVerified) {
      console.log(`User ${email} is verified, not deleting`);
      return NextResponse.json(
        { error: "Cannot delete verified user" },
        { status: 400 },
      );
    }

    console.log(`Deleting unverified user ${existingUser.id} for ${email}`);

    if (!ttHttpAdapter.deleteUser) {
      throw new Error("ttHttpAdapter.deleteUser is not available");
    }

    await ttHttpAdapter.deleteUser(existingUser.id);

    console.log(`Successfully deleted unverified user ${existingUser.id}`);

    return NextResponse.json({
      message: "Unverified user cleaned up successfully",
    });
  } catch (error) {
    console.error("Error cleaning up unverified user:", error);
    return NextResponse.json(
      {
        error: `Failed to clean up user: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}
