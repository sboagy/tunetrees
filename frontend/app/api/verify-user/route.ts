"use server";
import { getUserExtendedByEmail } from "@/auth/auth_tt_adapter";
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
  console.log("GET request for email: ", req);
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json(
      { message: "Missing email for user verification" },
      { status: 400 },
    );
  }
  const password = req.nextUrl.searchParams.get("password");
  if (!password) {
    return NextResponse.json(
      { message: "Missing password for user verification" },
      { status: 400 },
    );
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
    const stringify_user = JSON.stringify(user);

    const update_user_response = await axios.patch(
      `${_baseURL}/auth/update-user/`,
      stringify_user,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    console.log("update_user_response: ", update_user_response);
  }

  await signIn("credentials", {
    email,
    password,
    callbackUrl: "http://localhost:3000",
  });
  return NextResponse.json({ message: "ok" }, { status: 200 });
}
