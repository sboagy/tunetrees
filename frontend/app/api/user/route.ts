"use server";
import type { AccountFormValues } from "@/app/auth/newuser/account-form";
// import type { NextApiRequest, NextApiResponse } from "next";
import { newUser } from "../../auth/newuser/newuser-actions";

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

export async function POST(req: NextRequest) {
  try {
    type RequestBody = { data: AccountFormValues; host: string };
    const { data, host }: RequestBody = (await req.json()) as RequestBody;

    if (!data || !host) {
      return NextResponse.json(
        { message: "Missing data or host" },
        { status: 400 },
      );
    }

    const result = await newUser(data, host);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
