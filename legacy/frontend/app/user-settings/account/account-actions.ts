"use server";

import { revalidatePath } from "next/cache";
import type { IUser } from "@/app/(main)/pages/practice/types";
import type { AccountFormValues } from "@/app/auth/newuser/account-form";
import { auth } from "@/auth";
import { updateUserInDatabase } from "@/auth/auth-fetch";
import { hashPassword } from "@/auth/password-hash";

export interface IUpdateUserResult {
  status: "success" | "error";
  message: string;
  user?: IUser;
}

export async function updateUser(
  data: AccountFormValues,
): Promise<IUpdateUserResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        status: "error",
        message: "User not authenticated",
      };
    }

    const userId = Number(session.user.id);
    if (Number.isNaN(userId)) {
      return {
        status: "error",
        message: "Invalid user ID",
      };
    }

    // Prepare user update data
    const userUpdate: Partial<IUser> = {
      name: data.name,
      email: data.email,
      phone: data.phone,
    };

    // Only hash and update password if it's provided
    if (data.password && data.password.trim() !== "") {
      userUpdate.hash = await hashPassword(data.password);
    }

    console.log("Updating user", userId, "with data:", {
      ...userUpdate,
      hash: userUpdate.hash ? "[REDACTED]" : undefined,
    });

    const updatedUser = await updateUserInDatabase(userId, userUpdate);

    // Revalidate the user settings page to show updated data
    revalidatePath("/user-settings/account");

    return {
      status: "success",
      message: "Account updated successfully",
      user: updatedUser,
    };
  } catch (error) {
    console.error("Error updating user:", error);
    return {
      status: "error",
      message: `Failed to update account: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
