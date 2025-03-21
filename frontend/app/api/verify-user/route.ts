"use server";
import type { IUser } from "@/app/(main)/pages/practice/types";
import { getUserExtendedByEmail } from "@/auth/auth-tt-adapter";
import { formatDateForEmailVerification } from "@/lib/date-utils";
import { signIn } from "auth";
import axios from "axios";
// import type { NextApiRequest, NextApiResponse } from "next";

import { type NextRequest, NextResponse } from "next/server";

// export async function POST(req: NextRequest) {
//   try {
//     const { data, host } = await req.json();

//     if (!data || !host) {
//       return NextResponse.json(
//         { message: "Missing data or host" },
//         { status: 400 },
//       );
//     }

//     // Simulate user creation logic
//     const result = { message: "User created successfully", data, host };
//     return NextResponse.json(result, { status: 200 });
//   } catch (error) {
//     console.error("Error creating user:", error);
//     return NextResponse.json(
//       { message: "Internal Server Error" },
//       { status: 500 },
//     );
//   }
// }

const _baseURL = process.env.NEXT_BASE_URL;

export async function GET(req: NextRequest) {
  console.log("GET request for verify-user: ", req);
  const token = req.nextUrl.searchParams.get("token");
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { message: "Missing email for user verification" },
      { status: 400 },
    );
  }
  if (token) {
    await signIn("token-credential", {
      email,
      token,
      callbackUrl: `${_baseURL}/auth/login`,
    });
  } else {
    const password = req.nextUrl.searchParams.get("password");
    if (!password) {
      return NextResponse.json(
        { message: "Missing password or verification token for user" },
        { status: 400 },
      );
    }
    await signIn("credentials", {
      email,
      password,
      callbackUrl: `${_baseURL}/auth/login`,
    });
  }

  const user = await getUserExtendedByEmail(email);

  if (!user) {
    return NextResponse.json(
      { message: `User not found for email: ${email}` },
      { status: 404 },
    );
  }

  if (user.emailVerified === null) {
    user.emailVerified = new Date();
    const userPatch: IUser = {
      id: Number(user.id),
      email_verified: formatDateForEmailVerification(user.emailVerified),
    };

    const stringifyUser = JSON.stringify(userPatch);

    const updateUserResponse = await axios.patch(
      `${_baseURL}/auth/update-user/${user.id}`,
      stringifyUser,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    console.log("update_user_response: ", updateUserResponse);
  }

  return NextResponse.json({ message: "ok" }, { status: 200 });
}
